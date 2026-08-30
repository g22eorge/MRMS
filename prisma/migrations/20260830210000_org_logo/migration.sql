-- Per-organisation document logo.
--
-- Replaces a mechanism that wrote every upload to public/eagle-info-logo.png:
-- one shared file, hardcoded to one tenant's name, so on the multi-tenant
-- deployment a tenant uploading their logo replaced every other tenant's — and
-- on a read-only serverless filesystem the write failed outright.
--
-- Both columns are nullable and additive: existing rows keep their branding and
-- simply have no logo until one is uploaded.
ALTER TABLE "DocumentBrandingSettings" ADD COLUMN "companyLogoUrl" TEXT;
ALTER TABLE "DocumentBrandingSettings" ADD COLUMN "companyLogoKey" TEXT;
