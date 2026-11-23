-- A staff login whose password an admin has just set must choose its own at
-- the next sign-in: whoever typed the password knows it. PortalUser has carried
-- the same flag since the portal was built; staff accounts did not.
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
