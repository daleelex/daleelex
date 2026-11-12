import './env.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoute } from './routes/health.js';
import { statsRoute } from './routes/stats.js';
import { servicesRoute } from './routes/services.js';
import { teamsRoute } from './routes/teams.js';
import { docsRoute } from './routes/docs.js';
import { integrationsRoute } from './routes/integrations.js';
import { meRoute } from './routes/me.js';
import { serviceLogsRoute } from './routes/serviceLogs.js';
import { MockLogSource } from './logs/mockLogSource.js';
import { LokiLogSource } from './logs/lokiLogSource.js';

const app = Fastify({ logger: true });

// || not ?? — an empty CORS_ORIGIN="" (e.g. copied verbatim from .env.example) should
// still fall back to the default, not resolve to an empty, CORS-breaking origin.
await app.register(cors, { origin: process.env.CORS_ORIGIN || 'http://localhost:5173' });

app.register(healthRoute, { prefix: '/api/v1' });
app.register(statsRoute, { prefix: '/api/v1' });
app.register(servicesRoute, { prefix: '/api/v1' });
app.register(teamsRoute, { prefix: '/api/v1' });
app.register(docsRoute, { prefix: '/api/v1' });
app.register(integrationsRoute, { prefix: '/api/v1' });
app.register(meRoute, { prefix: '/api/v1' });
// Real logs when a Loki is configured; otherwise the mock, so local dev without Loki
// still has a working Logs tab. Logged so nobody mistakes mock lines for real ones.
const logSource = process.env.LOKI_URL
  ? new LokiLogSource({
      baseUrl: process.env.LOKI_URL,
      serviceLabel: process.env.LOKI_SERVICE_LABEL || undefined,
    })
  : new MockLogSource();
app.log.info(`Service logs backend: ${process.env.LOKI_URL ? 'loki' : 'mock'}`);
app.register(serviceLogsRoute, { prefix: '/api/v1', logSource });

try {
  await app.listen({ port: 3000, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
