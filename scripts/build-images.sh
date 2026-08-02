#!/usr/bin/env bash
#
# Build and push the three DaleelEx images as multi-arch manifests.
#
# CI does this on merge to master (.github/workflows/ci.yml). This script exists for
# the cases CI cannot cover: verifying a Dockerfile change locally before pushing, and
# publishing by hand when Actions is unavailable and the VM needs an image now.
#
#   VITE_CLERK_PUBLISHABLE_KEY=pk_... ./scripts/build-images.sh
#   REGISTRY=localhost:5001 PUSH=false ./scripts/build-images.sh
#
# linux/arm64 is the production VM (Oracle Ampere); linux/amd64 is developer machines
# and CI runners. Building the foreign architecture goes through QEMU and is slow —
# roughly 1-2 minutes per image on an M-series Mac, much worse on a cold cache.

set -euo pipefail

REGISTRY="${REGISTRY:-ghcr.io/daleelex}"
PLATFORMS="${PLATFORMS:-linux/amd64,linux/arm64}"
BUILDER="${BUILDER:-daleelex-multiarch}"
PUSH="${PUSH:-true}"
SHA="${SHA:-$(git rev-parse HEAD)}"

if [ -z "${VITE_CLERK_PUBLISHABLE_KEY:-}" ]; then
  echo "VITE_CLERK_PUBLISHABLE_KEY is not set." >&2
  echo "Vite inlines VITE_* at build time, so the web image bakes it in and the build" >&2
  echo "fails without it. Use a pk_live_ key for anything that will be deployed." >&2
  exit 1
fi

# The default builder uses the `docker` driver, which cannot emit multi-platform
# manifests at all — it silently only ever produces the host's architecture. A
# docker-container builder is required, so create one if it isn't already there.
if ! docker buildx inspect "$BUILDER" >/dev/null 2>&1; then
  echo "Creating buildx builder '$BUILDER' (docker-container driver)..."
  docker buildx create --name "$BUILDER" --driver docker-container --bootstrap >/dev/null
fi

output_args=(--push)
if [ "$PUSH" != "true" ]; then
  # Multi-platform results cannot be loaded into the local docker image store, so
  # without a push the only useful local outcome is "did it build".
  output_args=(--output type=cacheonly)
fi

build() {
  local app="$1"
  shift
  local image="$REGISTRY/daleelex-$app"

  echo ""
  echo "==> $image  [$PLATFORMS]"
  docker buildx build \
    --builder "$BUILDER" \
    --platform "$PLATFORMS" \
    -f "apps/$app/Dockerfile" \
    -t "$image:$SHA" \
    -t "$image:latest" \
    "$@" \
    "${output_args[@]}" \
    .
}

build api
build ingestor
# Only the web image takes the key: the API reads CLERK_SECRET_KEY at runtime instead.
build web --build-arg "VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY"

echo ""
echo "Done. Tagged $SHA and latest."
if [ "$PUSH" = "true" ]; then
  echo "Verify both architectures made it into the manifest with:"
  echo "  docker buildx imagetools inspect $REGISTRY/daleelex-api:$SHA"
fi
