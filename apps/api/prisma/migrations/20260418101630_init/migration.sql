-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slack_channel" TEXT,
    "on_call_schedule" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "lifecycle" TEXT NOT NULL,
    "owner_team_id" TEXT,
    "language" TEXT,
    "repository" TEXT,
    "slo_target" TEXT,
    "slo_window" TEXT,
    "tags" TEXT[],
    "source_sha" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_dependencies" (
    "service_id" TEXT NOT NULL,
    "depends_on_id" TEXT NOT NULL,

    CONSTRAINT "service_dependencies_pkey" PRIMARY KEY ("service_id","depends_on_id")
);

-- CreateTable
CREATE TABLE "links" (
    "id" SERIAL NOT NULL,
    "service_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "type" TEXT NOT NULL DEFAULT 'other',

    CONSTRAINT "links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scorecard_checks" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "scorecard_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scorecard_results" (
    "id" BIGSERIAL NOT NULL,
    "service_id" TEXT NOT NULL,
    "check_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "evidence" JSONB,
    "ran_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scorecard_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar_url" TEXT,
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "services_deleted_at_tier_idx" ON "services"("deleted_at", "tier");

-- CreateIndex
CREATE INDEX "services_deleted_at_owner_team_id_idx" ON "services"("deleted_at", "owner_team_id");

-- CreateIndex
CREATE INDEX "services_deleted_at_type_idx" ON "services"("deleted_at", "type");

-- CreateIndex
CREATE INDEX "scorecard_results_service_id_check_id_ran_at_idx" ON "scorecard_results"("service_id", "check_id", "ran_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_owner_team_id_fkey" FOREIGN KEY ("owner_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_dependencies" ADD CONSTRAINT "service_dependencies_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_dependencies" ADD CONSTRAINT "service_dependencies_depends_on_id_fkey" FOREIGN KEY ("depends_on_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "links" ADD CONSTRAINT "links_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorecard_results" ADD CONSTRAINT "scorecard_results_check_id_fkey" FOREIGN KEY ("check_id") REFERENCES "scorecard_checks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
