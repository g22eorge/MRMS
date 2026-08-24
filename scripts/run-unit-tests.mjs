/**
 * run-unit-tests.mjs
 *
 * Runs every file under tests/unit in its OWN bun process.
 *
 * Why not plain `bun test tests/unit`? Several suites call `mock.module(...)`
 * (e.g. stubbing "@/lib/prisma"). Bun's module mocks are process-global and are
 * not unwound between files, so whichever file registers a stub first poisons
 * every file loaded after it — 34 tests failed together while all of them passed
 * individually. Isolating per file removes that cross-talk and makes a green run
 * mean something.
 *
 * Exits non-zero if any file fails, and prints a per-file summary of failures.
 */
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "tests/unit";

function collect(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collect(full));
    else if (entry.endsWith(".test.ts") || entry.endsWith(".test.tsx")) out.push(full);
  }
  return out.sort();
}

const files = collect(ROOT);
const env = {
  ...process.env,
  // The scratch Postgres container (docker-compose.dev.yml, port 5434) so a
  // test run can never touch the development database. An explicitly provided
  // DATABASE_URL wins, which is how CI points this at its own service.
  DATABASE_URL:
    process.env.DATABASE_URL
    ?? "postgresql://mrms:mrms_dev_password@localhost:5434/mrms_scratch?schema=public",
};

let pass = 0, fail = 0, skip = 0;
const failed = [];

for (const file of files) {
  const res = spawnSync("bun", ["test", file, "--timeout", "30000"], { env, encoding: "utf8" });
  const text = `${res.stdout ?? ""}${res.stderr ?? ""}`;
  const num = (re) => Number((text.match(re) ?? [])[1] ?? 0);
  const p = num(/(\d+) pass/), f = num(/(\d+) fail/), s = num(/(\d+) skip/);
  pass += p; fail += f; skip += s;
  if (f > 0 || res.status !== 0) {
    failed.push({ file, f });
    process.stdout.write(`FAIL ${file} (${f})\n`);
  }
}

console.log(`\nunit tests — ${pass} pass, ${skip} skip, ${fail} fail across ${files.length} files`);
if (failed.length) {
  console.log("failing files:");
  for (const { file, f } of failed) console.log(`  ${file}: ${f}`);
  process.exit(1);
}
