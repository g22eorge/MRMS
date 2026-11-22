import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Scheduling moved from Vercel Cron (`vercel.json`) to the in-container
 * `scheduler` service. Vercel would at least fail loudly on a malformed entry;
 * a route that nobody registers with the scheduler just never runs, and nothing
 * reports it. Two jobs were briefly in exactly that state during the migration.
 *
 * Every route under app/api/cron must therefore appear in scripts/scheduler.mjs.
 */
const ROUTES_DIR = join(import.meta.dir, "../../app/api/cron");
const SCHEDULER = join(import.meta.dir, "../../scripts/scheduler.mjs");

function cronRoutes(): string[] {
  return readdirSync(ROUTES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function scheduledPaths(): string[] {
  const source = readFileSync(SCHEDULER, "utf8");
  return [...source.matchAll(/path:\s*"(\/api\/cron\/[^"]+)"/g)].map((m) => m[1]).sort();
}

describe("scheduler cron coverage", () => {
  it("schedules every cron route", () => {
    const expected = cronRoutes().map((name) => `/api/cron/${name}`);
    expect(scheduledPaths()).toEqual(expected);
  });

  it("finds routes and schedules at all (guards against a silently empty scan)", () => {
    expect(cronRoutes().length).toBeGreaterThan(0);
  });

  it("gives every job a valid 5-field schedule", () => {
    const source = readFileSync(SCHEDULER, "utf8");
    const schedules = [...source.matchAll(/schedule:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(schedules.length).toBe(scheduledPaths().length);
    for (const schedule of schedules) {
      expect(schedule.trim().split(/\s+/)).toHaveLength(5);
    }
  });
});
