-- Language of the menus, per business. Existing ones stay in English.
ALTER TABLE "Organization" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en';
