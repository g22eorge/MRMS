import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * `noValidate` switches off the browser's own checking for a whole form.
 *
 * Two client forms carried it without reason — added in passing, one inside a
 * commit about template chevrons — and it quietly disabled the `required`
 * markers sitting on the fields beneath. The forms asked for a name and a
 * phone, marked both with a star, and then let an empty submission travel to
 * the server to be refused there. The attribute looks inert; it is not.
 *
 * It is legitimate in exactly one shape: a form doing its own validation in an
 * onSubmit handler, which needs the native pass out of the way. That is why the
 * check below is "noValidate implies onSubmit" rather than a ban.
 */

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsxFiles(full));
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("no form silently opts out of browser validation", () => {
  it("only uses noValidate on forms that validate themselves", () => {
    const offenders: string[] = [];

    for (const file of [...tsxFiles("app"), ...tsxFiles("components")]) {
      const src = readFileSync(file, "utf8");
      // Ignore prose: the word appears in comments explaining this very rule.
      const withoutComments = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
      if (!/\bnoValidate\b/.test(withoutComments)) continue;

      // The attribute is only defensible on a form with its own submit handler.
      for (const tag of withoutComments.match(/<form[^>]*>/g) ?? []) {
        if (/\bnoValidate\b/.test(tag) && !/onSubmit=/.test(tag)) {
          offenders.push(`${file}: ${tag.slice(0, 90)}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("keeps the client and lead forms' constraints matching their schemas", () => {
    // The browser should refuse exactly what zod would refuse — no more, so a
    // valid submission is never blocked, and no less, so the round-trip is
    // saved. Create allows a 3-character phone; the edit form requires 4.
    const clients = readFileSync("app/(app)/clients/page.tsx", "utf8");
    expect(clients).toMatch(/name="fullName"[^>]*required[^>]*minLength=\{2\}/);
    expect(clients).toMatch(/name="phone"[^>]*required[^>]*minLength=\{3\}/);
    expect(clients).toMatch(/name="email"[^>]*type="email"/);

    const profile = readFileSync("components/clients/ClientProfileCard.tsx", "utf8");
    expect(profile).toMatch(/name="fullName"[^>]*required[^>]*minLength=\{2\}/);
    expect(profile).toMatch(/name="phone"[^>]*required[^>]*minLength=\{4\}/);

    const sales = readFileSync("app/(app)/sales/page.tsx", "utf8");
    expect(sales).toMatch(/name="fullName"[^>]*required[^>]*minLength=\{2\}/);
    expect(sales).toMatch(/name="phone"[^>]*required[^>]*minLength=\{3\}/);
    expect(sales).toMatch(/name="email"[^>]*type="email"/);
  });
});
