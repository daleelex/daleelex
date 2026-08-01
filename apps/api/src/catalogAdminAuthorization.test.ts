import Fastify from 'fastify';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const clerkMocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  getUser: vi.fn(),
}));

const dbMocks = vi.hoisted(() => ({
  serviceCreate: vi.fn(),
  serviceFindFirst: vi.fn(),
  serviceUpdate: vi.fn(),
  teamFindUnique: vi.fn(),
  teamFindUniqueOrThrow: vi.fn(),
  teamUpdate: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock('@clerk/backend', () => ({
  verifyToken: clerkMocks.verifyToken,
  createClerkClient: () => ({ users: { getUser: clerkMocks.getUser } }),
}));

vi.mock('./db.js', () => ({
  prisma: {
    service: {
      create: dbMocks.serviceCreate,
      findFirst: dbMocks.serviceFindFirst,
      update: dbMocks.serviceUpdate,
    },
    team: {
      findUnique: dbMocks.teamFindUnique,
      findUniqueOrThrow: dbMocks.teamFindUniqueOrThrow,
      update: dbMocks.teamUpdate,
    },
    $queryRaw: dbMocks.queryRaw,
  },
}));

import { servicesRoute } from './routes/services.js';
import { teamsRoute } from './routes/teams.js';

const ENV_KEY = 'CLERK_SECRET_KEY';
const previousSecretKey = process.env[ENV_KEY];

const serviceUpdateBody = {
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

const serviceRow = {
  id: 'svc-1',
  ...serviceUpdateBody,
  tags: ['critical'],
  owner: null,
  links: [],
  managementSource: 'portal',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

const teamRow = {
  id: 'team-1',
  name: 'Updated team',
  slackChannel: '#platform',
  onCallSchedule: null,
  managementSource: 'portal',
  services: [],
};

interface MutationCase {
  name: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  url: string;
  payload?: Record<string, unknown>;
  successStatus: number;
  mutation: Mock;
}

const mutationCases: MutationCase[] = [
  {
    name: 'POST /api/v1/services',
    method: 'POST',
    url: '/api/v1/services',
    payload: {
      id: 'svc-1',
      name: 'Updated service',
      type: 'api',
      tier: 1,
      lifecycle: 'production',
    },
    successStatus: 201,
    mutation: dbMocks.serviceCreate,
  },
  {
    name: 'PATCH /api/v1/services/:id',
    method: 'PATCH',
    url: '/api/v1/services/svc-1',
    payload: serviceUpdateBody,
    successStatus: 200,
    mutation: dbMocks.serviceUpdate,
  },
  {
    name: 'DELETE /api/v1/services/:id',
    method: 'DELETE',
    url: '/api/v1/services/svc-1',
    successStatus: 204,
    mutation: dbMocks.serviceUpdate,
  },
  {
    name: 'PATCH /api/v1/teams/:id',
    method: 'PATCH',
    url: '/api/v1/teams/team-1',
    payload: {
      name: 'Updated team',
      slackChannel: '#platform',
      onCallSchedule: null,
    },
    successStatus: 200,
    mutation: dbMocks.teamUpdate,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  process.env[ENV_KEY] = 'sk_test_route_authorization';

  clerkMocks.verifyToken.mockResolvedValue({ sub: 'user-1' });
  dbMocks.serviceCreate.mockResolvedValue(serviceRow);
  dbMocks.serviceFindFirst.mockResolvedValue({
    id: 'svc-1',
    managementSource: 'portal',
    repository: null,
  });
  dbMocks.serviceUpdate.mockResolvedValue(serviceRow);
  dbMocks.teamFindUnique.mockResolvedValue({
    id: 'team-1',
    managementSource: 'portal',
  });
  dbMocks.teamFindUniqueOrThrow.mockResolvedValue(teamRow);
  dbMocks.teamUpdate.mockResolvedValue(teamRow);
  dbMocks.queryRaw.mockResolvedValue([]);
});

afterEach(() => {
  if (previousSecretKey === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = previousSecretKey;
});

describe('catalog mutation authorization', () => {
  it.each(mutationCases)('$name returns 401 for an unauthenticated request', async (testCase) => {
    const app = await buildApp();

    const response = await app.inject({
      method: testCase.method,
      url: testCase.url,
      payload: testCase.payload,
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('missing_session_token');
    expect(response.json().request_id).toBe(response.headers['x-request-id']);
    expect(testCase.mutation).not.toHaveBeenCalled();
    await app.close();
  });

  it.each(mutationCases)('$name returns 403 for an authenticated non-admin', async (testCase) => {
    clerkMocks.getUser.mockResolvedValue({ publicMetadata: { role: 'member' } });
    const app = await buildApp();

    const response = await app.inject({
      method: testCase.method,
      url: testCase.url,
      payload: testCase.payload,
      headers: { authorization: 'Bearer member-session' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('admin_forbidden');
    expect(response.json().request_id).toBe(response.headers['x-request-id']);
    expect(testCase.mutation).not.toHaveBeenCalled();
    await app.close();
  });

  it.each(mutationCases)('$name succeeds for an authenticated admin', async (testCase) => {
    clerkMocks.getUser.mockResolvedValue({ publicMetadata: { role: 'admin' } });
    const app = await buildApp();

    const response = await app.inject({
      method: testCase.method,
      url: testCase.url,
      payload: testCase.payload,
      headers: { authorization: 'Bearer admin-session' },
    });

    expect(response.statusCode).toBe(testCase.successStatus);
    expect(testCase.mutation).toHaveBeenCalledOnce();
    await app.close();
  });
});

async function buildApp() {
  const app = Fastify();
  await app.register(servicesRoute, { prefix: '/api/v1' });
  await app.register(teamsRoute, { prefix: '/api/v1' });
  return app;
}
