import { afterEach, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { requireAdmin } from './auth.js';

const ENV_KEY = 'DALEELEX_ADMIN_API_TOKEN';

afterEach(() => {
  delete process.env[ENV_KEY];
});

describe('requireAdmin', () => {
  it('disables admin writes when no admin token is configured', async () => {
    const app = buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/admin-only',
      headers: { authorization: 'Bearer local-token' },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('admin_auth_not_configured');
  });

  it('rejects requests without a bearer token', async () => {
    process.env[ENV_KEY] = 'local-token';
    const app = buildApp();

    const res = await app.inject({ method: 'POST', url: '/admin-only' });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('missing_admin_token');
  });

  it('rejects invalid admin tokens', async () => {
    process.env[ENV_KEY] = 'local-token';
    const app = buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/admin-only',
      headers: { authorization: 'Bearer wrong-token' },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('admin_forbidden');
  });

  it('allows requests with the configured admin bearer token', async () => {
    process.env[ENV_KEY] = 'local-token';
    const app = buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/admin-only',
      headers: { authorization: 'Bearer local-token' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});

function buildApp() {
  const app = Fastify();
  app.post('/admin-only', { preHandler: requireAdmin }, async () => ({ ok: true }));
  return app;
}
