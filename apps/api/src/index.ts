import './env.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoute } from './routes/health.js';
import { statsRoute } from './routes/stats.js';
import { servicesRoute } from './routes/services.js';
import { teamsRoute } from './routes/teams.js';
import { teamMembersRoute } from './routes/teamMembers.js';
import { docsRoute } from './routes/docs.js';
import { integrationsRoute } from './routes/integrations.js';
import { meRoute } from './routes/me.js';
import { serviceLogsRoute } from './routes/serviceLogs.js';
import { serviceScorecardRoute } from './routes/serviceScorecard.js';
import { createLogSourceResolver, getLokiConfig } from './integrations/loki.js';

const app = Fastify({ logger: true });

// || not ?? — an empty CORS_ORIGIN="" (e.g. copied verbatim from .env.example) should
// still fall back to the default, not resolve to an empty, CORS-breaking origin.
await app.register(cors, { origin: process.env.CORS_ORIGIN || 'http://localhost:5173' });

app.register(healthRoute, { prefix: '/api/v1' });
app.register(statsRoute, { prefix: '/api/v1' });
app.register(servicesRoute, { prefix: '/api/v1' });
app.register(teamsRoute, { prefix: '/api/v1' });
app.register(teamMembersRoute, { prefix: '/api/v1' });
app.register(docsRoute, { prefix: '/api/v1' });
app.register(integrationsRoute, { prefix: '/api/v1' });
app.register(meRoute, { prefix: '/api/v1' });
app.register(serviceScorecardRoute, { prefix: '/api/v1' });
// Real logs when a Loki is configured (Settings → Integrations, or LOKI_URL as the
// fallback); otherwise the mock, so local dev without Loki still has a working Logs
// tab. Resolved per request so a saved config applies without a restart.
app.register(serviceLogsRoute, { prefix: '/api/v1', resolveLogSource: createLogSourceResolver() });
getLokiConfig()
  .then((config) => {
    app.log.info(`Service logs backend at startup: ${config.baseUrl ? 'loki' : 'mock'}`);
    const envLabel = process.env.LOKI_SERVICE_LABEL?.trim();
    if (config.source === 'env' && envLabel && envLabel !== config.serviceLabel) {
      app.log.warn(
        `LOKI_SERVICE_LABEL "${envLabel}" is not a valid Loki label name; using "${config.serviceLabel}".`,
      );
    }
  })
  .catch((err) => app.log.warn({ err }, 'Could not read the Loki integration config'));

try {
  await app.listen({ port: 3000, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
