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
  it("accepts the three names this project produces", () => {
    expect(isValidBackupName("mrms-20261004T020000Z.dump")).toBe(true); // backup service
    expect(isValidBackupName("mrms-dev-20261004-020000.dump")).toBe(true); // pg:export
    expect(isValidBackupName("mrms-prerestore-20261004T020000Z.dump")).toBe(true); // restore-db.sh
  });

  it("rejects the SQLite-era names — those files cannot be restored any more", () => {
    expect(isValidBackupName("mrms-2026-09-24_08-15-00.db")).toBe(false);
  });

  it("rejects traversal, wrong prefix, wrong extension, padding", () => {
    expect(isValidBackupName("../prisma/dev.db")).toBe(false);
    expect(isValidBackupName("../../etc/passwd")).toBe(false);
    expect(isValidBackupName("mrms-20261004T020000Z.dump ")).toBe(false);
    expect(isValidBackupName(" mrms-20261004T020000Z.dump")).toBe(false);
    expect(isValidBackupName("mrms-20261004T020000Z.dump.partial")).toBe(false);
    expect(isValidBackupName("backups/mrms-20261004T020000Z.dump")).toBe(false);
    expect(isValidBackupName("mrms-20261004T020000Z.sql")).toBe(false);
    expect(isValidBackupName("other-20261004T020000Z.dump")).toBe(false);
    expect(isValidBackupName("")).toBe(false);
  });
});

describe("backupFileName()", () => {
  it("matches the backup service's UTC naming, and round-trips the validator", () => {
    const at = new Date(Date.UTC(2026, 9, 4, 2, 0, 0));
    expect(backupFileName(at)).toBe("mrms-20261004T020000Z.dump");
    expect(isValidBackupName(backupFileName(at))).toBe(true);
  });
});

describe("resolveBackupDir()", () => {
  it("prefers BACKUP_DIR, else ./backups", () => {
    const saved = process.env.BACKUP_DIR;
    try {
      process.env.BACKUP_DIR = "/backups";
      expect(resolveBackupDir()).toBe("/backups");
      delete process.env.BACKUP_DIR;
      expect(resolveBackupDir().endsWith("/backups")).toBe(true);
    } finally {
      if (saved === undefined) delete process.env.BACKUP_DIR;
      else process.env.BACKUP_DIR = saved;
    }
  });
});

describe("sortBackupsNewestFirst()", () => {
  it("orders newest first without mutating", () => {
    const a = { name: "a", bytes: 1, createdAt: new Date(2026, 0, 1) };
    const b = { name: "b", bytes: 1, createdAt: new Date(2026, 0, 3) };
    const c = { name: "c", bytes: 1, createdAt: new Date(2026, 0, 2) };
    const input = [a, b, c];
    const out = sortBackupsNewestFirst(input);
    expect(out.map((e) => e.name)).toEqual(["b", "c", "a"]);
    expect(input.map((e) => e.name)).toEqual(["a", "b", "c"]);
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
