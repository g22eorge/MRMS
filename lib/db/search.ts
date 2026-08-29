/**
 * Case-insensitive text search that works on both database engines.
 *
 * The two engines disagree, and they disagree silently:
 *
 *   SQLite      LIKE folds ASCII case by default, so `contains: "amina"` finds
 *               "Amina Yusuf". Prisma's `mode` argument does not exist on this
 *               provider at all — passing it throws "Unknown argument `mode`".
 *
 *   PostgreSQL  LIKE is case-sensitive. `contains: "amina"` finds nothing, and
 *               `mode: "insensitive"` is the only way to get the SQLite
 *               behaviour back.
 *
 * So neither spelling is portable: writing `mode: "insensitive"` everywhere
 * breaks the system that runs today, and leaving it out breaks every search box
 * the day it moves to Postgres — without an error, just fewer results, which is
 * the harder failure to notice.
 *
 * This is the one place that knows the difference. Call sites read the same on
 * both engines, and a migration becomes a change to the constant below rather
 * than an edit to a hundred-odd query filters under time pressure.
 */

/**
 * True when the configured datasource is PostgreSQL.
 *
 * Read once at module load from the datasource URL rather than from the Prisma
 * client, because the client's own type surface is what differs between the two
 * providers — asking it would mean already having chosen.
 */
const IS_POSTGRES = /^postgres(ql)?:\/\//i.test(
  process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "",
);

/** Exposed for tests and for the health endpoint to report what it resolved to. */
export function searchIsCaseInsensitiveByDefault() {
  return !IS_POSTGRES;
}

/**
 * A "contains" filter that matches regardless of case on either engine.
 *
 * The return type is narrowed to what the SQLite client accepts so call sites
 * typecheck under the provider in use; the extra key is attached at runtime and
 * is only ever read by Postgres, which is the provider that asks for it.
 */
export function icontains(value: string): { contains: string } {
  const filter: Record<string, unknown> = { contains: value };
  if (IS_POSTGRES) filter.mode = "insensitive";
  return filter as { contains: string };
}

/**
 * The same, for a value that may be absent.
 *
 * Returns undefined so it can be spread into a `where` without the caller
 * writing a conditional, and so an empty search does not become a filter that
 * matches everything with an empty string.
 */
export function icontainsOrUndefined(value: string | null | undefined) {
  const v = (value ?? "").trim();
  return v ? icontains(v) : undefined;
}
