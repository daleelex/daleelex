import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  teamCreate: vi.fn(),
  requireClerkAdmin: vi.fn(),
}));

vi.mock('./db.js', () => ({
  prisma: {
    team: { create: mocks.teamCreate },
  },
}));

vi.mock('./clerkAuth.js', () => ({
  requireClerkAdmin: mocks.requireClerkAdmin,
  requireClerkUser: vi.fn(),
}));

import { teamsRoute } from './routes/teams.js';

describe('POST /api/v1/teams', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireClerkAdmin.mockImplementation(async (request: { clerkUserId?: string }) => {
      request.clerkUserId = 'admin-1';
    });
  });

  it('creates a normalized portal-managed team with empty calculated stats', async () => {
    mocks.teamCreate.mockResolvedValue({
      id: 'platform-edge',
      name: 'Platform Edge',
      slackChannel: '#platform-edge',
      onCallSchedule: 'PD-SCHED-42',
      managementSource: 'portal',
      services: [],
    });
    const app = Fastify();
    await app.register(teamsRoute, { prefix: '/api/v1' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/teams',
      payload: {
        id: 'platform-edge',
        name: ' Platform Edge ',
        slackChannel: '#platform-edge',
        onCallSchedule: ' PD-SCHED-42 ',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      id: 'platform-edge',
      managementSource: 'portal',
      serviceCount: 0,
      averageScorecardHealth: null,
    });
    expect(mocks.teamCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          id: 'platform-edge',
          name: 'Platform Edge',
          slackChannel: '#platform-edge',
          onCallSchedule: 'PD-SCHED-42',
          managementSource: 'portal',
        },
      }),
    );
  });

  it('rejects authenticated non-admin callers before creating a team', async () => {
    mocks.requireClerkAdmin.mockImplementationOnce(async (_request, reply) => {
      return reply.code(403).send({ error: { code: 'admin_forbidden' } });
    });
    const app = Fastify();
    await app.register(teamsRoute, { prefix: '/api/v1' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/teams',
      payload: { id: 'platform-edge', name: 'Platform Edge' },
    });

    expect(response.statusCode).toBe(403);
    expect(mocks.teamCreate).not.toHaveBeenCalled();
  });

  it('returns a 422 envelope for invalid IDs and Slack channel shapes', async () => {
    const app = Fastify();
    await app.register(teamsRoute, { prefix: '/api/v1' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/teams',
      payload: { id: 'Platform Edge', name: 'Platform Edge', slackChannel: 'platform-edge' },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('validation_failed');
    expect(response.json().request_id).toBe(response.headers['x-request-id']);
    expect(mocks.teamCreate).not.toHaveBeenCalled();
  });

  it('returns the standard conflict envelope when the immutable ID exists', async () => {
    mocks.teamCreate.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));
    const app = Fastify();
    await app.register(teamsRoute, { prefix: '/api/v1' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/teams',
      payload: { id: 'platform-edge', name: 'Platform Edge' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      error: {
        code: 'team_id_conflict',
        details: { id: 'platform-edge' },
      },
    });
    expect(response.json().request_id).toBe(response.headers['x-request-id']);
  });
});
