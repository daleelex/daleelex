import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

const ADMIN_TOKEN_ENV = 'DALEELEX_ADMIN_API_TOKEN';

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const configuredToken = process.env[ADMIN_TOKEN_ENV];

  if (!configuredToken) {
    return reply.code(403).send({
      error: {
        code: 'admin_auth_not_configured',
        message: `${ADMIN_TOKEN_ENV} is not configured; catalog mutations are disabled.`,
        details: {},
      },
    });
  }

  const token = readBearerToken(req.headers.authorization);

  if (!token) {
    return reply.code(401).send({
      error: {
        code: 'missing_admin_token',
        message: 'Catalog mutations require an admin bearer token.',
        details: {},
      },
    });
  }

  if (!tokensMatch(token, configuredToken)) {
    return reply.code(403).send({
      error: {
        code: 'admin_forbidden',
        message: 'The supplied token is not authorized to mutate the catalog.',
        details: {},
      },
    });
  }
}

function readBearerToken(header: string | undefined) {
  const [scheme, token] = header?.split(' ') ?? [];
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

function tokensMatch(candidate: string, expected: string) {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);

  return (
    candidateBuffer.length === expectedBuffer.length &&
    timingSafeEqual(candidateBuffer, expectedBuffer)
  );
}
