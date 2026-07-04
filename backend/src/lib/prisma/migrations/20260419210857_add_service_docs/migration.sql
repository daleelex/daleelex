-- CreateTable
CREATE TABLE "service_docs" (
    "id" SERIAL NOT NULL,
    "service_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content_md" TEXT NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_docs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_docs_service_id_idx" ON "service_docs"("service_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_docs_service_id_path_key" ON "service_docs"("service_id", "path");

-- AddForeignKey
ALTER TABLE "service_docs" ADD CONSTRAINT "service_docs_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
