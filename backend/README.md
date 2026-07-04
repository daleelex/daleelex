# Aeon Backend

## Requirements
- pnpm
- PostgreSQL container running with `aeon` schema set up
- Redis container running

## Quick Start

### 1. Install dependencies
```bash
pnpm install
```

### 2. Set up `.env`
```env
DB_URL=postgresql://aeon:aeon2026@localhost:5432/aeon-backend?schema=aeon
CACHE_HOST=127.0.0.1
CACHE_PORT=6379
LOG_ENABLE_CONSOLE=true
```
> ⚠️ `DB_URL` must include `?schema=aeon` or Prisma will default to the `public` schema.

### 3. Run Prisma before every boot
```bash
npx prisma generate && npx prisma migrate deploy
```
> `migrate deploy` requires the DB to be running and reachable before this step.

### 4. Start the app
```bash
# development
pnpm start:dev

# production
pnpm start:prod
```

---

## Database Setup

```bash
docker exec -it aeon-postgres_c psql -U postgres
```

```sql
CREATE USER aeon WITH PASSWORD 'aeon2026' CREATEDB;
CREATE DATABASE "aeon-backend" OWNER aeon;
\c aeon-backend
CREATE SCHEMA IF NOT EXISTS aeon AUTHORIZATION aeon;
GRANT ALL PRIVILEGES ON DATABASE "aeon-backend" TO aeon;
GRANT ALL ON SCHEMA aeon TO aeon;
ALTER ROLE aeon SET search_path TO aeon;
ALTER DEFAULT PRIVILEGES IN SCHEMA aeon GRANT ALL ON TABLES TO aeon;
ALTER DEFAULT PRIVILEGES IN SCHEMA aeon GRANT ALL ON SEQUENCES TO aeon;
```

## Redis Setup
```bash
docker run -d --name redis_c -p 6379:6379 --restart unless-stopped redis:latest
```

## Tests
```bash
pnpm test
pnpm test:e2e
pnpm test:cov
```