import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LogSourceUnavailableError, type LogSource } from './logs/logSource.js';

const mocks = vi.hoisted(() => ({
  serviceFindFirst: vi.fn(),
  isClerkAdmin: vi.fn(),
}));

vi.mock('./db.js', () => ({
  prisma: {
    service: { findFirst: mocks.serviceFindFirst },
  },
}));

vi.mock('./clerkAuth.js', () => ({
  requireClerkUser: async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.headers.authorization) {
      return reply
        .header('x-request-id', request.id)
        .code(401)
        .send({
          error: {
            code: 'missing_session_token',
            message: 'This endpoint requires a Clerk session bearer token.',
            details: {},
          },
          request_id: request.id,
        });
    }
    request.clerkUserId = 'user-1';
  },
  isClerkAdmin: mocks.isClerkAdmin,
}));

import { serviceLogsRoute } from './routes/serviceLogs.js';
import { MockLogSource } from './logs/mockLogSource.js';

const queryLogs = vi.fn().mockResolvedValue({
  entries: [
    {
      id: 'log-1',
      timestamp: '2026-08-01T10:00:00.000Z',
      level: 'info',
      message: 'Request completed',
      labels: { service_id: 'svc-1' },
    },
  ],
  nextCursor: 'next-page',
});

const source: LogSource = {
  query: queryLogs,
};

const validQuery = 'start=2026-08-01T09%3A00%3A00.000Z&end=2026-08-01T10%3A00%3A00.000Z';

async function buildApp() {
  const app = Fastify();
  await app.register(serviceLogsRoute, { prefix: '/api/v1', logSource: source });
  return app;
}

