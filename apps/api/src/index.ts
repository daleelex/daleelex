import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoute } from './routes/health.js';
import { servicesRoute } from './routes/services.js';
import { teamsRoute } from './routes/teams.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: 'http://localhost:5173' });

app.register(healthRoute, { prefix: '/api/v1' });
app.register(servicesRoute, { prefix: '/api/v1' });
app.register(teamsRoute, { prefix: '/api/v1' });

try {
  await app.listen({ port: 3000, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
