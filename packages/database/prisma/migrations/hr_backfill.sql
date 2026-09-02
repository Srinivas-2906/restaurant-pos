-- HR schema migration: backfill staffProfileId and organizationId before prisma db push
-- Run against kaana_foods database when upgrading from userId-based staff relations

BEGIN;

-- 1. StaffProfile.organizationId from linked User
ALTER TABLE "StaffProfile" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "StaffProfile" sp
SET "organizationId" = u."organizationId"
FROM "User" u
WHERE sp."userId" = u.id AND sp."organizationId" IS NULL;

-- Fallback: first organization (dev only)
UPDATE "StaffProfile"
SET "organizationId" = (SELECT id FROM "Organization" LIMIT 1)
WHERE "organizationId" IS NULL;

-- 2. AttendanceRecord: userId -> staffProfileId
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "staffProfileId" TEXT;
UPDATE "AttendanceRecord" ar
SET "staffProfileId" = sp.id
FROM "StaffProfile" sp
WHERE ar."userId" = sp."userId" AND ar."staffProfileId" IS NULL;

-- 3. ShiftSchedule
ALTER TABLE "ShiftSchedule" ADD COLUMN IF NOT EXISTS "staffProfileId" TEXT;
UPDATE "ShiftSchedule" ss
SET "staffProfileId" = sp.id
FROM "StaffProfile" sp
WHERE ss."userId" = sp."userId" AND ss."staffProfileId" IS NULL;

-- 4. LeaveRequest
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "staffProfileId" TEXT;
UPDATE "LeaveRequest" lr
SET "staffProfileId" = sp.id
FROM "StaffProfile" sp
WHERE lr."userId" = sp."userId" AND lr."staffProfileId" IS NULL;

-- 5. Payslip
ALTER TABLE "Payslip" ADD COLUMN IF NOT EXISTS "staffProfileId" TEXT;
UPDATE "Payslip" p
SET "staffProfileId" = sp.id
FROM "StaffProfile" sp
WHERE p."userId" = sp."userId" AND p."staffProfileId" IS NULL;

COMMIT;
