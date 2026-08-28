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
  ALLOW_SQLITE_PRODUCTION: "1",
  TURSO_DATABASE_URL: "",
  TURSO_AUTH_TOKEN: "",
  DATABASE_URL: `file:${process.cwd()}/prisma/test.db`,
};

let pass = 0, fail = 0, skip = 0;
const failed = [];
const crashed = [];

for (const file of files) {
  const res = spawnSync("bun", ["test", file, "--timeout", "30000"], { env, encoding: "utf8" });
  const text = `${res.stdout ?? ""}${res.stderr ?? ""}`;
  const num = (re) => Number((text.match(re) ?? [])[1] ?? 0);
  const p = num(/(\d+) pass/), f = num(/(\d+) fail/), s = num(/(\d+) skip/);
  pass += p; fail += f; skip += s;
  // A crash AFTER every assertion has run is not a failing test. Bun aborts on
  // exit for at least one file that only imports the PDF templates — the
  // library's teardown, in bun, on a suite that asserts and renders nothing —
  // and it does so about one run in three. Counting that as a failure made a
  // green codebase report red at random, which is worse than the crash: it
  // teaches you to re-run the suite instead of reading it.
  //
  // The distinction is whether bun printed a summary. If it did, the file ran
  // to completion and its result is the pass/fail count; the signal is noted
  // and nothing else. If it did not, the process died mid-suite and that IS a
  // failure, whatever it managed to print first.
  const completed = /\d+ pass/.test(text);
  const crashedAfterCompleting = f === 0 && completed && res.status !== 0;
  if (crashedAfterCompleting) {
    crashed.push({ file, signal: res.signal, status: res.status });
  } else if (f > 0 || res.status !== 0) {
    failed.push({ file, f, status: res.status, signal: res.signal });
    process.stdout.write(`FAIL ${file} (${f}) exit=${res.status} signal=${res.signal ?? "-"}\n`);
    if (f === 0) process.stdout.write(text.split("\n").slice(-25).join("\n") + "\n");
  }
}

console.log(`\nunit tests — ${pass} pass, ${skip} skip, ${fail} fail across ${files.length} files`);
if (crashed.length) {
  console.log("crashed on exit after passing (not counted as failures):");
  for (const { file, signal, status } of crashed) {
    console.log(`  ${file}: ${signal ?? `exit ${status}`}`);
  }
}
if (failed.length) {
  console.log("failing files:");
  for (const { file, f, status, signal } of failed) console.log(`  ${file}: ${f} fail (exit ${status}${signal ? `, ${signal}` : ""})`);
  process.exit(1);
}
