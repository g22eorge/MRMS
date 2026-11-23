-- Server error log, grouped per distinct error per hour.
CREATE TABLE "ErrorEvent" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "bucket" TIMESTAMP(3) NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "route" TEXT,
    "path" TEXT,
    "method" TEXT,
    "kind" TEXT,
    "digest" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ErrorEvent_fingerprint_bucket_key" ON "ErrorEvent"("fingerprint", "bucket");
CREATE INDEX "ErrorEvent_lastSeenAt_idx" ON "ErrorEvent"("lastSeenAt");

-- A workspace whose administrator has asked for it to be deleted.
ALTER TABLE "Organization" ADD COLUMN "deletionRequestedAt" TIMESTAMP(3);
