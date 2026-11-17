import type { FastifyInstance } from 'fastify';
import type {
  JenkinsHealthResponse,
  JenkinsConfigResponse,
  JenkinsConfigRequest,
  JenkinsTestResponse,
  LokiConfigRequest,
  LokiConfigResponse,
  LokiTestResponse,
} from '@daleelex/shared';
import { sendApiError } from '../apiError.js';
import { requireClerkAdmin } from '../clerkAuth.js';
import {
  JenkinsConfigError,
  checkJenkinsHealth,
  getJenkinsConfig,
  saveJenkinsConfig,
  testJenkinsConnection,
} from '../integrations/jenkins.js';
import {
  LokiConfigError,
  deleteLokiConfig,
  getLokiConfig,
  saveLokiConfig,
  testLokiConnection,
} from '../integrations/loki.js';

const lokiConfigBody = {
  type: 'object',
  required: ['baseUrl'],
  additionalProperties: false,
  properties: {
    baseUrl: { type: 'string', minLength: 1, maxLength: 2000 },
    serviceLabel: { type: 'string', maxLength: 200 },
  },
} as const;

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

  // Loki routes are admin-only: they decide where every service's logs come from, and
  // the test endpoint makes this server fetch a caller-supplied URL.
  app.get(
    '/integrations/loki',
    { preHandler: requireClerkAdmin },
    async (): Promise<LokiConfigResponse> => getLokiConfig(),
  );

  app.put<{ Body: LokiConfigRequest }>(
    '/integrations/loki',
    { preHandler: requireClerkAdmin, attachValidation: true, schema: { body: lokiConfigBody } },
    async (req, reply): Promise<LokiConfigResponse | void> => {
      if (req.validationError) {
        return sendApiError(req, reply, 422, 'validation_failed', 'The Loki config is invalid.', {
          issues: req.validationError.validation ?? [],
        });
      }

      try {
        await saveLokiConfig(req.body.baseUrl, req.body.serviceLabel);
      } catch (error) {
        if (error instanceof LokiConfigError) {
          return sendApiError(req, reply, 422, 'validation_failed', error.message);
        }
        throw error;
      }
      req.log.info({ clerkUserId: req.clerkUserId }, 'Loki integration config saved');
      return getLokiConfig();
    },
  );

  app.delete(
    '/integrations/loki',
    { preHandler: requireClerkAdmin },
    async (req): Promise<LokiConfigResponse> => {
      await deleteLokiConfig();
      req.log.info({ clerkUserId: req.clerkUserId }, 'Loki integration config removed');
      // Not a 204: the caller needs to know what logs fall back to (env or mock).
      return getLokiConfig();
    },
  );

  app.post<{ Body: LokiConfigRequest }>(
    '/integrations/loki/test',
    { preHandler: requireClerkAdmin, attachValidation: true, schema: { body: lokiConfigBody } },
    async (req, reply): Promise<LokiTestResponse | void> => {
      if (req.validationError) {
        return sendApiError(req, reply, 422, 'validation_failed', 'The Loki config is invalid.', {
          issues: req.validationError.validation ?? [],
        });
      }
      return testLokiConnection(req.body.baseUrl, req.body.serviceLabel);
    },
  );
}
