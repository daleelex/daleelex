import type { FastifyInstance } from 'fastify';
import type { TeamListResponse } from '@daleelex/shared';
import { prisma } from '../db.js';
import { buildTeamStats } from '../teamStats.js';

export async function teamsRoute(app: FastifyInstance) {
  app.get('/teams', async (): Promise<TeamListResponse> => {
    const [teams, scorecardResults, unownedServiceCount] = await Promise.all([
      prisma.team.findMany({
        include: {
          services: {
            where: { deletedAt: null },
            select: { id: true, name: true, type: true, tier: true },
            orderBy: [{ tier: 'asc' }, { name: 'asc' }],
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.scorecardResult.findMany({
        include: { check: { select: { weight: true, enabled: true } } },
        orderBy: { ranAt: 'desc' },
        distinct: ['serviceId', 'checkId'],
      }),
      prisma.service.count({ where: { deletedAt: null, ownerTeamId: null } }),
    ]);

    const data = buildTeamStats(teams, scorecardResults);
    return { data, total: data.length, unownedServiceCount };
  });
}
