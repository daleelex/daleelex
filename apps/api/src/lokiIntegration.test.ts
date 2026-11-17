import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  deleteMany: vi.fn(),
  requireClerkAdmin: vi.fn(),
}));

vi.mock('./db.js', () => ({
  prisma: {
    integrationConfig: {
      findUnique: mocks.findUnique,
      upsert: mocks.upsert,
      deleteMany: mocks.deleteMany,
    },
  },
}));

vi.mock('./clerkAuth.js', () => ({
  requireClerkAdmin: mocks.requireClerkAdmin,
  requireClerkUser: vi.fn(),
}));

import { integrationsRoute } from './routes/integrations.js';
import {
  createLogSourceResolver,
  getLokiConfig,
  normalizeLokiBaseUrl,
  normalizeServiceLabel,
  testLokiConnection,
} from './integrations/loki.js';
import { LogSourceUnavailableError } from './logs/logSource.js';
import { LokiLogSource } from './logs/lokiLogSource.js';
import { MockLogSource } from './logs/mockLogSource.js';

async function buildApp() {
  const app = Fastify();
  await app.register(integrationsRoute, { prefix: '/api/v1' });
  return app;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv('LOKI_URL', '');
  vi.stubEnv('LOKI_SERVICE_LABEL', '');
  mocks.requireClerkAdmin.mockImplementation(async (request: { clerkUserId?: string }) => {
    request.clerkUserId = 'admin-1';
  });
  mocks.findUnique.mockResolvedValue(null);
});

describe('Loki config resolution', () => {
  it('reports no source when nothing is configured', async () => {
    expect(await getLokiConfig()).toEqual({
      baseUrl: null,
      serviceLabel: 'service_id',
      source: 'none',
    });
  });

  it('falls back to LOKI_URL when nothing is saved', async () => {
    vi.stubEnv('LOKI_URL', 'http://loki:3100/');
    vi.stubEnv('LOKI_SERVICE_LABEL', 'app');

    expect(await getLokiConfig()).toEqual({
      baseUrl: 'http://loki:3100',
      serviceLabel: 'app',
      source: 'env',
    });
  });

  it('ignores an env label that is not a valid Loki label name', async () => {
    vi.stubEnv('LOKI_URL', 'http://loki:3100');
    vi.stubEnv('LOKI_SERVICE_LABEL', 'service-id"} or {x="');

    expect((await getLokiConfig()).serviceLabel).toBe('service_id');
  });

  it('prefers the saved config over the environment', async () => {
    vi.stubEnv('LOKI_URL', 'http://env-loki:3100');
    mocks.findUnique.mockResolvedValue({
      baseUrl: 'http://saved-loki:3100',
      settings: { serviceLabel: 'svc' },
    });

    expect(await getLokiConfig()).toEqual({
      baseUrl: 'http://saved-loki:3100',
      serviceLabel: 'svc',
      source: 'db',
    });
  });
});

describe('Loki input normalization', () => {
  it('strips trailing slashes and keeps a path prefix', () => {
    expect(normalizeLokiBaseUrl(' http://loki:3100/prefix// ')).toBe('http://loki:3100/prefix');
  });

  it.each(['not a url', 'ftp://loki', 'http://user:pw@loki:3100', 'http://loki:3100?x=1'])(
    'rejects %s',
    (value) => {
      expect(() => normalizeLokiBaseUrl(value)).toThrow();
    },
  );

  it('defaults the label and rejects names that could break out of LogQL', () => {
    expect(normalizeServiceLabel('')).toBe('service_id');
    expect(() => normalizeServiceLabel('a="x"} or {b')).toThrow();
  });
});

describe('createLogSourceResolver', () => {
  it('switches from mock to Loki as soon as a config is saved, and reuses the client', async () => {
    const resolve = createLogSourceResolver();
    expect(await resolve()).toBeInstanceOf(MockLogSource);

    mocks.findUnique.mockResolvedValue({ baseUrl: 'http://loki:3100', settings: null });
    const first = await resolve();
    expect(first).toBeInstanceOf(LokiLogSource);
    expect(await resolve()).toBe(first);

    mocks.findUnique.mockResolvedValue({ baseUrl: 'http://other-loki:3100', settings: null });
    expect(await resolve()).not.toBe(first);

    mocks.findUnique.mockResolvedValue(null);
    expect(await resolve()).toBeInstanceOf(MockLogSource);
  });

  it('keeps the backend in use when the saved config becomes unreadable', async () => {
    const resolve = createLogSourceResolver();
    mocks.findUnique.mockResolvedValue({ baseUrl: 'http://loki:3100', settings: null });
    const first = await resolve();

    mocks.findUnique.mockRejectedValue(new Error('db down'));
    expect(await resolve()).toBe(first);
  });

  it('uses LOKI_URL, never the mock, when the config cannot be read at all', async () => {
    mocks.findUnique.mockRejectedValue(new Error('db down'));

    await expect(createLogSourceResolver()()).rejects.toBeInstanceOf(LogSourceUnavailableError);

    vi.stubEnv('LOKI_URL', 'http://env-loki:3100');
    expect(await createLogSourceResolver()()).toBeInstanceOf(LokiLogSource);
  });
});

