/**
 * Parses prisma/schema.prisma into a plain description of models, scalar
 * columns and enums.
 *
 * Deliberately a small hand-rolled parser rather than a Prisma internal API:
 * the migration tooling has to keep working while the schema's provider
 * changes underneath it, and it must run before the client is regenerated.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

const SCALARS = new Set([
  "String", "Int", "Float", "Boolean", "DateTime", "Json", "Decimal", "BigInt", "Bytes",
]);

/** Strip `//` line comments without touching `://` inside strings/urls. */
function stripComments(src) {
  return src
    .split("\n")
    .map((line) => {
      let out = "";
      let inString = false;
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (ch === '"') inString = !inString;
        if (!inString && ch === "/" && line[i + 1] === "/") break;
        out += ch;
      }
      return out;
    })
    .join("\n");
}

export function parseSchema(schemaPath = path.join(process.cwd(), "prisma", "schema.prisma")) {
  const raw = readFileSync(schemaPath, "utf8");
  const src = stripComments(raw);

  const enums = new Map();
  for (const m of src.matchAll(/^enum\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const values = m[2]
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(l));
    enums.set(m[1], values);
  }

  const provider = /datasource\s+\w+\s*\{[\s\S]*?provider\s*=\s*"([^"]+)"/.exec(src)?.[1] ?? null;

  const models = new Map();
  for (const m of src.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const [, name, body] = m;
    const columns = new Map();
    let tableName = name;

    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;

      const mapTable = /^@@map\("([^"]+)"\)/.exec(line);
      if (mapTable) { tableName = mapTable[1]; continue; }
      if (line.startsWith("@@")) continue;

      const field = /^(\w+)\s+(\w+)(\[\])?(\?)?(.*)$/.exec(line);
      if (!field) continue;
      const [, fieldName, fieldType, isList, isOptional, rest] = field;

      // Relation list fields and object relations are not columns.
      if (isList) continue;
      const isEnum = enums.has(fieldType);
      if (!SCALARS.has(fieldType) && !isEnum) continue;

      const mapped = /@map\("([^"]+)"\)/.exec(rest ?? "");
      const column = mapped ? mapped[1] : fieldName;

      columns.set(column, {
        field: fieldName,
        column,
        type: fieldType,
        isEnum,
        optional: Boolean(isOptional),
        hasDefault: /@default\(/.test(rest ?? ""),
        isId: /@id\b/.test(rest ?? ""),
        isUpdatedAt: /@updatedAt\b/.test(rest ?? ""),
        native: /@db\.(\w+(\([^)]*\))?)/.exec(rest ?? "")?.[1] ?? null,
      });
    }

    models.set(name, { model: name, table: tableName, columns });
  }

  return { provider, models, enums };
}

/** Column names, per table, that a data migration must be able to fill. */
export function requiredWithoutDefault(model) {
  return [...model.columns.values()].filter(
    (c) => !c.optional && !c.hasDefault && !c.isUpdatedAt,
  );
}
