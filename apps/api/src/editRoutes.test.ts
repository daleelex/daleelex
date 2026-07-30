import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  serviceFindFirst: vi.fn(),
  serviceUpdate: vi.fn(),
  teamFindUnique: vi.fn(),
  teamFindUniqueOrThrow: vi.fn(),
  teamUpdate: vi.fn(),
  serviceDocFindFirst: vi.fn(),
  serviceDocUpdate: vi.fn(),
}));

vi.mock('./db.js', () => ({
  prisma: {
    service: {
      findFirst: mocks.serviceFindFirst,
      update: mocks.serviceUpdate,
    },
    team: {
      findUnique: mocks.teamFindUnique,
      findUniqueOrThrow: mocks.teamFindUniqueOrThrow,
      update: mocks.teamUpdate,
    },
    serviceDoc: {
      findFirst: mocks.serviceDocFindFirst,
      update: mocks.serviceDocUpdate,
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('./clerkAuth.js', () => ({
  requireClerkUser: async (request: { clerkUserId?: string }) => {
    request.clerkUserId = 'user-1';
  },
}));

import { servicesRoute } from './routes/services.js';
import { docsRoute } from './routes/docs.js';
import { teamsRoute } from './routes/teams.js';

const updateBody = {
  name: 'Updated service',
  type: 'api',
  tier: 1,
  lifecycle: 'production',
  ownerTeamId: null,
  description: null,
  language: 'TypeScript',
  repository: null,
  sloTarget: '99.9%',
  sloWindow: '30d',
  tags: ['critical'],
};

describe('editing routes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates a portal-managed service without allowing its id to change', async () => {
    mocks.serviceFindFirst.mockResolvedValue({
      id: 'svc-1',
      managementSource: 'portal',
      repository: null,
    });
    mocks.serviceUpdate.mockResolvedValue({
      id: 'svc-1',
      ...updateBody,
      owner: null,
      links: [],
      managementSource: 'portal',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02'),
    });
    const app = Fastify();
    await app.register(servicesRoute, { prefix: '/api/v1' });

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/services/svc-1',
      payload: updateBody,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: 'svc-1', name: 'Updated service' });
    expect(mocks.serviceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'svc-1' } }),
    );
  });

  it('rejects edits to repository-managed services with a stable code', async () => {
    mocks.serviceFindFirst.mockResolvedValue({
      id: 'svc-1',
      managementSource: 'repository',
      repository: 'acme/service',
    });
    const app = Fastify();
    await app.register(servicesRoute, { prefix: '/api/v1' });

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/services/svc-1',
      payload: updateBody,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('repository_managed_service');
    expect(mocks.serviceUpdate).not.toHaveBeenCalled();
  });

  it('updates a portal-managed team while keeping calculated fields server-owned', async () => {
    mocks.teamFindUnique.mockResolvedValue({
      id: 'team-1',
      name: 'Old',
      managementSource: 'portal',
    });
    mocks.teamUpdate.mockResolvedValue({});
    mocks.teamFindUniqueOrThrow.mockResolvedValue({
      id: 'team-1',
      name: 'New team',
      slackChannel: '#new',
      onCallSchedule: null,
      managementSource: 'portal',
      services: [],
    });
    const app = Fastify();
    await app.register(teamsRoute, { prefix: '/api/v1' });

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/teams/team-1',
      payload: { name: 'New team', slackChannel: '#new', onCallSchedule: null },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: 'team-1',
      name: 'New team',
      serviceCount: 0,
      managementSource: 'portal',
    });
  });

  it('updates an uploaded document and derives its title', async () => {
    const existing = {
      id: 7,
      serviceId: 'svc-1',
      path: 'manual/old.md',
      title: 'Old',
      contentMd: '# Old',
      sourceRepository: null,
      sourceSha: null,
      uploadedByUserId: 'old-user',
      updatedByUserId: null,
      fetchedAt: new Date('2026-01-01'),
    };
    mocks.serviceDocFindFirst.mockResolvedValueOnce(existing).mockResolvedValueOnce(null);
    mocks.serviceDocUpdate.mockResolvedValue({
      ...existing,
      path: 'manual/new.md',
      title: 'New title',
      contentMd: '# New title',
      updatedByUserId: 'user-1',
      fetchedAt: new Date('2026-01-02'),
    });
    const app = Fastify();
    await app.register(docsRoute, { prefix: '/api/v1' });

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/services/svc-1/docs/7',
      payload: {
        filename: 'new.md',
        contentMd: '# New title',
        baseFetchedAt: existing.fetchedAt.toISOString(),
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      path: 'manual/new.md',
      title: 'New title',
      uploadedByUserId: 'old-user',
      updatedByUserId: 'user-1',
    });
    expect(mocks.serviceDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ updatedByUserId: 'user-1' }),
      }),
    );
    // The original uploader must survive an edit.
    expect(mocks.serviceDocUpdate.mock.calls[0][0].data).not.toHaveProperty('uploadedByUserId');
  });

  it('rejects repository-managed document edits', async () => {
    mocks.serviceDocFindFirst.mockResolvedValue({
      id: 7,
      serviceId: 'svc-1',
      sourceRepository: 'acme/service',
      path: 'docs/index.md',
    });
    const app = Fastify();
    await app.register(docsRoute, { prefix: '/api/v1' });

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/services/svc-1/docs/7',
      payload: {
        filename: 'index.md',
        contentMd: '# Changed',
        baseFetchedAt: '2026-01-01T00:00:00.000Z',
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('repository_managed_document');
    expect(mocks.serviceDocUpdate).not.toHaveBeenCalled();
  });
});
