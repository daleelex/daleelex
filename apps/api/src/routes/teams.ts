import type { FastifyInstance } from 'fastify';
import type {
  CreateTeamRequest,
  TeamListResponse,
  TeamWithStats,
  UpdateTeamRequest,
} from '@daleelex/shared';
import { prisma } from '../db.js';
import { buildTeamStats, type ScorecardResultRow } from '../teamStats.js';
import { requireClerkAdmin } from '../clerkAuth.js';
import { sendApiError } from '../apiError.js';

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
  app.post<{ Body: CreateTeamRequest }>(
    '/teams',
    {
      preHandler: requireClerkAdmin,
      attachValidation: true,
      schema: {
        body: {
          type: 'object',
          required: ['id', 'name'],
          additionalProperties: false,
          properties: {
            id: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
            },
            name: { type: 'string', minLength: 1, maxLength: 200, pattern: '\\S' },
            slackChannel: {
              anyOf: [
                {
                  type: 'string',
                  maxLength: 81,
                  pattern: '^#[a-z0-9][a-z0-9_-]{0,79}$',
                },
                { type: 'null' },
              ],
            },
            onCallSchedule: {
              anyOf: [
                { type: 'string', minLength: 1, maxLength: 200, pattern: '\\S' },
                { type: 'null' },
              ],
            },
          },
        },
      },
    },
    async (req, reply): Promise<TeamWithStats | void> => {
      if (req.validationError) {
        return sendApiError(req, reply, 422, 'validation_failed', 'The team request is invalid.', {
          issues: req.validationError.validation ?? [],
        });
      }

      try {
        const team = await prisma.team.create({
          data: {
            id: req.body.id,
            name: req.body.name.trim(),
            slackChannel: req.body.slackChannel?.trim() || null,
            onCallSchedule: req.body.onCallSchedule?.trim() || null,
            managementSource: 'portal',
          },
          include: {
            services: {
              where: { deletedAt: null },
              select: { id: true, name: true, type: true, tier: true },
              orderBy: [{ tier: 'asc' }, { name: 'asc' }],
            },
          },
        });
        reply.code(201);
        return buildTeamStats([team], [])[0];
      } catch (err) {
        if (hasPrismaCode(err, 'P2002')) {
          return sendApiError(
            req,
            reply,
            409,
            'team_id_conflict',
            `A team with ID "${req.body.id}" already exists.`,
            { id: req.body.id },
          );
        }
        throw err;
      }
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateTeamRequest }>(
    '/teams/:id',
    {
      preHandler: requireClerkAdmin,
      attachValidation: true,
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
      if (req.validationError) {
        return sendApiError(req, reply, 422, 'validation_failed', 'The team request is invalid.', {
          issues: req.validationError.validation ?? [],
        });
      }

      const existing = await prisma.team.findUnique({ where: { id: req.params.id } });
      if (!existing) {
        return sendApiError(
          req,
          reply,
          404,
          'team_not_found',
          `Team "${req.params.id}" not found.`,
        );
      }
      if (existing.managementSource === 'repository') {
        return sendApiError(
          req,
          reply,
          409,
          'repository_managed_team',
          'This team is managed in its source repository.',
        );
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

function hasPrismaCode(error: unknown, code: string) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}
