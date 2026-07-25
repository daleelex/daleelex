import { verifyToken } from '@clerk/backend';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { readBearerToken } from './auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    clerkUserId?: string;
  }
}

export async function requireClerkUser(req: FastifyRequest, reply: FastifyReply) {
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
    const { sub } = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    req.clerkUserId = sub;
  } catch {
    return reply.code(401).send({
      error: {
        code: 'invalid_session_token',
        message: 'The session token is invalid or expired.',
        details: {},
      },
    });
  }
}
