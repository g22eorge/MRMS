/**
 * A small CSV reader for the spreadsheet import: quoted fields, doubled quotes,
 * commas and line breaks inside quotes, CRLF or LF, and the byte-order mark
 * Excel adds. Semicolon-separated files (Excel in some regions) are detected
 * from the header line.
 */
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^﻿/, "");
  const firstLine = input.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop lines that are entirely empty (trailing newlines, spacer rows).
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

/** Header text to a comparable key: "Full Name" and "full_name" both become "fullname". */
export function headerKey(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Map a header row to column positions, by any of the names people use for
 * each field. Returns -1 for a field the file does not have.
 */
export function mapColumns<T extends string>(headers: string[], aliases: Record<T, string[]>): Record<T, number> {
  const keys = headers.map(headerKey);
  const out = {} as Record<T, number>;
  for (const field of Object.keys(aliases) as T[]) {
    out[field] = keys.findIndex((key) => aliases[field].includes(key));
  }
  return out;
}

/** "1,250,000", "UGX 45000" and "45000.50" all read as numbers; anything else is null. */
export function parseAmount(value: string | undefined): number | null {
  if (value == null) return null;
  const cleaned = value.replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}
