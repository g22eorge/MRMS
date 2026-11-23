import { describe, it, expect } from "bun:test";

import { headerKey, mapColumns, parseAmount, parseCsv } from "@/lib/import/csv";

describe("reading a spreadsheet saved as CSV", () => {
  it("handles quoted commas, doubled quotes and line breaks inside a field", () => {
    const rows = parseCsv('Name,Note\n"Akello, Jane","said ""hello""\nthen left"\n');
    expect(rows).toEqual([["Name", "Note"], ["Akello, Jane", 'said "hello"\nthen left']]);
  });

  it("drops the byte-order mark Excel adds, and Windows line endings", () => {
    expect(parseCsv("﻿Name,Phone\r\nJane,0772\r\n")).toEqual([["Name", "Phone"], ["Jane", "0772"]]);
  });

  it("reads semicolon-separated files", () => {
    expect(parseCsv("Name;Phone\nJane;0772\n")).toEqual([["Name", "Phone"], ["Jane", "0772"]]);
  });

  it("ignores blank lines", () => {
    expect(parseCsv("Name\n\nJane\n,\n")).toEqual([["Name"], ["Jane"]]);
  });
});

describe("matching a file's columns to fields", () => {
  it("accepts the names people actually use", () => {
    expect(headerKey("Full Name")).toBe("fullname");
    const col = mapColumns(["Customer Name", "Mobile", "E-mail address"], {
      fullName: ["name", "customername"],
      phone: ["phone", "mobile"],
      email: ["email", "emailaddress"],
    });
    expect(col).toEqual({ fullName: 0, phone: 1, email: 2 });
  });

  it("marks a field the file does not have", () => {
    expect(mapColumns(["Name"], { name: ["name"], phone: ["phone"] }).phone).toBe(-1);
  });
});

describe("reading an amount", () => {
  it("accepts thousands separators and a currency prefix", () => {
    expect(parseAmount("1,250,000")).toBe(1250000);
    expect(parseAmount("UGX 45000")).toBe(45000);
    expect(parseAmount("12.50")).toBe(12.5);
  });

  it("returns null for anything that is not a number", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("n/a")).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
  });
});
