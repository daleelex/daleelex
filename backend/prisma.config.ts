import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'src/lib/prisma/schema.prisma',
  migrations: {
    path: 'src/lib/prisma/migrations',
    seed: 'node dist/lib/prisma/seed.js',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
