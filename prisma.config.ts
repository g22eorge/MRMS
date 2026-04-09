import "dotenv/config";
import path from "node:path";

import { defineConfig } from "prisma/config";

// This runs at build time - need to ensure DATABASE_URL is available
// Vercel injects env vars at runtime, but prisma generate runs at build

function getDatabaseUrl() {
  // For production on Vercel, use TURSO_DATABASE_URL if set
  if (process.env.PROD === "true") {
    if (process.env.TURSO_DATABASE_URL) {
      const token = process.env.TURSO_AUTH_TOKEN;
      if (token) {
        const separator = process.env.TURSO_DATABASE_URL.includes("?") ? "&" : "?";
        return `${process.env.TURSO_DATABASE_URL}${separator}authToken=${encodeURIComponent(token)}`;
      }
      return process.env.TURSO_DATABASE_URL;
    }
  }

  // For local/development
  const url = process.env.DATABASE_URL || `file:${path.resolve(process.cwd(), "dev.db")}`;
  
  // Ensure file: prefix for local SQLite
  if (!url.startsWith("file:") && !url.startsWith("prisma://") && !url.startsWith("postgres")) {
    if (url.includes("://")) {
      return url;
    }
    return `file:${path.resolve(process.cwd(), url)}`;
  }
  
  return url;
}

// Set the env var so prisma schema can use it
process.env.DATABASE_URL = getDatabaseUrl();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: getDatabaseUrl(),
  },
});