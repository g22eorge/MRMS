import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";

import { LOCALES, isLocale, localeOrDefault, translate } from "@/lib/i18n";

const read = (path: string) => readFileSync(path, "utf8");

describe("menus in another language", () => {
  it("translates what it knows and leaves the rest in English", () => {
    expect(translate("Clients", "sw")).toBe("Wateja");
    expect(translate("Invoices", "fr")).toBe("Factures");
    expect(translate("Something with no entry", "sw")).toBe("Something with no entry");
  });

  it("is English for English, for no language, and for one it does not have", () => {
    expect(translate("Clients", "en")).toBe("Clients");
    expect(translate("Clients", null)).toBe("Clients");
    expect(translate("Clients", "de")).toBe("Clients");
    expect(localeOrDefault("xx")).toBe("en");
    expect(isLocale("sw")).toBe(true);
  });

  it("covers every label the sidebar shows, in each language offered", () => {
    const registry = read("lib/nav/registry.ts");
    const model = read("lib/nav/sidebar-model.ts");
    const labelByHref = new Map([...registry.matchAll(/\{ href: "([^"]+)", label: "([^"]+)"/g)].map((m) => [m[1], m[2]]));
    const shown = [...model.matchAll(/\{ href: "([^"]+)", label: routeLabel/g)].map((m) => labelByHref.get(m[1])).filter(Boolean) as string[];
    expect(shown.length).toBeGreaterThan(10);
    for (const locale of LOCALES.filter((l) => l.code !== "en")) {
      const untranslated = shown.filter((label) => translate(label, locale.code) === label && !["Documents", "Clients", "POS"].includes(label));
      expect(untranslated).toEqual([]);
    }
  });

  it("is applied where the menus render, from the business's own setting", () => {
    expect(read("components/layout/AppSidebar.tsx")).toContain("translate(item.label, locale)");
    expect(read("components/layout/BottomNav.tsx")).toContain("translate(item.label, locale)");
    expect(read("app/(app)/layout.tsx")).toContain("locale={org?.locale}");
  });
});

describe("a business's own time zone", () => {
  it("decides when today starts on its dashboard", () => {
    const data = read("app/(app)/dashboard/sections/admin-data.ts");
    expect(data).toContain("const todayStart = zonedStartOfDay(today, zone);");
    expect(data).toContain("const mtdStart = zonedStartOfMonth(today, zone);");
  });

  it("is recorded at signup from the browser, and can be changed on the console", () => {
    expect(read("app/(onboarding)/onboarding/actions.ts")).toContain('timezone: zoneOrDefault(String(formData.get("timezone") ?? ""))');
    expect(read("app/(platform)/platform/actions.ts")).toContain("export async function setOrgTimezoneAction(");
  });
});

describe("losing the connection at the till", () => {
  const guard = read("components/layout/ConnectionGuard.tsx");

  it("holds a form back instead of sending it into the void", () => {
    expect(guard).toContain('window.addEventListener("submit", holdSubmit, true);');
    expect(guard).toContain("event.stopImmediatePropagation();");
  });

  it("lets a search or filter through, since those only read", () => {
    expect(guard).toContain('if (form?.method?.toLowerCase() === "get") return;');
  });

  it("shows an honest offline page on reload, and caches nothing else", () => {
    const worker = read("public/sw.js");
    expect(worker).toContain('if (event.request.mode !== "navigate") return;');
    expect(worker).not.toContain("cache.put");
    expect(read("proxy.ts")).toContain('"/sw.js"');
  });
});

describe("a release in progress", () => {
  it("answers with a holding page that reloads itself, not a bare 502", () => {
    for (const site of ["app", "care"]) {
      const conf = read(`deploy/edge/${site}.conf`);
      expect(conf).toContain("error_page 502 503 504 = @mrms_updating;");
      expect(conf).toContain("add_header Retry-After 15 always;");
      expect(conf).toContain('http-equiv="refresh"');
    }
  });
});
