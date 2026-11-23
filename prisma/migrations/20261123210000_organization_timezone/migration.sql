-- Each business keeps its own day. Existing ones stay on Kampala time.
ALTER TABLE "Organization" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Africa/Kampala';
