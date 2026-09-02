-- Idempotent reservations module migration (safe to re-run)

DO $$ BEGIN
  ALTER TYPE "TableStatus" ADD VALUE IF NOT EXISTS 'cleaning';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "ReservationStatus" ADD VALUE IF NOT EXISTS 'arrived';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "ReservationSource" ADD VALUE IF NOT EXISTS 'whatsapp';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "WaitlistStatus" AS ENUM ('waiting', 'notified', 'seated', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "occasion" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "specialRequest" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "preferredArea" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "advancePayment" DECIMAL(10,2);
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "arrivedAt" TIMESTAMP(3);
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "seatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Reservation_outletId_status_idx" ON "Reservation"("outletId", "status");

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "reservationId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Order_reservationId_key" ON "Order"("reservationId") WHERE "reservationId" IS NOT NULL;

DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_reservationId_fkey"
    FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "WaitlistEntry" (
  "id" TEXT NOT NULL,
  "outletId" TEXT NOT NULL,
  "guestName" TEXT NOT NULL,
  "guestPhone" TEXT NOT NULL,
  "guestCount" INTEGER NOT NULL,
  "quotedWaitMins" INTEGER,
  "notes" TEXT,
  "status" "WaitlistStatus" NOT NULL DEFAULT 'waiting',
  "position" INTEGER NOT NULL DEFAULT 0,
  "reservationId" TEXT,
  "notifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WaitlistEntry_outletId_status_position_idx"
  ON "WaitlistEntry"("outletId", "status", "position");

DO $$ BEGIN
  ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_outletId_fkey"
    FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_reservationId_fkey"
    FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
