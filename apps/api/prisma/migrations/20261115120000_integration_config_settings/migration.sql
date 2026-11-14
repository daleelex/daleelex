-- Provider-specific, non-secret options that have no column of their own
-- (e.g. Loki's service label). Secrets stay in encrypted_token.
ALTER TABLE "integration_configs" ADD COLUMN "settings" JSONB;
