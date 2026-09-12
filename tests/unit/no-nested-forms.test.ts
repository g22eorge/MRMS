import { describe, it, expect } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * No <form> inside another <form>.
 *
 * HTML forbids it, and the failure is silent in a way that survives every check
 * a project normally has. TypeScript is happy. The component renders. The
 * button appears and is clickable. But the parser drops the inner form during
 * parsing and re-parents its children, so the button submits the OUTER form's
 * action instead of its own.
 *
 * On the platform settings pages that meant every "Clear" button ran the save
 * action with empty text boxes — which, because a blank field means "keep the
 * existing value", did nothing at all. The owner pressed Clear on an SMS sender
 * ID three times and reported the same output each time; two of those rounds
 * were spent looking at credentials because the button gave no sign it had not
 * worked. It was found by disbelieving the third identical result rather than
 * by reading the markup.
 *
 * A scan, because the defect is structural and cheap to reintroduce: any future
 * "add a small form here" inside a card that is already a form does it again.
 */

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) tsxFiles(full, out);
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/** Comments mention <form> when explaining this very rule; they are not markup. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/[^\n]*$/gm, "");
}

function maxFormDepth(src: string): number {
  const code = stripComments(src);
  let depth = 0;
  let max = 0;
  // Opening tags only — <form> or <form ... — never </form> or a JSX prop.
  for (const m of code.matchAll(/<\/?form(?=[\s>])/g)) {
    if (m[0].startsWith("</")) depth = Math.max(0, depth - 1);
    else max = Math.max(max, ++depth);
  }
  return max;
}

describe("no form is nested inside another", () => {
  const files = [...tsxFiles("app"), ...tsxFiles("components")];

  it("scans a meaningful number of components", () => {
    // Guards the guard: a broken walker finding nothing would pass silently.
    expect(files.length).toBeGreaterThan(100);
  });

  it("finds no nesting anywhere", () => {
    const offenders = files.filter((f) => maxFormDepth(readFileSync(f, "utf8")) > 1);
    expect(offenders).toEqual([]);
  });

  it("the two cards that had it no longer wrap the button in a form at all", () => {
    for (const f of [
      "components/platform/ATSmsPlatformSettingsForm.tsx",
      "components/platform/PesapalSettingsForm.tsx",
    ]) {
      const src = readFileSync(f, "utf8");
      // formAction was the first fix and is no longer used for these: the
      // button calls the server action directly, which has no form semantics
      // to get wrong. See "the Clear control reports what happened" below.
      expect(src).toContain('type="button"');

      // Scoped to inside the save form. Pesapal has a second Clear in the IPN
      // block below it, which is a standalone form and correct as it is — the
      // depth scan above confirms it is not nested. What must not appear is a
      // hidden "key" inside the save form: every row would contribute one, and
      // formData.get("key") returns the first, clearing the wrong setting.
      const open = src.indexOf("<form action={saveAction}");
      const close = src.indexOf("</form>", open);
      expect(open).toBeGreaterThan(-1);
      expect(src.slice(open, close)).not.toContain('<input type="hidden" name="key"');
    }
  });
});

describe("the detector itself works", () => {
  it("catches nesting", () => {
    expect(maxFormDepth('<form action={a}><form action={b}></form></form>')).toBe(2);
  });

  it("allows forms in sequence", () => {
    expect(maxFormDepth('<form action={a}></form><form action={b}></form>')).toBe(1);
  });

  it("ignores the word in a comment, which is how this rule is documented", () => {
    expect(maxFormDepth('<form action={a}>\n// not a nested <form> here\n</form>')).toBe(1);
  });

  it("does not mistake formAction for a form tag", () => {
    expect(maxFormDepth('<form action={a}><button formAction={b} /></form>')).toBe(1);
  });
});

describe("the Clear control reports what happened", () => {
  const CARDS = [
    "components/platform/ATSmsPlatformSettingsForm.tsx",
    "components/platform/PesapalSettingsForm.tsx",
  ];

  /**
   * Two attempts at this button both failed silently, and the silence is why
   * they took three rounds each to notice. First it was a nested form, so the
   * click ran the save action instead. Then it used formAction, which may well
   * have worked — but the result was destructured away with `const [, action]`,
   * so a success, a failure and a dead button all looked identical.
   *
   * A destructive control that cannot say whether it did anything is the
   * defect, separately from whichever mechanism is underneath it.
   */
  for (const f of CARDS) {
    const src = () => readFileSync(f, "utf8");

    it(`${f} calls the action directly, with no form semantics to get wrong`, () => {
      expect(src()).toContain('type="button"');
      expect(src()).not.toContain("formAction={clearAction}");
    });

    it(`${f} keeps the result instead of discarding it`, () => {
      expect(src()).toContain("setCleared({ key: f.key, ok: res.ok, error: res.error })");
    });

    it(`${f} renders that result where the button is`, () => {
      const s = src();
      expect(s).toContain("cleared?.key === f.key");
      expect(s).toContain('"Cleared."');
      expect(s).toContain("Could not clear.");
    });

    it(`${f} shows a pending state, so a slow clear is not read as a dead one`, () => {
      expect(src()).toContain("setClearingKey(f.key)");
      expect(src()).toContain('"Clearing…"');
    });
  }
});

describe("no action result is thrown away", () => {
  /**
   * The other half of the Clear-button defect, and the more expensive half.
   * `const [, action] = useActionState(...)` discards the state, so a failure
   * renders exactly like a success and exactly like a dead control. Two
   * mechanisms were tried under that button and both failed silently; the
   * silence is what cost three rounds each time.
   *
   * A scan, because the pattern is one character away from correct and reads as
   * deliberate.
   */
  const files = [...tsxFiles("app"), ...tsxFiles("components")];

  it("finds no discarded useActionState result", () => {
    const offenders = files.filter((f) =>
      /const\s*\[\s*,\s*[A-Za-z_$][\w$]*\s*\]\s*=\s*useActionState/.test(readFileSync(f, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("the detector recognises the pattern it is looking for", () => {
    // Guards the guard: a regex that matches nothing would pass forever.
    const sample = "const [, doThing] = useActionState(action, null);";
    expect(/const\s*\[\s*,\s*[A-Za-z_$][\w$]*\s*\]\s*=\s*useActionState/.test(sample)).toBe(true);
  });

  it("does not flag a kept result", () => {
    const sample = "const [state, doThing] = useActionState(action, null);";
    expect(/const\s*\[\s*,\s*[A-Za-z_$][\w$]*\s*\]\s*=\s*useActionState/.test(sample)).toBe(false);
  });
});
