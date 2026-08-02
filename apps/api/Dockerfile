# syntax=docker/dockerfile:1

# Build context is the REPO ROOT, not apps/api — pnpm needs the workspace root
# (pnpm-workspace.yaml + the lockfile) to resolve @daleelex/shared at all.
#   docker build -f apps/api/Dockerfile .

FROM node:20-alpine AS build

# openssl is needed in the BUILD stage too, not just at runtime. Without it Prisma's
# platform detection cannot read an OpenSSL version, silently falls back to
# openssl-1.1.x, and resolves the engine to libquery_engine-*-openssl-1.1.x.so.node —
# which then fails to load with "Error loading shared library libssl.so.1.1". Invisible
# in the production image (whose runtime stage installs openssl) but fatal for the dev
# compose override, which runs this stage directly.
RUN apk add --no-cache openssl

# corepack ships with Node 20 and reads `packageManager` from the root package.json,
# so the pinned pnpm version is the same one CI and the VM use. No curl-pipe-sh.
RUN corepack enable
WORKDIR /repo

# Manifests first, source second. Dependencies change far less often than source, so
# this ordering keeps the (slow) install layer cached across ordinary code edits.
# All four workspace manifests are copied even though this image only builds the API:
# `--frozen-lockfile` validates the lockfile against the whole workspace, and it fails
# if a member listed in pnpm-workspace.yaml has no manifest on disk.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/ingestor/package.json apps/ingestor/
COPY packages/shared/package.json packages/shared/

# `@daleelex/api...` is "the API plus its workspace dependencies" — pulls in shared,
# skips web's React/Vite/Playwright tree entirely.
RUN pnpm install --frozen-lockfile --filter @daleelex/api...

COPY packages/shared packages/shared
COPY apps/api apps/api

# @prisma/client's postinstall doesn't reliably fire under --frozen-lockfile (the same
# failure ci.yml and cd.yml both work around). Without it, `build` below fails on
# ungenerated Prisma types rather than at runtime.
RUN pnpm --filter @daleelex/api exec prisma generate
RUN pnpm --filter @daleelex/api build

# pnpm's workspace-deploy: resolves @daleelex/shared and prunes to production-only
# dependencies in a self-contained tree at /out. This is the same command cd.yml uses
# to build the pm2 release artifact — reusing it means the container and the VM ship
# the identical dependency set rather than two hand-rolled approximations.
RUN pnpm --filter @daleelex/api deploy --prod /out

# /out/node_modules is an independent tree from the one generated against above, and
# the generated client does NOT carry over — cd.yml learned this the hard way ("Cannot
# find module '.prisma/client/default'" on boot). Regenerate against the pruned tree,
# using its own bundled prisma CLI so it reads its own copy of schema.prisma.
RUN cd /out && ./node_modules/.bin/prisma generate


FROM node:20-alpine AS runtime

# Prisma's query engine links against OpenSSL and node:20-alpine does not ship it.
# Without this the engine fails to load and every DB-touching endpoint 500s.
RUN apk add --no-cache openssl

ENV NODE_ENV=production
WORKDIR /app

# --chown so the unprivileged user below owns the tree, including the executable bit
# on Prisma's engine binaries.
COPY --from=build --chown=node:node /out ./

# The node image provides this user. Running as root in a container that speaks to the
# public internet buys nothing.
USER node

EXPOSE 3000

# Migrations are deliberately NOT run here. An entrypoint that migrates on boot means a
# bad migration takes the service down on every restart with no review step; see
# README for the explicit `docker compose run --rm api ...` command instead.
CMD ["node", "dist/index.js"]
