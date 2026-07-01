import type { FastifyInstance } from 'fastify';
import type { ServiceListResponse, Service, CreateServiceRequest } from '@daleelex/shared';
import { prisma } from '../db.js';

function toServiceShape(row: Awaited<ReturnType<typeof prisma.service.findFirstOrThrow>>): Service {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type as any,
    tier: row.tier as any,
    lifecycle: row.lifecycle as any,
    ownerTeamId: row.ownerTeamId,
    owner: (row as any).owner
      ? {
          id: (row as any).owner.id,
          name: (row as any).owner.name,
          slackChannel: (row as any).owner.slackChannel,
          onCallSchedule: (row as any).owner.onCallSchedule,
        }
      : null,
    language: row.language,
    repository: row.repository,
    sloTarget: row.sloTarget,
    sloWindow: row.sloWindow,
    tags: row.tags,
    links: ((row as any).links ?? []).map((l: any) => ({
      id: l.id,
      url: l.url,
      title: l.title,
      type: l.type as any,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function servicesRoute(app: FastifyInstance) {
  app.post<{ Body: CreateServiceRequest }>(
    '/services',
    {
      schema: {
        body: {
          type: 'object',
          required: ['id', 'name', 'type', 'tier', 'lifecycle'],
          properties: {
            id:          { type: 'string', minLength: 1 },
            name:        { type: 'string', minLength: 1 },
            type:        { type: 'string', enum: ['api', 'db', 'web', 'ml', 'tool'] },
            tier:        { type: 'number', enum: [1, 2, 3] },
            lifecycle:   { type: 'string', enum: ['production', 'beta', 'deprecated'] },
            ownerTeamId: { type: 'string' },
            description: { type: 'string' },
            language:    { type: 'string' },
            repository:  { type: 'string' },
          },
        },
      },
    },
    async (req, reply): Promise<Service> => {
      const { id, name, type, tier, lifecycle, ownerTeamId, description, language, repository } = req.body;
      try {
        const row = await prisma.service.create({
          data: {
            id,
            name,
            type,
            tier,
            lifecycle,
            ownerTeamId: ownerTeamId || null,
            description: description || null,
            language: language || null,
            repository: repository || null,
            tags: [],
          },
          include: { owner: true, links: true },
        });
        reply.code(201);
        return toServiceShape(row);
      } catch (err: any) {
        if (err.code === 'P2002') {
          reply.code(409);
          throw new Error(`A service with ID "${id}" already exists.`);
        }
        if (err.code === 'P2003') {
          reply.code(422);
          throw new Error(`Team "${ownerTeamId}" does not exist.`);
        }
        throw err;
      }
    },
  );

  app.get('/services', async (): Promise<ServiceListResponse> => {
    const rows = await prisma.service.findMany({
      where: { deletedAt: null },
      include: {
        owner: true,
        links: true,
      },
      orderBy: [{ tier: 'asc' }, { name: 'asc' }],
    });

    const data = rows.map(toServiceShape);

    return { data, total: data.length };
  });
}
