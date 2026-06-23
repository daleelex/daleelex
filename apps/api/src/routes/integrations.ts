import type { FastifyInstance } from 'fastify';
import type { JenkinsHealthResponse } from '@daleelex/shared';
import { checkJenkinsHealth } from '../integrations/jenkins.js';

export async function integrationsRoute(app: FastifyInstance) {
  app.get('/integrations/jenkins/health', async (): Promise<JenkinsHealthResponse> => {
    return checkJenkinsHealth();
  });
}
