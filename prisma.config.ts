import "dotenv/config";
import path from "node:path";

import { defineConfig } from "prisma/config";

function normalizeLocalSqliteUrl(url: string) {
  if (!url || url === "./dev.db" || url === "dev.db") {
    return `file:${path.resolve(process.cwd(), "dev.db")}`;
  }
  if (url.startsWith("file:")) return url;
  // Handle relative paths
  if (!url.startsWith("/")) {
    return `file:${path.resolve(process.cwd(), url)}`;
  }
  return `file:${url}`;
}

const defaultLocalDatabaseUrl = `file:${path.resolve(process.cwd(), "dev.db")}`;

// Get the database URL from environment or use default
let databaseUrl = process.env.DATABASE_URL || defaultLocalDatabaseUrl;

// Handle Turso/Postgres in production
if (process.env.PROD === "true") {
  if (process.env.TURSO_DATABASE_URL) {
    const token = process.env.TURSO_AUTH_TOKEN;
    const separator = process.env.TURSO_DATABASE_URL.includes("?") ? "&" : "?";
    databaseUrl = token 
      ? `${process.env.TURSO_DATABASE_URL}${separator}authToken=${encodeURIComponent(token)}`
      : process.env.TURSO_DATABASE_URL;
  }
} else {
  // Ensure local SQLite has file: prefix
  databaseUrl = normalizeLocalSqliteUrl(databaseUrl);
}

// Always set DATABASE_URL for the schema
process.env.DATABASE_URL = databaseUrl;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});