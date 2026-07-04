#!/bin/sh
set -e

COMPOSE="docker compose"
BACKEND_ENV="./backend/.env"
BACKEND_EXAMPLE_ENV="./backend/.env.example"

info()  { printf '\033[1;34m[bootstrap]\033[0m %s\n' "$1"; }
warn()  { printf '\033[1;33m[bootstrap]\033[0m %s\n' "$1"; }
error() { printf '\033[1;31m[bootstrap]\033[0m %s\n' "$1" >&2; }

# ---------- 1. Preflight checks ----------
command -v docker >/dev/null 2>&1 || { error "docker is not installed or not on PATH."; exit 1; }

if [ ! -f "docker-compose.yml" ]; then
  error "docker-compose.yml not found in the current directory. Run this script from the repo root."
  exit 1
fi

# ---------- 2. Require a backend .env ----------
if [ ! -f "$BACKEND_ENV" ]; then
  error "No .env found at $BACKEND_ENV."
  error "Copy the example and fill in real values before bootstrapping:"
  error "  cp $BACKEND_EXAMPLE_ENV $BACKEND_ENV"
  exit 1
fi

# ---------- 3. Ask about Jenkins ----------
DEPLOY_JENKINS="n"
printf 'Deploy Jenkins alongside the stack? [y/N]: '
read -r answer
case "$answer" in
  y|Y|yes|YES) DEPLOY_JENKINS="y" ;;
  *) DEPLOY_JENKINS="n" ;;
esac

# ---------- 4. Start Postgres ----------
info "Starting Postgres..."
$COMPOSE up -d postgres

info "Waiting for Postgres to become healthy..."
attempts=0
until [ "$($COMPOSE ps postgres --format '{{.Health}}' 2>/dev/null)" = "healthy" ]; do
  attempts=$((attempts + 1))
  if [ "$attempts" -ge 30 ]; then
    error "Postgres did not become healthy in time. Check: $COMPOSE logs postgres"
    exit 1
  fi
  sleep 2
done
info "Postgres is healthy."

# ---------- 5. Start Jenkins, if requested ----------
if [ "$DEPLOY_JENKINS" = "y" ]; then
  info "Starting Jenkins..."
  $COMPOSE up -d jenkins
  info "Jenkins is starting at http://localhost:8080 (initial setup may take a minute)."
else
  info "Skipping Jenkins. The backend will run with Jenkins integration reporting 'not_configured'."
fi

# ---------- 6. Build the backend image ----------
info "Building backend image..."
$COMPOSE build backend

# ---------- 7. Seed the database (bypasses entrypoint.sh — runs seed directly, then exits) ----------
info "Seeding database..."
$COMPOSE run --rm --entrypoint "pnpm exec prisma db seed" backend

# ---------- 8. Start the backend container in the background ----------
info "Starting backend container (detached)..."
$COMPOSE up -d backend

info "Backend is starting. Migrations run automatically via the container entrypoint."
info "Tail logs with: docker compose logs -f backend"
info "Stop the stack with: docker compose down"