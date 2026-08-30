/**
 * Counted nouns, written the way a person says them.
 *
 * The codebase pluralises inline in about 25 places — `${n} day${n !== 1 ? "s"
 * : ""}` — which is correct but repeated, and two pages had drifted to
 * "job(s)", a form nobody says aloud. This is the shared version.
 *
 * Not a general pluralisation library: irregular nouns take the second
 * argument. That is deliberate — inferring "parties" from "party" needs a word
 * list, and every caller here already knows the plural it wants.
 */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** The verb that agrees with `plural(count, ...)`. */
export function verbFor(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}
