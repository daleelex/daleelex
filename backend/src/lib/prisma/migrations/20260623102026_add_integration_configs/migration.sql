-- CreateTable
CREATE TABLE "integration_configs" (
    "provider" TEXT NOT NULL,
    "base_url" TEXT,
    "username" TEXT,
    "encrypted_token" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_configs_pkey" PRIMARY KEY ("provider")
);
