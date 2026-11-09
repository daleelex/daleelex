import type { FastifyInstance } from 'fastify';
import type { AddTeamMemberRequest, TeamMember, TeamMemberListResponse } from '@daleelex/shared';
import { prisma } from '../db.js';
import { requireClerkAdmin, requireClerkUser } from '../clerkAuth.js';
import { sendApiError } from '../apiError.js';

const teamParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', minLength: 1, maxLength: 100 } },
} as const;

const userSelect = { id: true, email: true, name: true, avatarUrl: true } as const;

interface MembershipRow {
  createdAt: Date;
  user: { id: string; email: string; name: string | null; avatarUrl: string | null };
}

function toTeamMember({ createdAt, user }: MembershipRow): TeamMember {
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    addedAt: createdAt.toISOString(),
  };
}

// Membership is managed by admins in the portal, whichever source manages the team
// itself: catalog-info.yaml has no notion of people, so there is nothing to sync.
export async function teamMembersRoute(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>(
    '/teams/:id/members',
    { preHandler: requireClerkUser, schema: { params: teamParams } },
    async (req, reply): Promise<TeamMemberListResponse | void> => {
      const team = await prisma.team.findUnique({
        where: { id: req.params.id },
        select: {
          members: {
            select: { createdAt: true, user: { select: userSelect } },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      if (!team) {
        return sendApiError(
          req,
          reply,
          404,
          'team_not_found',
          `Team "${req.params.id}" not found.`,
        );
      }

      const data = team.members.map(toTeamMember);
      return { data, total: data.length };
    },
  );

  app.post<{ Params: { id: string }; Body: AddTeamMemberRequest }>(
    '/teams/:id/members',
    {
      preHandler: requireClerkAdmin,
      attachValidation: true,
      schema: {
        params: teamParams,
        body: {
          type: 'object',
          required: ['email'],
          additionalProperties: false,
          properties: { email: { type: 'string', minLength: 3, maxLength: 320, pattern: '@' } },
        },
      },
    },
    async (req, reply): Promise<TeamMember | void> => {
      if (req.validationError) {
        return sendApiError(
          req,
          reply,
          422,
          'validation_failed',
          'The member request is invalid.',
          {
            issues: req.validationError.validation ?? [],
          },
        );
      }

      const email = req.body.email.trim();
      const [team, user] = await Promise.all([
        prisma.team.findUnique({ where: { id: req.params.id }, select: { id: true } }),
        prisma.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
          select: userSelect,
        }),
      ]);
      if (!team) {
        return sendApiError(
          req,
          reply,
          404,
          'team_not_found',
          `Team "${req.params.id}" not found.`,
        );
      }
      // Users rows are created on first sign-in, so someone who never signed in
      // cannot be added yet. Say so, rather than a bare "not found".
      if (!user) {
        return sendApiError(
          req,
          reply,
          404,
          'user_not_found',
          `No DaleelEx user has the email "${email}". They need to sign in once before they can be added.`,
          { email },
        );
      }

      try {
        const membership = await prisma.teamMembership.create({
          data: { teamId: team.id, userId: user.id },
          select: { createdAt: true },
        });
        reply.code(201);
        return toTeamMember({ createdAt: membership.createdAt, user });
      } catch (err) {
        if (hasPrismaCode(err, 'P2002')) {
          return sendApiError(
            req,
            reply,
            409,
            'team_member_exists',
            `${email} is already a member of this team.`,
            { userId: user.id },
          );
        }
        throw err;
      }
    },
  );

  app.delete<{ Params: { id: string; userId: string } }>(
    '/teams/:id/members/:userId',
    {
      preHandler: requireClerkAdmin,
      schema: {
        params: {
          type: 'object',
          required: ['id', 'userId'],
          properties: {
            id: { type: 'string', minLength: 1, maxLength: 100 },
            userId: { type: 'string', minLength: 1, maxLength: 200 },
          },
        },
      },
    },
    async (req, reply) => {
      const { count } = await prisma.teamMembership.deleteMany({
        where: { teamId: req.params.id, userId: req.params.userId },
      });
      if (count === 0) {
        return sendApiError(
          req,
          reply,
          404,
          'team_member_not_found',
          `User "${req.params.userId}" is not a member of team "${req.params.id}".`,
        );
      }
      reply.code(204).send();
    },
  );
}

function hasPrismaCode(error: unknown, code: string) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}
