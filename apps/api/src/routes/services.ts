import type { FastifyInstance } from 'fastify';
import type {
  ServiceListResponse,
  Service,
  CreateServiceRequest,
  UpdateServiceRequest,
} from '@daleelex/shared';
import { prisma } from '../db.js';
import { requireClerkAdmin } from '../clerkAuth.js';

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
          managementSource: (row as any).owner.managementSource,
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
    managementSource: row.managementSource as 'portal' | 'repository',
  };
}

export async function servicesRoute(app: FastifyInstance) {
  app.post<{ Body: CreateServiceRequest }>(
    '/services',
    {
      preHandler: requireClerkAdmin,
      schema: {
        body: {
          type: 'object',
          required: ['id', 'name', 'type', 'tier', 'lifecycle'],
          properties: {
            id: { type: 'string', minLength: 1 },
            name: { type: 'string', minLength: 1 },
            type: { type: 'string', enum: ['api', 'db', 'web', 'ml', 'tool'] },
            tier: { type: 'number', enum: [1, 2, 3] },
            lifecycle: { type: 'string', enum: ['production', 'beta', 'deprecated'] },
            ownerTeamId: { type: 'string' },
            description: { type: 'string' },
            language: { type: 'string' },
            repository: { type: 'string' },
          },
        },
      },
    },
    async (req, reply): Promise<Service> => {
      const { id, name, type, tier, lifecycle, ownerTeamId, description, language, repository } =
        req.body;
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
            managementSource: 'portal',
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

  app.patch<{ Params: { id: string }; Body: UpdateServiceRequest }>(
    '/services/:id',
    {
      preHandler: requireClerkAdmin,
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', minLength: 1 } },
        },
        body: {
          type: 'object',
          required: [
            'name',
            'type',
            'tier',
            'lifecycle',
            'ownerTeamId',
            'description',
            'language',
            'repository',
            'sloTarget',
            'sloWindow',
            'tags',
          ],
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 200 },
            type: { type: 'string', enum: ['api', 'db', 'web', 'ml', 'tool'] },
            tier: { type: 'number', enum: [1, 2, 3] },
            lifecycle: { type: 'string', enum: ['production', 'beta', 'deprecated'] },
            ownerTeamId: { anyOf: [{ type: 'string', minLength: 1 }, { type: 'null' }] },
            description: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            language: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            repository: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            sloTarget: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            sloWindow: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            tags: {
              type: 'array',
              maxItems: 50,
              items: { type: 'string', minLength: 1, maxLength: 64 },
            },
          },
        },
      },
    },
    async (req, reply): Promise<Service | void> => {
      const existing = await prisma.service.findFirst({
        where: { id: req.params.id, deletedAt: null },
        select: { id: true, managementSource: true, repository: true },
      });
      if (!existing) {
        return reply.code(404).send({
          error: {
            code: 'service_not_found',
            message: `Service "${req.params.id}" not found.`,
            details: {},
          },
        });
      }
      if (existing.managementSource === 'repository') {
        return reply.code(409).send({
          error: {
            code: 'repository_managed_service',
            message: 'This service is managed in its source repository.',
            details: { repository: existing.repository },
          },
        });
      }

      try {
        const row = await prisma.service.update({
          where: { id: existing.id },
          data: {
            ...req.body,
            name: req.body.name.trim(),
            description: req.body.description?.trim() || null,
            language: req.body.language?.trim() || null,
            repository: req.body.repository?.trim() || null,
            sloTarget: req.body.sloTarget?.trim() || null,
            sloWindow: req.body.sloWindow?.trim() || null,
            tags: [...new Set(req.body.tags.map((tag) => tag.trim()).filter(Boolean))],
          },
          include: { owner: true, links: true },
        });
        return toServiceShape(row);
      } catch (err: any) {
        if (err.code === 'P2003') {
          return reply.code(422).send({
            error: {
              code: 'team_not_found',
              message: `Team "${req.body.ownerTeamId}" does not exist.`,
              details: {},
            },
          });
        }
        throw err;
      }
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/services/:id',
    {
      preHandler: requireClerkAdmin,
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
      },
    },
    async (req, reply) => {
      const existing = await prisma.service.findFirst({
        where: { id: req.params.id, deletedAt: null },
        select: { id: true, managementSource: true, repository: true },
      });
      if (!existing) {
        reply.code(404);
        throw new Error(`Service "${req.params.id}" not found.`);
      }
      if (existing.managementSource === 'repository') {
        return reply.code(409).send({
          error: {
            code: 'repository_managed_service',
            message: 'This service is managed in its source repository.',
            details: { repository: existing.repository },
          },
        });
      }
      await prisma.service.update({
        where: { id: req.params.id },
        data: { deletedAt: new Date() },
      });
      reply.code(204).send();
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
