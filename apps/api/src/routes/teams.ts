import type { FastifyInstance } from 'fastify';
import type { TeamListResponse } from '@daleelex/shared';
import { prisma } from '../db.js';
import { buildTeamStats, type ScorecardResultRow } from '../teamStats.js';

interface LatestResultRow {
  serviceId: string;
  checkId: string;
  status: string;
  message: string | null;
  ranAt: Date;
  weight: number;
  enabled: boolean;
}

// Prisma's `distinct` dedupes in-memory after fetching every row, so the
// latest-result-per-check query has to be raw SQL to stay on the
// (service_id, check_id, ran_at DESC) index instead of streaming the whole
// results history into the API.
async function fetchLatestScorecardResults(): Promise<ScorecardResultRow[]> {
  const rows = await prisma.$queryRaw<LatestResultRow[]>`
    SELECT DISTINCT ON (r.service_id, r.check_id)
      r.service_id AS "serviceId",
      r.check_id   AS "checkId",
      r.status,
      r.message,
      r.ran_at     AS "ranAt",
      c.weight,
      c.enabled
    FROM scorecard_results r
    JOIN scorecard_checks c ON c.id = r.check_id
    ORDER BY r.service_id, r.check_id, r.ran_at DESC
  `;

  return rows.map(({ weight, enabled, ...row }) => ({ ...row, check: { weight, enabled } }));
}

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
      fetchLatestScorecardResults(),
      prisma.service.count({ where: { deletedAt: null, ownerTeamId: null } }),
    ]);

    const data = buildTeamStats(teams, scorecardResults);
    return { data, total: data.length, unownedServiceCount };
  });
}
