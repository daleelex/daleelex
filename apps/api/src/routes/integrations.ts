import type { FastifyInstance } from 'fastify';
import type { JenkinsHealthResponse, JenkinsConfigResponse, JenkinsConfigRequest, JenkinsTestResponse } from '@daleelex/shared';
import {
  JenkinsConfigError,
  checkJenkinsHealth,
  getJenkinsConfig,
  saveJenkinsConfig,
  testJenkinsConnection,
} from '../integrations/jenkins.js';

export async function integrationsRoute(app: FastifyInstance) {
  app.get('/integrations/jenkins/health', async (): Promise<JenkinsHealthResponse> => {
    return checkJenkinsHealth();
  });

  app.get('/integrations/jenkins', async (): Promise<JenkinsConfigResponse> => {
    return getJenkinsConfig();
  });

  app.put('/integrations/jenkins', async (request, reply): Promise<JenkinsConfigResponse> => {
    const body = request.body as JenkinsConfigRequest;

    if (!body?.baseUrl?.trim()) {
      reply.status(400);
      return reply.send({ error: 'baseUrl is required' });
    }

    try {
      await saveJenkinsConfig(body.baseUrl, body.username, body.token);
    } catch (error) {
      reply.status(error instanceof JenkinsConfigError ? error.statusCode : 500);
      const message = error instanceof Error ? error.message : 'Failed to save config';
      return reply.send({ error: message });
    }

    return getJenkinsConfig();
  });

  app.post('/integrations/jenkins/test', async (request, reply): Promise<JenkinsTestResponse> => {
    const body = request.body as JenkinsConfigRequest;

    if (!body?.baseUrl?.trim()) {
      reply.status(400);
      return reply.send({ error: 'baseUrl is required' });
    }

    return testJenkinsConnection(body.baseUrl, body.username, body.token);
  });
}
