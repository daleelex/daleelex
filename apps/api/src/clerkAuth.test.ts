import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';

const mocks = vi.hoisted(() => ({ verifyToken: vi.fn() }));

vi.mock('@clerk/backend', () => ({ verifyToken: mocks.verifyToken }));

import { requireClerkUser } from './clerkAuth.js';

const ENV_KEY = 'CLERK_SECRET_KEY';
const previous = process.env[ENV_KEY];

beforeEach(() => {
  mocks.verifyToken.mockReset();
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
    const app = buildApp();

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
    const app = buildApp();

    const res = await app.inject({ method: 'GET', url: '/private' });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('missing_session_token');
  });

  it('rejects a token the configured key cannot verify', async () => {
    process.env[ENV_KEY] = 'sk_test_key';
    mocks.verifyToken.mockRejectedValue(new Error('Issuer is invalid'));
    const app = buildApp();

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
    const app = buildApp();

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

function buildApp() {
  const app = Fastify();
  app.get('/private', { preHandler: requireClerkUser }, async (req) => ({
    userId: req.clerkUserId,
  }));
  return app;
}
