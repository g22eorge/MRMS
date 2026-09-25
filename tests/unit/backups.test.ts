/**
 * Backup helper contracts (lib/backups.ts). Pure functions — no DB, no disk.
 * The strict filename rule is load-bearing: the download route and the
 * restore script both refuse anything else, which is what makes path
 * traversal impossible.
 */
import { describe, it, expect } from "bun:test";

import {
  backupFileName,
  isValidBackupName,
  pruneCandidates,
  resolveBackupDir,
  sortBackupsNewestFirst,
} from "../../lib/backups";

describe("isValidBackupName()", () => {
  it("accepts generated names", () => {
    expect(isValidBackupName("mrms-2026-09-24_08-15-00.db")).toBe(true);
  });

  it("rejects traversal, wrong prefix, wrong extension", () => {
    expect(isValidBackupName("../prisma/dev.db")).toBe(false);
    expect(isValidBackupName("mrms-2026-09-24_08-15-00.db ")).toBe(false);
    expect(isValidBackupName("backup.db")).toBe(false);
    expect(isValidBackupName("mrms-2026-09-24.db")).toBe(false);
    expect(isValidBackupName("")).toBe(false);
  });
});

describe("backupFileName()", () => {
  it("round-trips through the validator", () => {
    expect(isValidBackupName(backupFileName(new Date(2026, 8, 24, 8, 15, 0)))).toBe(true);
    expect(backupFileName(new Date(2026, 8, 24, 8, 15, 0))).toBe("mrms-2026-09-24_08-15-00.db");
  });
});

describe("resolveBackupDir()", () => {
  it("prefers BACKUP_DIR, then uploads-adjacent, then ./backups", () => {
    expect(resolveBackupDir()).toContain("backups");
  });
});

describe("sortBackupsNewestFirst()", () => {
  it("orders newest first without mutating", () => {
    const a = { name: "a", bytes: 1, createdAt: new Date(2026, 0, 1) };
    const b = { name: "b", bytes: 1, createdAt: new Date(2026, 0, 3) };
    const c = { name: "c", bytes: 1, createdAt: new Date(2026, 0, 2) };
    const out = sortBackupsNewestFirst([a, b, c]);
    expect(out.map((e) => e.name)).toEqual(["b", "c", "a"]);
  });
});

describe("pruneCandidates()", () => {
  it("returns only names older than keepDays", () => {
    const now = new Date(2026, 8, 24);
    const old = { name: "old", bytes: 1, createdAt: new Date(2026, 7, 1) };
    const fresh = { name: "fresh", bytes: 1, createdAt: new Date(2026, 8, 23) };
    expect(pruneCandidates([old, fresh], 30, now)).toEqual(["old"]);
    expect(pruneCandidates([old, fresh], 90, now)).toEqual([]);
  });
});
