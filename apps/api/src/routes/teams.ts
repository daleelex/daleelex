import type { FastifyInstance } from 'fastify';
import type { TeamListResponse } from '@daleelex/shared';
import { prisma } from '../db.js';

export async function teamsRoute(app: FastifyInstance) {
  app.get('/teams', async (): Promise<TeamListResponse> => {
    const teams = await prisma.team.findMany({
      include: {
        services: {
          where: { deletedAt: null },
          select: { id: true, name: true, type: true, tier: true },
          orderBy: [{ tier: 'asc' }, { name: 'asc' }],
        },
      },
      orderBy: { name: 'asc' },
    });

    const data = teams.map((team) => ({
      id: team.id,
      name: team.name,
      slackChannel: team.slackChannel,
      onCallSchedule: team.onCallSchedule,
      serviceCount: team.services.length,
      tier1Count: team.services.filter((s) => s.tier === 1).length,
      tier2Count: team.services.filter((s) => s.tier === 2).length,
      tier3Count: team.services.filter((s) => s.tier === 3).length,
      topServices: team.services.slice(0, 4).map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type as any,
        tier: s.tier as any,
      })),
    }));

    return { data, total: data.length };
  });
}
