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

import { requireClerkAdmin } from './clerkAuth.js';

const originalSecret = process.env.CLERK_SECRET_KEY;

describe('requireClerkAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLERK_SECRET_KEY = 'test-secret';
    mocks.verifyToken.mockResolvedValue({ sub: 'user-1' });
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CLERK_SECRET_KEY;
    else process.env.CLERK_SECRET_KEY = originalSecret;
  });

  it('allows a verified Clerk user with the admin public metadata role', async () => {
    mocks.getUser.mockResolvedValue({ publicMetadata: { role: 'admin' } });
    const app = buildApp();

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
    const app = buildApp();

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
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/admin-only',
      headers: { authorization: 'Bearer session-token' },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('admin_authorization_unavailable');
  });
});

function buildApp() {
  const app = Fastify();
  app.post('/admin-only', { preHandler: requireClerkAdmin }, async () => ({ ok: true }));
  return app;
}
