import type { FastifyInstance } from 'fastify';
import type { TeamListResponse, TeamWithStats, UpdateTeamRequest } from '@daleelex/shared';
import { prisma } from '../db.js';
import { buildTeamStats, type ScorecardResultRow } from '../teamStats.js';
import { requireClerkUser } from '../clerkAuth.js';

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
  app.patch<{ Params: { id: string }; Body: UpdateTeamRequest }>(
    '/teams/:id',
    {
      preHandler: requireClerkUser,
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', minLength: 1 } },
        },
        body: {
          type: 'object',
          required: ['name', 'slackChannel', 'onCallSchedule'],
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 200 },
            slackChannel: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            onCallSchedule: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          },
        },
      },
    },
    async (req, reply): Promise<TeamWithStats | void> => {
      const existing = await prisma.team.findUnique({ where: { id: req.params.id } });
      if (!existing) {
        return reply.code(404).send({
          error: {
            code: 'team_not_found',
            message: `Team "${req.params.id}" not found.`,
            details: {},
          },
        });
      }
      if (existing.managementSource === 'repository') {
        return reply.code(409).send({
          error: {
            code: 'repository_managed_team',
            message: 'This team is managed in its source repository.',
            details: {},
          },
        });
      }

      await prisma.team.update({
        where: { id: existing.id },
        data: {
          name: req.body.name.trim(),
          slackChannel: req.body.slackChannel?.trim() || null,
          onCallSchedule: req.body.onCallSchedule?.trim() || null,
        },
      });
      const [team, results] = await Promise.all([
        prisma.team.findUniqueOrThrow({
          where: { id: existing.id },
          include: {
            services: {
              where: { deletedAt: null },
              select: { id: true, name: true, type: true, tier: true },
              orderBy: [{ tier: 'asc' }, { name: 'asc' }],
            },
          },
        }),
        fetchLatestScorecardResults(),
      ]);
      return buildTeamStats([team], results)[0];
    },
  );

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
