# syntax=docker/dockerfile:1
# check=skip=SecretsUsedInArgOrEnv
#
# That check fires on VITE_CLERK_PUBLISHABLE_KEY purely because the name ends in KEY.
# Clerk's pk_ keys are publishable by design — they are meant to ship inside the client
# bundle, which is exactly what this image does with it. Skipped deliberately so the
# build output stays clean and a real secrets warning would still stand out.

# Build context is the REPO ROOT, not apps/web:
#   docker build -f apps/web/Dockerfile .
#
# Two runnable targets:
#   --target dev      node + vite dev server, for the compose dev override
#   (default)         nginx serving the built static bundle, for GHCR/production

FROM node:20-alpine AS deps

RUN corepack enable
WORKDIR /repo

# Manifests first so the install layer survives ordinary source edits. All four are
# copied because --frozen-lockfile validates against the whole workspace.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/ingestor/package.json apps/ingestor/
COPY packages/shared/package.json packages/shared/

# Not --prod: Vite, React plugin and TypeScript are all devDependencies and all
# required to produce the bundle.
RUN pnpm install --frozen-lockfile --filter @daleelex/web...


# Dev server target. Source is bind-mounted over /repo by the compose dev override, so
# nothing is COPYed in — this stage exists for its node_modules, which must be the
# container's own arch-correct install rather than the host's.
#
# Note the Clerk key is NOT baked here: `vite dev` reads VITE_* from the environment at
# process start, so the dev container takes it as an ordinary env var and one image
# works against any Clerk instance. Only the production stage below bakes it in.
FROM deps AS dev
WORKDIR /repo/apps/web
EXPOSE 5173
CMD ["pnpm", "dev"]


FROM deps AS build

COPY packages/shared packages/shared
COPY apps/web apps/web

# Vite inlines VITE_* at BUILD time, so this has to be a build argument — it cannot be
# supplied later as a container env var. Consequence worth knowing: the resulting image
# is pinned to one Clerk instance. Publishable, not secret; pk_ keys are meant to ship
# in client bundles, which is why this is an ARG and not a mounted secret.
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY

# Fail here rather than at boot. main.tsx throws without this key, so an empty value
# produces an image that builds clean and then shows a blank page — the exact failure
# cd.yml added its own pre-build guard for.
RUN if [ -z "$VITE_CLERK_PUBLISHABLE_KEY" ]; then \
      echo "VITE_CLERK_PUBLISHABLE_KEY is empty. Vite bakes VITE_* in at build time," >&2; \
      echo "so the resulting bundle would throw on boot. Pass it with:" >&2; \
      echo "  docker build --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_... -f apps/web/Dockerfile ." >&2; \
      exit 1; \
    fi

RUN pnpm --filter @daleelex/web build


FROM nginx:1.27-alpine AS runtime

# Static files and a web server. No Node, no pnpm store, no node_modules — the whole
# reason the frontend gets a different runtime base from the two Node services.
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=5s \
  CMD wget -qO- http://127.0.0.1/index.html >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
