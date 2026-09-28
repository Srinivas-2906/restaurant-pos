-- Platform capability foundation migration
-- Safe additive changes; existing orgs default to LEGACY_FULL / STANDARD

DO $$ BEGIN
  CREATE TYPE "OperatingMode" AS ENUM ('SIMPLE', 'STANDARD', 'ADVANCED', 'ENTERPRISE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SubscriptionPlanId" AS ENUM ('LEGACY_FULL', 'STARTER', 'GROWTH', 'PRO', 'ENTERPRISE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FeatureOverrideState" AS ENUM ('DEFAULT', 'ENABLED', 'READ_ONLY', 'DISABLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "operatingMode" "OperatingMode" NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN IF NOT EXISTS "subscriptionPlan" "SubscriptionPlanId" NOT NULL DEFAULT 'LEGACY_FULL',
  ADD COLUMN IF NOT EXISTS "configVersion" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS "RestaurantModuleOverride" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "moduleKey" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RestaurantModuleOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantModuleOverride_organizationId_moduleKey_key"
  ON "RestaurantModuleOverride"("organizationId", "moduleKey");

CREATE TABLE IF NOT EXISTS "RestaurantFeatureOverride" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "featureKey" TEXT NOT NULL,
  "state" "FeatureOverrideState" NOT NULL DEFAULT 'DEFAULT',
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RestaurantFeatureOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantFeatureOverride_organizationId_featureKey_key"
  ON "RestaurantFeatureOverride"("organizationId", "featureKey");

ALTER TABLE "Terminal"
  ADD COLUMN IF NOT EXISTS "activationCode" TEXT,
  ADD COLUMN IF NOT EXISTS "activationCodeExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);

UPDATE "Organization" SET "subscriptionPlan" = 'LEGACY_FULL' WHERE "subscriptionPlan" IS NULL;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'platform_config';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'device_revoked';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "GlAccountType" AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "GlAccount" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "GlAccountType" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GlAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GlAccount_organizationId_code_key" ON "GlAccount"("organizationId", "code");

CREATE TABLE IF NOT EXISTS "JournalEntry" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "outletId" TEXT,
  "reference" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "sourceEvent" TEXT NOT NULL,
  "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "JournalEntry_organizationId_idempotencyKey_key"
  ON "JournalEntry"("organizationId", "idempotencyKey");

CREATE TABLE IF NOT EXISTS "JournalLine" (
  "id" TEXT NOT NULL,
  "journalEntryId" TEXT NOT NULL,
  "glAccountId" TEXT NOT NULL,
  "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
  CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);
