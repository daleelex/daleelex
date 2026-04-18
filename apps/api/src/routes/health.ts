import type { FastifyInstance } from 'fastify';
import type { HealthResponse } from '@daleelex/shared';

export async function healthRoute(app: FastifyInstance) {
  app.get('/health', async (): Promise<HealthResponse> => {
    return { status: 'ok', version: '0.0.1' };
  });
}
