/**
 * Runs the application's scheduled jobs.
 *
 * On Vercel these were declared in vercel.json and invoked by Vercel Cron. Under
 * Docker nothing invokes them, so without this process the WhatsApp retry queue
 * stops draining, subscriptions stop advancing, data healing stops running and
 * audit logs grow without bound — silently, because nothing errors.
 *
 * The schedules are kept here, in one place, in the same cron syntax the
 * platform used. Each job is an authenticated HTTP call to its route, so the
 * work still happens inside the app with its own logging and tenant scoping;
 * this process only decides when.
 *
 *   APP_URL=http://app:3000 CRON_SECRET=... node scripts/scheduler.mjs
 */

const APP_URL = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://app:3000").replace(/\/$/, "");
const CRON_SECRET = process.env.CRON_SECRET;

/** Same set, same schedules, as the retired vercel.json. */
const JOBS = [
  { name: "whatsapp-retry",         path: "/api/cron/whatsapp-retry",         schedule: "0 7 * * *" },
  { name: "subscription-lifecycle", path: "/api/cron/subscription-lifecycle", schedule: "0 6 * * *" },
  { name: "data-heal",              path: "/api/cron/data-heal",              schedule: "30 2 * * *" },
  { name: "audit-prune",            path: "/api/cron/audit-prune",            schedule: "0 3 * * 0" },
];

if (!CRON_SECRET) {
  console.error("[scheduler] CRON_SECRET is not set — refusing to start, the cron routes would reject every call");
  process.exit(1);
}

/**
 * Minimal 5-field cron matcher: minute, hour, day-of-month, month, day-of-week.
 * Supports `*`, single values, comma lists and `*\/n` steps — everything the
 * schedules above use, and nothing more, so there is no parser to distrust.
 */
function fieldMatches(spec, value) {
  for (const part of spec.split(",")) {
    if (part === "*") return true;
    const step = part.match(/^\*\/(\d+)$/);
    if (step) {
      if (value % Number(step[1]) === 0) return true;
      continue;
    }
    const range = part.match(/^(\d+)-(\d+)$/);
    if (range) {
      if (value >= Number(range[1]) && value <= Number(range[2])) return true;
      continue;
    }
    if (Number(part) === value) return true;
  }
  return false;
}

function dueAt(schedule, date) {
  const [minute, hour, dom, month, dow] = schedule.split(/\s+/);
  return (
    fieldMatches(minute, date.getUTCMinutes())
    && fieldMatches(hour, date.getUTCHours())
    && fieldMatches(dom, date.getUTCDate())
    && fieldMatches(month, date.getUTCMonth() + 1)
    && fieldMatches(dow, date.getUTCDay())
  );
}

async function invoke(job) {
  const url = `${APP_URL}${job.path}`;
  const startedAt = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
      signal: AbortSignal.timeout(10 * 60 * 1000),
    });
    const body = await res.text();
    const ms = Date.now() - startedAt;
    if (!res.ok) {
      console.error(`[scheduler] ${job.name} failed: HTTP ${res.status} in ${ms}ms — ${body.slice(0, 300)}`);
      return;
    }
    console.log(`[scheduler] ${job.name} ok in ${ms}ms — ${body.slice(0, 300)}`);
  } catch (error) {
    console.error(`[scheduler] ${job.name} errored after ${Date.now() - startedAt}ms:`, error?.message ?? error);
  }
}

console.log(`[scheduler] target ${APP_URL} — schedules (UTC):`);
for (const job of JOBS) console.log(`[scheduler]   ${job.schedule.padEnd(12)} ${job.name}`);

/**
 * Tick once a minute, on the minute. Runs are keyed by the minute they belong
 * to so a slow tick or a clock adjustment cannot fire the same job twice.
 */
const alreadyRan = new Set();

async function tick() {
  const now = new Date();
  const key = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}T${now.getUTCHours()}:${now.getUTCMinutes()}`;
  for (const job of JOBS) {
    const runKey = `${job.name}@${key}`;
    if (alreadyRan.has(runKey) || !dueAt(job.schedule, now)) continue;
    alreadyRan.add(runKey);
    void invoke(job);
  }
  // Keep the guard bounded; an hour of minutes is far more than needed.
  if (alreadyRan.size > 500) alreadyRan.clear();
}

function scheduleNextTick() {
  const now = Date.now();
  const msToNextMinute = 60_000 - (now % 60_000);
  setTimeout(async () => {
    await tick();
    scheduleNextTick();
  }, msToNextMinute + 250);
}

// Run any job due in the current minute at start-up too, then align to the clock.
await tick();
scheduleNextTick();

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    console.log(`[scheduler] ${signal} — stopping`);
    process.exit(0);
  });
}
