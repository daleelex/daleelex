import type { FastifyInstance } from 'fastify';
import type { StatsResponse } from '@daleelex/shared';
import { prisma } from '../db.js';

export async function statsRoute(app: FastifyInstance) {
  app.get('/stats', async (): Promise<StatsResponse> => {
    const [teamCount, serviceCount, docCount] = await Promise.all([
      prisma.team.count(),
      prisma.service.count({ where: { deletedAt: null } }),
      prisma.serviceDoc.count({ where: { service: { deletedAt: null } } }),
    ]);

    return { teamCount, serviceCount, docCount };
  });
}
