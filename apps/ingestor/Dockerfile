# syntax=docker/dockerfile:1

# Build context is the REPO ROOT, not apps/ingestor:
#   docker build -f apps/ingestor/Dockerfile .

FROM node:20-alpine AS build

RUN corepack enable
WORKDIR /repo

# Manifests first so the install layer survives ordinary source edits. All four are
# copied because --frozen-lockfile validates against the whole workspace and fails if
# a member declared in pnpm-workspace.yaml is missing from disk.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/ingestor/package.json apps/ingestor/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --frozen-lockfile --filter @daleelex/ingestor...

COPY packages/shared packages/shared
COPY apps/ingestor apps/ingestor

# The ingestor does not own a schema — it queries the tables the API owns — so the
# API's schema is copied in and generated against, exactly as cd.yml does when it
# builds the pm2 artifact. Same file, one source of truth.
COPY apps/api/prisma/schema.prisma apps/ingestor/prisma/schema.prisma

RUN pnpm --filter @daleelex/ingestor exec prisma generate --schema prisma/schema.prisma
RUN pnpm --filter @daleelex/ingestor build

RUN pnpm --filter @daleelex/ingestor deploy --prod /out

# `pnpm deploy` builds /out/node_modules as an independent tree whose @prisma/client is
# ungenerated, and the ingestor imports PrismaClient at startup — so without this it
# crashes on its first line with "Cannot find module '.prisma/client/default'".
# `files` in package.json does not include prisma/, so the schema is copied in
# explicitly rather than riding along with the deploy.
RUN mkdir -p /out/prisma && cp apps/ingestor/prisma/schema.prisma /out/prisma/schema.prisma
RUN cd /out && ./node_modules/.bin/prisma generate


FROM node:20-alpine AS runtime

# Prisma's query engine links against OpenSSL, which alpine does not ship.
RUN apk add --no-cache openssl

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build --chown=node:node /out ./

USER node

# One-shot by design: this scans repositories, syncs TechDocs, and exits — it is not a
# long-running worker yet. That is why compose gives it `restart: "no"` and keeps it
# out of the default `up` set, mirroring `autorestart: false` in ecosystem.config.cjs.
# Run it on demand: docker compose run --rm ingestor
CMD ["node", "dist/index.js"]
