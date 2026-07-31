import { createClerkClient, verifyToken } from '@clerk/backend';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { readBearerToken } from './auth.js';
import { sendApiError } from './apiError.js';

declare module 'fastify' {
  interface FastifyRequest {
    clerkUserId?: string;
  }
}

const SECRET_KEY_ENV = 'CLERK_SECRET_KEY';

export async function requireClerkUser(req: FastifyRequest, reply: FastifyReply) {
  const secretKey = process.env[SECRET_KEY_ENV];

  if (!secretKey) {
    req.log.error(`${SECRET_KEY_ENV} is not configured; no session token can be verified.`);
    return sendApiError(
      req,
      reply,
      503,
      'clerk_auth_not_configured',
      'Sign-in is not configured on this server; signed-in actions are disabled.',
    );
  }

  const token = readBearerToken(req.headers.authorization);

  if (!token) {
    return sendApiError(
      req,
      reply,
      401,
      'missing_session_token',
      'This endpoint requires a Clerk session bearer token.',
    );
  }

  try {
    const { sub } = await verifyToken(token, { secretKey });
    req.clerkUserId = sub;
  } catch (err) {
    req.log.warn({ err }, 'Clerk session token verification failed');
    return sendApiError(
      req,
      reply,
      401,
      'invalid_session_token',
      'The session token is invalid or expired.',
    );
  }
}

export async function requireClerkAdmin(req: FastifyRequest, reply: FastifyReply) {
  await requireClerkUser(req, reply);
  if (reply.sent || !req.clerkUserId) return;

  const secretKey = process.env[SECRET_KEY_ENV]!;

  try {
    const user = await createClerkClient({ secretKey }).users.getUser(req.clerkUserId);
    if (user.publicMetadata.role !== 'admin') {
      return sendApiError(
        req,
        reply,
        403,
        'admin_forbidden',
        'This action requires an administrator account.',
      );
    }
  } catch (err) {
    req.log.error({ err, clerkUserId: req.clerkUserId }, 'Clerk admin authorization failed');
    return sendApiError(
      req,
      reply,
      503,
      'admin_authorization_unavailable',
      'Administrator authorization could not be verified.',
    );
  }
}