describe('testLokiConnection', () => {
  it('succeeds and reports the label when Loki has it', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ status: 'success', data: ['service_id', 'level'] }));

    const result = await testLokiConnection('http://loki:3100/', undefined, fetchMock);

    expect(fetchMock.mock.calls[0][0]).toBe('http://loki:3100/loki/api/v1/labels');
    expect(result).toMatchObject({ ok: true, labelFound: true });
  });

  it('succeeds with a warning when the label is absent', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: 'success', data: [] }));

    const result = await testLokiConnection('http://loki:3100', 'app', fetchMock);

    expect(result.ok).toBe(true);
    expect(result.labelFound).toBe(false);
    expect(result.message).toContain('"app"');
  });

  it('fails when the host is unreachable, rejects the call, or is not Loki', async () => {
    const unreachable = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    expect((await testLokiConnection('http://loki:3100', undefined, unreachable)).ok).toBe(false);

    const unauthorized = vi.fn().mockResolvedValue(jsonResponse({}, 401));
    expect(
      (await testLokiConnection('http://loki:3100', undefined, unauthorized)).message,
    ).toContain('authentication');

    const notLoki = vi.fn().mockResolvedValue(new Response('<html>', { status: 200 }));
    expect((await testLokiConnection('http://loki:3100', undefined, notLoki)).ok).toBe(false);
  });

  it('does not follow a redirect', async () => {
    const redirect = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 302, headers: { location: 'http://x/' } }));

    const result = await testLokiConnection('http://loki:3100', undefined, redirect);

    expect(redirect.mock.calls[0][1]).toMatchObject({ redirect: 'manual' });
    expect(result).toMatchObject({ ok: false, labelFound: null });
    expect(result.message).toContain('redirects');
  });

  it('does not fetch at all for an invalid URL', async () => {
    const fetchMock = vi.fn();
    const result = await testLokiConnection('file:///etc/passwd', undefined, fetchMock);

    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Loki integration routes', () => {
  it.each([
    ['GET', '/api/v1/integrations/loki'],
    ['PUT', '/api/v1/integrations/loki'],
    ['DELETE', '/api/v1/integrations/loki'],
    ['POST', '/api/v1/integrations/loki/test'],
  ] as const)('%s %s rejects non-admin callers', async (method, url) => {
    mocks.requireClerkAdmin.mockImplementation(async (_request, reply) =>
      reply.code(403).send({ error: { code: 'admin_forbidden' } }),
    );
    const app = await buildApp();

    const response = await app.inject({
      method,
      url,
      ...(method === 'PUT' || method === 'POST'
        ? { payload: { baseUrl: 'http://loki:3100' } }
        : {}),
    });

    expect(response.statusCode).toBe(403);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it('saves a normalized config and returns it', async () => {
    mocks.upsert.mockResolvedValue({});
    mocks.findUnique.mockResolvedValue({
      baseUrl: 'http://loki:3100',
      settings: { serviceLabel: 'app' },
    });
    const app = await buildApp();

    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/integrations/loki',
      payload: { baseUrl: 'http://loki:3100/', serviceLabel: ' app ' },
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { provider: 'loki' },
        update: { baseUrl: 'http://loki:3100', settings: { serviceLabel: 'app' } },
      }),
    );
    expect(response.json()).toEqual({
      baseUrl: 'http://loki:3100',
      serviceLabel: 'app',
      source: 'db',
    });
  });

  it('422s an invalid URL or label without saving', async () => {
    const app = await buildApp();

    for (const payload of [
      { baseUrl: 'ftp://loki' },
      { baseUrl: 'http://loki:3100', serviceLabel: 'bad-label' },
      {},
    ]) {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/integrations/loki',
        payload,
      });
      expect(response.statusCode).toBe(422);
      expect(response.json().error.code).toBe('validation_failed');
    }
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('disconnects and reports what logs fall back to', async () => {
    mocks.deleteMany.mockResolvedValue({ count: 1 });
    const app = await buildApp();

    const response = await app.inject({ method: 'DELETE', url: '/api/v1/integrations/loki' });

    expect(response.statusCode).toBe(200);
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { provider: 'loki' } });
    expect(response.json().source).toBe('none');
  });
});
