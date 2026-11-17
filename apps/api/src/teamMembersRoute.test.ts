import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  teamFindUnique: vi.fn(),
  userFindFirst: vi.fn(),
  membershipCreate: vi.fn(),
  membershipDeleteMany: vi.fn(),
  requireClerkAdmin: vi.fn(),
}));

vi.mock('./db.js', () => ({
  prisma: {
    team: { findUnique: mocks.teamFindUnique },
    user: { findFirst: mocks.userFindFirst },
    teamMembership: { create: mocks.membershipCreate, deleteMany: mocks.membershipDeleteMany },
  },
}));

vi.mock('./clerkAuth.js', () => ({
  requireClerkUser: async (request: FastifyRequest) => {
    request.clerkUserId = 'user-1';
  },
  requireClerkAdmin: mocks.requireClerkAdmin,
}));

import { teamMembersRoute } from './routes/teamMembers.js';

const ada = {
  id: 'user-ada',
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  avatarUrl: null,
};

async function buildApp() {
  const app = Fastify();
  await app.register(teamMembersRoute, { prefix: '/api/v1' });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireClerkAdmin.mockImplementation(async (request: FastifyRequest) => {
    request.clerkUserId = 'admin-1';
  });
});

describe('GET /api/v1/teams/:id/members', () => {
  it('lists members with their user details', async () => {
    mocks.teamFindUnique.mockResolvedValue({
      members: [{ createdAt: new Date('2026-11-01T09:00:00.000Z'), user: ada }],
    });
    const app = await buildApp();

    const response = await app.inject({ method: 'GET', url: '/api/v1/teams/platform/members' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: [
        {
          userId: 'user-ada',
          email: 'ada@example.com',
          name: 'Ada Lovelace',
          avatarUrl: null,
          addedAt: '2026-11-01T09:00:00.000Z',
        },
      ],
      total: 1,
    });
  });

  it('returns 404 for an unknown team', async () => {
    mocks.teamFindUnique.mockResolvedValue(null);
    const app = await buildApp();

    const response = await app.inject({ method: 'GET', url: '/api/v1/teams/missing/members' });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('team_not_found');
  });
});

describe('POST /api/v1/teams/:id/members', () => {
  it('adds a signed-in user by email, matching case-insensitively', async () => {
    mocks.teamFindUnique.mockResolvedValue({ id: 'platform' });
    mocks.userFindFirst.mockResolvedValue(ada);
    mocks.membershipCreate.mockResolvedValue({ createdAt: new Date('2026-11-09T12:00:00.000Z') });
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/teams/platform/members',
      payload: { email: ' Ada@Example.com ' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ userId: 'user-ada', email: 'ada@example.com' });
    expect(mocks.userFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: { equals: 'Ada@Example.com', mode: 'insensitive' } },
      }),
    );
    expect(mocks.membershipCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { teamId: 'platform', userId: 'user-ada' } }),
    );
  });

  it('explains that a user must sign in once before being added', async () => {
    mocks.teamFindUnique.mockResolvedValue({ id: 'platform' });
    mocks.userFindFirst.mockResolvedValue(null);
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/teams/platform/members',
      payload: { email: 'nobody@example.com' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('user_not_found');
    expect(response.json().error.message).toContain('sign in once');
    expect(mocks.membershipCreate).not.toHaveBeenCalled();
  });

  it('returns 409 when the user is already a member', async () => {
    mocks.teamFindUnique.mockResolvedValue({ id: 'platform' });
    mocks.userFindFirst.mockResolvedValue(ada);
    mocks.membershipCreate.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }));
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/teams/platform/members',
      payload: { email: 'ada@example.com' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('team_member_exists');
  });

  it('returns 422 for an email without an @', async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/teams/platform/members',
      payload: { email: 'not-an-email' },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('validation_failed');
  });

  it('rejects non-admin callers before touching the database', async () => {
    mocks.requireClerkAdmin.mockImplementationOnce(
      async (_request: FastifyRequest, reply: FastifyReply) =>
        reply.code(403).send({ error: { code: 'admin_forbidden' } }),
    );
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/teams/platform/members',
      payload: { email: 'ada@example.com' },
    });

    expect(response.statusCode).toBe(403);
    expect(mocks.teamFindUnique).not.toHaveBeenCalled();
    expect(mocks.membershipCreate).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/v1/teams/:id/members/:userId', () => {
  it('removes the membership', async () => {
    mocks.membershipDeleteMany.mockResolvedValue({ count: 1 });
    const app = await buildApp();

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/teams/platform/members/user-ada',
    });

    expect(response.statusCode).toBe(204);
    expect(mocks.membershipDeleteMany).toHaveBeenCalledWith({
      where: { teamId: 'platform', userId: 'user-ada' },
    });
  });

  it('returns 404 when there was no such membership', async () => {
    mocks.membershipDeleteMany.mockResolvedValue({ count: 0 });
    const app = await buildApp();

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/teams/platform/members/user-ada',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('team_member_not_found');
  });
});
