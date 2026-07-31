import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('@clerk/backend', () => ({
  verifyToken: mocks.verifyToken,
  createClerkClient: () => ({ users: { getUser: mocks.getUser } }),
}));

import { requireClerkAdmin, requireClerkUser } from './clerkAuth.js';

const ENV_KEY = 'CLERK_SECRET_KEY';
const previous = process.env[ENV_KEY];

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  if (previous === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = previous;
});

describe('requireClerkUser', () => {
  // Regression: an unset key made verifyToken throw for every token, so a misconfigured
  // server reported "your session is invalid" and sent users to re-sign-in in a loop.
  it('reports a server misconfiguration when no Clerk secret key is set', async () => {
    delete process.env[ENV_KEY];
    const app = buildUserApp();

    const res = await app.inject({
      method: 'GET',
      url: '/private',
      headers: { authorization: 'Bearer session-token' },
    });

    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe('clerk_auth_not_configured');
    expect(mocks.verifyToken).not.toHaveBeenCalled();
  });

  it('rejects requests without a bearer token', async () => {
    process.env[ENV_KEY] = 'sk_test_key';
    const app = buildUserApp();

    const res = await app.inject({ method: 'GET', url: '/private' });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('missing_session_token');
  });

  it('rejects a token the configured key cannot verify', async () => {
    process.env[ENV_KEY] = 'sk_test_key';
    mocks.verifyToken.mockRejectedValue(new Error('Issuer is invalid'));
    const app = buildUserApp();

    const res = await app.inject({
      method: 'GET',
      url: '/private',
      headers: { authorization: 'Bearer session-token' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('invalid_session_token');
  });

  it('exposes the subject of a verified token', async () => {
    process.env[ENV_KEY] = 'sk_test_key';
    mocks.verifyToken.mockResolvedValue({ sub: 'user_123' });
    const app = buildUserApp();

    const res = await app.inject({
      method: 'GET',
      url: '/private',
      headers: { authorization: 'Bearer session-token' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ userId: 'user_123' });
    expect(mocks.verifyToken).toHaveBeenCalledWith('session-token', {
      secretKey: 'sk_test_key',
    });
  });
});

describe('requireClerkAdmin', () => {
  beforeEach(() => {
    process.env[ENV_KEY] = 'test-secret';
    mocks.verifyToken.mockResolvedValue({ sub: 'user-1' });
  });

  it('allows a verified Clerk user with the admin public metadata role', async () => {
    mocks.getUser.mockResolvedValue({ publicMetadata: { role: 'admin' } });
    const app = buildAdminApp();

    const response = await app.inject({
      method: 'POST',
      url: '/admin-only',
      headers: { authorization: 'Bearer session-token' },
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.getUser).toHaveBeenCalledWith('user-1');
  });

  it('rejects an authenticated non-admin with the standard error envelope', async () => {
    mocks.getUser.mockResolvedValue({ publicMetadata: { role: 'member' } });
    const app = buildAdminApp();

    const response = await app.inject({
      method: 'POST',
      url: '/admin-only',
      headers: { authorization: 'Bearer session-token' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('admin_forbidden');
    expect(response.json().request_id).toBe(response.headers['x-request-id']);
  });

  it('fails closed when Clerk user metadata cannot be loaded', async () => {
    mocks.getUser.mockRejectedValue(new Error('Clerk unavailable'));
    const app = buildAdminApp();

    const response = await app.inject({
      method: 'POST',
      url: '/admin-only',
      headers: { authorization: 'Bearer session-token' },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('admin_authorization_unavailable');
  });

  // requireClerkAdmin delegates to requireClerkUser first; the route handler must not run
  // when that delegation has already answered the request.
  it('stops at the session check when no bearer token is present', async () => {
    const app = buildAdminApp();

    const response = await app.inject({ method: 'POST', url: '/admin-only' });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('missing_session_token');
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
});

function buildUserApp() {
  const app = Fastify();
  app.get('/private', { preHandler: requireClerkUser }, async (req) => ({
    userId: req.clerkUserId,
  }));
  return app;
}

function buildAdminApp() {
  const app = Fastify();
  app.post('/admin-only', { preHandler: requireClerkAdmin }, async () => ({ ok: true }));
  return app;
}