describe('service logs route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.serviceFindFirst.mockResolvedValue({ id: 'svc-1', ownerTeamId: 'team-1' });
    mocks.isClerkAdmin.mockResolvedValue(true);
  });

  it('forbids signed-in users who are not administrators', async () => {
    mocks.isClerkAdmin.mockResolvedValue(false);

    const response = await (
      await buildApp()
    ).inject({
      method: 'GET',
      url: `/api/v1/services/svc-1/logs?${validQuery}`,
      headers: { authorization: 'Bearer test-token' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('logs_forbidden');
    expect(mocks.isClerkAdmin).toHaveBeenCalledWith('user-1');
    expect(queryLogs).not.toHaveBeenCalled();
  });

  it('fails closed when the admin role cannot be checked', async () => {
    mocks.isClerkAdmin.mockRejectedValue(new Error('Clerk is down'));

    const response = await (
      await buildApp()
    ).inject({
      method: 'GET',
      url: `/api/v1/services/svc-1/logs?${validQuery}`,
      headers: { authorization: 'Bearer test-token' },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('admin_authorization_unavailable');
    expect(queryLogs).not.toHaveBeenCalled();
  });

  it('reports a failing log backend as 502', async () => {
    queryLogs.mockRejectedValueOnce(new LogSourceUnavailableError('Loki is down.'));

    const response = await (
      await buildApp()
    ).inject({
      method: 'GET',
      url: `/api/v1/services/svc-1/logs?${validQuery}`,
      headers: { authorization: 'Bearer test-token' },
    });

    expect(response.statusCode).toBe(502);
    expect(response.json().error).toMatchObject({
      code: 'log_source_unavailable',
      message: 'Loki is down.',
    });
  });

  it('requires an authenticated Clerk user', async () => {
    const response = await (
      await buildApp()
    ).inject({
      method: 'GET',
      url: `/api/v1/services/svc-1/logs?${validQuery}`,
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('missing_session_token');
    expect(mocks.serviceFindFirst).not.toHaveBeenCalled();
  });

  it('returns a typed cursor page for an existing service', async () => {
    const response = await (
      await buildApp()
    ).inject({
      method: 'GET',
      url: `/api/v1/services/svc-1/logs?${validQuery}&search=Request&limit=25`,
      headers: { authorization: 'Bearer test-token' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: [
        {
          id: 'log-1',
          timestamp: '2026-08-01T10:00:00.000Z',
          level: 'info',
          message: 'Request completed',
          labels: { service_id: 'svc-1' },
        },
      ],
      next_cursor: 'next-page',
    });
    expect(queryLogs).toHaveBeenCalledWith({
      selector: { serviceId: 'svc-1' },
      start: '2026-08-01T09:00:00.000Z',
      end: '2026-08-01T10:00:00.000Z',
      search: 'Request',
      cursor: undefined,
      limit: 25,
    });
  });

  it('serves paginated mock data through the real adapter boundary', async () => {
    const app = Fastify();
    await app.register(serviceLogsRoute, {
      prefix: '/api/v1',
      logSource: new MockLogSource(),
    });

    const first = await app.inject({
      method: 'GET',
      url: `/api/v1/services/svc-1/logs?${validQuery}&limit=3`,
      headers: { authorization: 'Bearer test-token' },
    });
    const firstBody = first.json();
    const second = await app.inject({
      method: 'GET',
      url: `/api/v1/services/svc-1/logs?${validQuery}&limit=3&cursor=${encodeURIComponent(firstBody.next_cursor)}`,
      headers: { authorization: 'Bearer test-token' },
    });
    const secondBody = second.json();

    const firstIds = firstBody.data.map((entry: { id: string }) => entry.id);
    const secondIds = secondBody.data.map((entry: { id: string }) => entry.id);

    expect(first.statusCode).toBe(200);
    expect(firstBody.data).toHaveLength(3);
    expect(firstBody.next_cursor).toBeTruthy();
    expect(second.statusCode).toBe(200);
    expect(secondBody.data).toHaveLength(3);
    // Disjoint, not merely "not a superset" — an off-by-one that repeats only the
    // boundary entry still satisfies `not.arrayContaining`.
    expect(secondIds.filter((id: string) => firstIds.includes(id))).toEqual([]);
  });

  it.each([
    [
      'a non-UTC timestamp',
      'start=2026-08-01T09%3A00%3A00%2B03%3A00&end=2026-08-01T10%3A00%3A00.000Z',
    ],
    ['an excessive limit', `${validQuery}&limit=101`],
  ])('rejects %s with the standard validation envelope', async (_name, query) => {
    const response = await (
      await buildApp()
    ).inject({
      method: 'GET',
      url: `/api/v1/services/svc-1/logs?${query}`,
      headers: { authorization: 'Bearer test-token' },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('validation_failed');
    expect(response.json().request_id).toBe(response.headers['x-request-id']);
    expect(queryLogs).not.toHaveBeenCalled();
  });

  it('rejects a reversed time range', async () => {
    const response = await (
      await buildApp()
    ).inject({
      method: 'GET',
      url: '/api/v1/services/svc-1/logs?start=2026-08-01T11%3A00%3A00.000Z&end=2026-08-01T10%3A00%3A00.000Z',
      headers: { authorization: 'Bearer test-token' },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('validation_failed');
    expect(queryLogs).not.toHaveBeenCalled();
  });

  it('returns a standard not-found error before querying the source', async () => {
    mocks.serviceFindFirst.mockResolvedValue(null);
    const response = await (
      await buildApp()
    ).inject({
      method: 'GET',
      url: `/api/v1/services/missing/logs?${validQuery}`,
      headers: { authorization: 'Bearer test-token' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('service_not_found');
    expect(response.json().request_id).toBe(response.headers['x-request-id']);
    expect(queryLogs).not.toHaveBeenCalled();
  });

  it('returns a standard error when the adapter rejects a cursor', async () => {
    const { InvalidLogCursorError } = await import('./logs/logSource.js');
    queryLogs.mockRejectedValueOnce(new InvalidLogCursorError());
    const response = await (
      await buildApp()
    ).inject({
      method: 'GET',
      url: `/api/v1/services/svc-1/logs?${validQuery}&cursor=bad-scope`,
      headers: { authorization: 'Bearer test-token' },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('invalid_cursor');
    expect(response.json().request_id).toBe(response.headers['x-request-id']);
  });
});
