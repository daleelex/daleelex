import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  lockTeam: vi.fn(),
  serviceFindMany: vi.fn(),
  teamDelete: vi.fn(),
  requireClerkAdmin: vi.fn(),
}));

vi.mock('./db.js', () => {
  const tx = {
    $queryRaw: mocks.lockTeam,
    service: { findMany: mocks.serviceFindMany },
    team: { delete: mocks.teamDelete },
  };
  return {
    prisma: {
      $transaction: (run: (client: typeof tx) => Promise<unknown>) => run(tx),
    },
  };
});

vi.mock('./clerkAuth.js', () => ({
  requireClerkAdmin: mocks.requireClerkAdmin,
  requireClerkUser: vi.fn(),
}));

import { teamsRoute } from './routes/teams.js';

async function deleteTeam(id: string) {
  const app = Fastify();
  await app.register(teamsRoute, { prefix: '/api/v1' });
  return app.inject({ method: 'DELETE', url: `/api/v1/teams/${id}` });
}

describe('DELETE /api/v1/teams/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireClerkAdmin.mockImplementation(async (request: { clerkUserId?: string }) => {
      request.clerkUserId = 'admin-1';
    });
    mocks.lockTeam.mockResolvedValue([{ managementSource: 'portal' }]);
    mocks.serviceFindMany.mockResolvedValue([]);
    mocks.teamDelete.mockResolvedValue({ id: 'platform-edge' });
  });

  it('deletes a portal-managed team that owns no live services', async () => {
    const response = await deleteTeam('platform-edge');

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(mocks.serviceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerTeamId: 'platform-edge', deletedAt: null } }),
    );
    expect(mocks.teamDelete).toHaveBeenCalledWith({ where: { id: 'platform-edge' } });
  });

  it('rejects non-admin callers before touching the team', async () => {
    mocks.requireClerkAdmin.mockImplementationOnce(async (_request, reply) => {
      return reply.code(403).send({ error: { code: 'admin_forbidden' } });
    });

    const response = await deleteTeam('platform-edge');

    expect(response.statusCode).toBe(403);
    expect(mocks.lockTeam).not.toHaveBeenCalled();
    expect(mocks.teamDelete).not.toHaveBeenCalled();
  });

  it('404s an unknown team with the standard error envelope', async () => {
    mocks.lockTeam.mockResolvedValue([]);

    const response = await deleteTeam('missing');

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('team_not_found');
    expect(response.json().request_id).toBe(response.headers['x-request-id']);
    expect(mocks.teamDelete).not.toHaveBeenCalled();
  });

  it('409s repository-managed teams without deleting them', async () => {
    mocks.lockTeam.mockResolvedValue([{ managementSource: 'repository' }]);

    const response = await deleteTeam('platform-identity');

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('repository_managed_team');
    expect(mocks.teamDelete).not.toHaveBeenCalled();
  });

  it('409s a team that still owns services and names them', async () => {
    mocks.serviceFindMany.mockResolvedValue([{ id: 'svc-auth-001', name: 'Auth Gateway' }]);

    const response = await deleteTeam('platform-edge');

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      error: {
        code: 'team_has_services',
        message: 'This team still owns 1 service. Reassign or delete them first.',
        details: { services: [{ id: 'svc-auth-001', name: 'Auth Gateway' }] },
      },
    });
    expect(response.json().request_id).toBe(response.headers['x-request-id']);
    expect(mocks.teamDelete).not.toHaveBeenCalled();
  });
});
