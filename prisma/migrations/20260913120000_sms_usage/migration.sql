-- Per-organisation monthly SMS counts.
--
-- The table already existed in production, but only because
-- lib/notifications/sms-quota.ts created it at runtime with
-- `CREATE TABLE IF NOT EXISTS` and unquoted column names — so Postgres folded
-- them to lowercase and the datamodel never knew the table was there. Declaring
-- it makes it visible to migrations, the drift report and /api/admin/db-health,
-- and gives the columns the quoted casing the rest of the schema uses.
--
-- Additive and safe to replay: a deployment that has the runtime-created table
-- from the SQLite era would need it dropped first, but no Postgres deployment
-- has one, since nothing has run this code against Postgres in production yet.

-- CreateTable
CREATE TABLE "SmsUsage" (
    "orgId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SmsUsage_pkey" PRIMARY KEY ("orgId","year","month")
);

-- CreateIndex
CREATE INDEX "SmsUsage_year_month_idx" ON "SmsUsage"("year", "month");

