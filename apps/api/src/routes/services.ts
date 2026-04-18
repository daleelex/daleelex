import type { FastifyInstance } from 'fastify';
import type { ServiceListResponse } from '@daleelex/shared';
import { prisma } from '../db.js';

export async function servicesRoute(app: FastifyInstance) {
  app.get('/services', async (): Promise<ServiceListResponse> => {
    const rows = await prisma.service.findMany({
      where: { deletedAt: null },
      include: {
        owner: true,
        links: true,
      },
      orderBy: [{ tier: 'asc' }, { name: 'asc' }],
    });

    const data = rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.type as any,
      tier: row.tier as any,
      lifecycle: row.lifecycle as any,
      ownerTeamId: row.ownerTeamId,
      owner: row.owner
        ? {
            id: row.owner.id,
            name: row.owner.name,
            slackChannel: row.owner.slackChannel,
            onCallSchedule: row.owner.onCallSchedule,
          }
        : null,
      language: row.language,
      repository: row.repository,
      sloTarget: row.sloTarget,
      sloWindow: row.sloWindow,
      tags: row.tags,
      links: row.links.map((l) => ({
        id: l.id,
        url: l.url,
        title: l.title,
        type: l.type as any,
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));

    return { data, total: data.length };
  });
}
