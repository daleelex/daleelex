import type { FastifyInstance } from 'fastify';
import type { ServiceLogListResponse } from '@daleelex/shared';
import { sendApiError } from '../apiError.js';
import { isClerkAdmin, requireClerkUser } from '../clerkAuth.js';
import { prisma } from '../db.js';
import {
  canViewLogs,
  InvalidLogCursorError,
  LogSourceUnavailableError,
  type LogSource,
  type LogViewer,
} from '../logs/logSource.js';

interface ServiceLogsRouteOptions {
  logSource: LogSource;
}

interface ServiceLogsQuerystring {
  start: string;
  end: string;
  search?: string;
  cursor?: string;
  limit: number;
}

const UTC_DATE_TIME_PATTERN = '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?Z$';

export async function serviceLogsRoute(app: FastifyInstance, options: ServiceLogsRouteOptions) {
  app.get<{ Params: { id: string }; Querystring: ServiceLogsQuerystring }>(
    '/services/:id/logs',
    {
      preHandler: requireClerkUser,
      attachValidation: true,
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          additionalProperties: false,
          properties: { id: { type: 'string', minLength: 1, maxLength: 200 } },
        },
        querystring: {
          type: 'object',
          required: ['start', 'end'],
          additionalProperties: false,
          properties: {
            start: { type: 'string', format: 'date-time', pattern: UTC_DATE_TIME_PATTERN },
            end: { type: 'string', format: 'date-time', pattern: UTC_DATE_TIME_PATTERN },
            search: { type: 'string', minLength: 1, maxLength: 200 },
            cursor: { type: 'string', minLength: 1, maxLength: 4096 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          },
        },
      },
    },
    async (req, reply): Promise<ServiceLogListResponse | void> => {
      if (req.validationError) {
        return sendApiError(req, reply, 422, 'validation_failed', 'The log query is invalid.', {
          issues: req.validationError.validation ?? [],
        });
      }

      const startMs = Date.parse(req.query.start);
      const endMs = Date.parse(req.query.end);
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) {
        return sendApiError(
          req,
          reply,
          422,
          'validation_failed',
          'The log query must use a valid UTC range with start before end.',
          { start: req.query.start, end: req.query.end },
        );
      }

      const service = await prisma.service.findFirst({
        where: { id: req.params.id, deletedAt: null },
        select: { id: true, ownerTeamId: true },
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

      // Membership is one indexed lookup; only the owning team matters, so that is
      // the only one fetched. Members are let through without asking Clerk at all,
      // which also keeps them reading logs while Clerk is unreachable.
      const membership = service.ownerTeamId
        ? await prisma.teamMembership.findUnique({
            where: { teamId_userId: { teamId: service.ownerTeamId, userId: req.clerkUserId! } },
            select: { teamId: true },
          })
        : null;
      let viewer: LogViewer = {
        id: req.clerkUserId!,
        isAdmin: false,
        teamIds: membership ? [membership.teamId] : [],
      };

      if (!canViewLogs(viewer, service)) {
        try {
          viewer = { ...viewer, isAdmin: await isClerkAdmin(viewer.id) };
        } catch (err) {
          req.log.error({ err, clerkUserId: req.clerkUserId }, 'Clerk admin lookup failed');
          return sendApiError(
            req,
            reply,
            503,
            'admin_authorization_unavailable',
            'Log access could not be verified.',
          );
        }
      }

      if (!canViewLogs(viewer, service)) {
        return sendApiError(
          req,
          reply,
          403,
          'logs_forbidden',
          service.ownerTeamId
            ? "Service logs are visible to the owning team's members and administrators."
            : 'Logs for a service with no owning team are visible to administrators only.',
        );
      }

      try {
        const page = await options.logSource.query({
          selector: { serviceId: service.id },
          start: req.query.start,
          end: req.query.end,
          search: req.query.search,
          cursor: req.query.cursor,
          limit: req.query.limit,
        });

        return { data: page.entries, next_cursor: page.nextCursor };
      } catch (error) {
        if (error instanceof InvalidLogCursorError) {
          return sendApiError(req, reply, 422, 'invalid_cursor', error.message);
        }
        if (error instanceof LogSourceUnavailableError) {
          req.log.error({ err: error }, 'Log backend query failed');
          return sendApiError(req, reply, 502, 'log_source_unavailable', error.message);
        }
        throw error;
      }
    },
  );
}
