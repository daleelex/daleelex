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

  // Without the secret key `verifyToken` throws for EVERY token, so a server that is
  // merely misconfigured told users "your session is invalid or expired" — sending them
  // off to re-sign-in, which can't help. Same shape as requireAdmin's
  // admin_auth_not_configured: say it's the server, not the caller.
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
    // Logged because the 401 body deliberately says nothing about *why*: a key from the
    // wrong Clerk instance and a genuinely expired token are indistinguishable to the
    // caller, and only the server log can tell them apart.
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

  try {
    if (!(await isClerkAdmin(req.clerkUserId))) {
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

/**
 * Whether a verified Clerk user holds the admin role. Only call this after
 * requireClerkUser has run — it relies on the secret key that check guarantees.
 * Throws if Clerk cannot be reached; callers decide how to report that.
 */
export async function isClerkAdmin(clerkUserId: string): Promise<boolean> {
  const secretKey = process.env[SECRET_KEY_ENV]!;
  const user = await createClerkClient({ secretKey }).users.getUser(clerkUserId);
  return user.publicMetadata.role === 'admin';
}
