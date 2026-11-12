import type { FastifyInstance } from 'fastify';
import type { ServiceScorecardResponse } from '@daleelex/shared';
import { sendApiError } from '../apiError.js';
import { prisma } from '../db.js';
import { buildServiceScorecard, type LatestCheckRow } from '../scorecard.js';

export async function serviceScorecardRoute(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>(
    '/services/:id/scorecard',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          additionalProperties: false,
          properties: { id: { type: 'string', minLength: 1, maxLength: 200 } },
        },
      },
    },
    async (req, reply): Promise<ServiceScorecardResponse | void> => {
      const service = await prisma.service.findFirst({
        where: { id: req.params.id, deletedAt: null },
        select: { id: true },
      });
      if (!service) {
        return sendApiError(
          req,
          reply,
          404,
          'service_not_found',
          `Service "${req.params.id}" not found.`,
        );
      }

      // DISTINCT ON keeps this on the (service_id, check_id, ran_at DESC)
      // index: the newest row per check, never the whole history.
      const rows = await prisma.$queryRaw<LatestCheckRow[]>`
        SELECT * FROM (
          SELECT DISTINCT ON (r.check_id)
            r.check_id AS "checkId",
            c.label,
            c.category,
            c.weight,
            c.enabled,
            r.status,
            r.message,
            r.ran_at   AS "ranAt"
          FROM scorecard_results r
          JOIN scorecard_checks c ON c.id = r.check_id
          WHERE r.service_id = ${service.id}
          ORDER BY r.check_id, r.ran_at DESC
        ) latest
        WHERE latest.enabled
      `;

      return buildServiceScorecard(service.id, rows);
    },
  );
}
