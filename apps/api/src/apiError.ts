import type { FastifyReply, FastifyRequest } from 'fastify';

export function sendApiError(
  req: FastifyRequest,
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  details: Record<string, unknown> = {},
) {
  return reply.header('x-request-id', req.id).code(statusCode).send({
    error: { code, message, details },
    request_id: req.id,
  });
}
