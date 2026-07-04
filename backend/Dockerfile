FROM node:24-alpine AS dependencies

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.18.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---------- Stage 2: build ----------
FROM node:24-alpine AS builder
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.18.0 --activate
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml prisma.config.ts ./
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
# Copy only the Prisma schema first — invalidates the generate step
# only when the schema itself changes, not on every source edit.
COPY src/lib/prisma ./src/lib/prisma
RUN pnpm exec prisma generate
COPY . .
RUN pnpm build

# ---------- Stage 3: prune to production-only deps (cached) ----------
FROM node:24-alpine AS prod-deps

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.18.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod

# ---------- Stage 4: runtime ----------
FROM node:24-alpine AS runner

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=2048 --enable-source-maps"
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

RUN addgroup -g 3003 daleel \
 && adduser  -u 3003 -G daleel -S -h /app daleel

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.18.0 --activate

# Production-only node_modules 
COPY --from=prod-deps --chown=daleel:daleel /app/node_modules ./node_modules
COPY --from=builder   --chown=daleel:daleel /app/dist          ./dist
COPY --from=builder   --chown=daleel:daleel /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder   --chown=daleel:daleel /app/prisma.config.ts ./
COPY --from=builder   --chown=daleel:daleel /app/src/lib/prisma  ./src/lib/prisma
COPY --chown=daleel:daleel entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh
USER daleel
ENTRYPOINT ["./entrypoint.sh"]