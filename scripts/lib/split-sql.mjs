/**
 * Splits generated DDL into statements without cutting inside string literals.
 *
 * This used to be a plain `ddl.split(";")` in sync-schema-to-db.mjs, on the
 * stated assumption that "no semicolons appear inside identifiers/defaults in
 * generated DDL". That held until someone put a semicolon in a default value —
 * DocumentBrandingSettings.termsText begins "We supply equipment and carry out
 * repairs; only the terms relevant to this document apply." — after which the
 * CREATE TABLE for that model was truncated mid-statement and every column
 * after termsText became invisible to the reconciler. It could not add those
 * columns to a database missing them, and nothing reported a problem: the
 * truncated tail simply did not match CREATE TABLE or CREATE INDEX, so it was
 * dropped on the floor.
 *
 * The failure is silent and data-dependent, which is the worst combination, so
 * the splitter tracks quoting instead of assuming it away. SQLite escapes a
 * quote by doubling it ('' inside '...'), which needs no special case here:
 * the closing quote of the pair toggles the state off and the opening quote of
 * the next pair toggles it straight back on.
 */

export function splitSqlStatements(ddl) {
  const statements = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;

  for (const ch of ddl) {
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;

    if (ch === ";" && !inSingle && !inDouble) {
      statements.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  statements.push(current);

  return statements
    .map((chunk) =>
      chunk
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((s) => s.length > 0);
}
