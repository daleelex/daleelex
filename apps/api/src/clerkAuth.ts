import { verifyToken } from '@clerk/backend';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { readBearerToken } from './auth.js';

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
    return reply.code(503).send({
      error: {
        code: 'clerk_auth_not_configured',
        message: 'Sign-in is not configured on this server; signed-in actions are disabled.',
        details: {},
      },
    });
  }

  const token = readBearerToken(req.headers.authorization);

  if (!token) {
    return reply.code(401).send({
      error: {
        code: 'missing_session_token',
        message: 'This endpoint requires a Clerk session bearer token.',
        details: {},
      },
    });
  }

  try {
    const { sub } = await verifyToken(token, { secretKey });
    req.clerkUserId = sub;
  } catch (err) {
    // Logged because the 401 body deliberately says nothing about *why*: a key from the
    // wrong Clerk instance and a genuinely expired token are indistinguishable to the
    // caller, and only the server log can tell them apart.
    req.log.warn({ err }, 'Clerk session token verification failed');
    return reply.code(401).send({
      error: {
        code: 'invalid_session_token',
        message: 'The session token is invalid or expired.',
        details: {},
      },
    });
  }
}
