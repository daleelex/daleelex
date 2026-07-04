FROM node:24-alpine AS builder
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm exec prisma generate
RUN pnpm build
FROM node:24-alpine AS runner

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=2048 --enable-source-maps"
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

RUN addgroup -g 3003 daleel \
 && adduser  -u 3003 -G daleel -S -h /app daleel

WORKDIR /app
RUN corepack enable

COPY --from=builder --chown=daleel:daleel /app/node_modules   ./node_modules
COPY --from=builder --chown=daleel:daleel /app/dist           ./dist
COPY --from=builder --chown=daleel:daleel /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder --chown=daleel:daleel /app/prisma.config.ts ./
COPY --from=builder --chown=daleel:daleel /app/src/lib/prisma  ./src/lib/prisma

COPY --chown=daleel:daleel entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh
USER daleel
EXPOSE 5021 5022
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5021/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]