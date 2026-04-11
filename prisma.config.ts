import path from "node:path";

import { defineConfig } from "prisma/config";

function getDatabaseUrl() {
  // For production on Vercel with Turso
  if (process.env.TURSO_DATABASE_URL) {
    const token = process.env.TURSO_AUTH_TOKEN;
    if (token) {
      const separator = process.env.TURSO_DATABASE_URL.includes("?") ? "&" : "?";
      return `${process.env.TURSO_DATABASE_URL}${separator}authToken=${encodeURIComponent(token)}`;
    }
    return process.env.TURSO_DATABASE_URL;
  }

  // For local/development
  const url = process.env.DATABASE_URL || `file:${path.resolve(process.cwd(), "dev.db")}`;
  
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