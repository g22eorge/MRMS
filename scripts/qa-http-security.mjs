#!/usr/bin/env node

const base = process.env.QA_BASE_URL ?? "http://localhost:3000";

const checks = [
  { path: "/api/jobs", name: "jobs API unauth" },
  { path: "/api/reports/export?type=pipeline-aging", name: "reports export unauth" },
  { path: "/clients", name: "clients route unauth" },
  { path: "/jobs", name: "jobs route unauth" },
];

let failed = false;

for (const check of checks) {
  try {
    const response = await fetch(`${base}${check.path}`, {
      redirect: "manual",
      headers: { accept: "text/html,application/json" },
    });

    if (response.status === 200) {
      console.error(`FAIL: ${check.name} returned 200`);
      failed = true;
      continue;
    }

    console.log(`OK: ${check.name} returned ${response.status}`);
  } catch (error) {
    console.error(`FAIL: ${check.name} request error`, error.message);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log("OK: unauthenticated access checks passed.");
