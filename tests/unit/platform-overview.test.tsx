import { describe, it, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { PlatformOverview } from "@/app/(platform)/platform/PlatformOverview";

/**
 * The console's summary answers three questions in order: does anything need
 * the operator, what is coming in, and who is using it. These pin the wording
 * each state produces, since the page cannot be opened without a platform
 * admin account.
 */
const base = {
  attention: [],
  mrr: 0,
  payingCount: 0,
  atRiskMrr: 0,
  collectedThisMonth: 0,
  collectedAllTime: 0,
  trialsRunning: 0,
  trialsEndingSoon: 0,
  trialsExpired: 0,
  signedInThisWeek: 0,
  activeOrgCount: 0,
  totalUsers: 0,
  newThisMonth: 0,
  planMix: [
    { plan: "STARTER", count: 0 },
    { plan: "STANDARD", count: 0 },
    { plan: "GROWTH", count: 0 },
    { plan: "PREMIUM", count: 0 },
    { plan: "ENTERPRISE", count: 0 },
  ],
};

describe("PlatformOverview", () => {
  it("says so plainly when nothing needs attention", () => {
    const html = renderToStaticMarkup(<PlatformOverview {...base} />);
    expect(html).toContain("All clear");
    expect(html).toContain("No active organisation is past due");
  });

  it("lists what needs attention worst first, each linking to its organisation", () => {
    const html = renderToStaticMarkup(
      <PlatformOverview
        {...base}
        attention={[
          { id: "org-trial", name: "Trial Co", rank: 2, reason: "Trial ending", detail: "in 3 days" },
          { id: "org-due", name: "Late Co", rank: 0, reason: "Past due", detail: "Growth plan" },
          { id: "org-lapsed", name: "Lapsed Co", rank: 1, reason: "Trial ended", detail: "12 days ago" },
        ]}
      />,
    );
    expect(html).toContain("3 to look at");
    expect(html.indexOf("Late Co")).toBeLessThan(html.indexOf("Lapsed Co"));
    expect(html.indexOf("Lapsed Co")).toBeLessThan(html.indexOf("Trial Co"));
    expect(html).toContain('href="/platform/orgs/org-due"');
  });

  it("shows recurring revenue with what is at risk, and trials with what has lapsed", () => {
    const html = renderToStaticMarkup(
      <PlatformOverview
        {...base}
        mrr={139_700}
        payingCount={3}
        atRiskMrr={39_900}
        trialsRunning={4}
        trialsEndingSoon={1}
        trialsExpired={2}
        signedInThisWeek={5}
        activeOrgCount={9}
        totalUsers={46}
        newThisMonth={0}
      />,
    );
    expect(html).toContain("3 paying customers");
    expect(html).toContain("more is past due");
    expect(html).toContain("1 end within 7 days");
    expect(html).toContain("2 ended without converting");
    expect(html).toContain("5 of 9");
    expect(html).toContain("no new organisations this month");
  });

  it("shows an unknown sign-in count as unknown, not as zero", () => {
    const html = renderToStaticMarkup(<PlatformOverview {...base} signedInThisWeek={null} activeOrgCount={9} />);
    expect(html).toContain("—");
    expect(html).not.toContain("0 of 9");
  });

  it("draws one plan bar with a labelled count per plan", () => {
    const html = renderToStaticMarkup(
      <PlatformOverview
        {...base}
        planMix={[
          { plan: "STARTER", count: 2 },
          { plan: "STANDARD", count: 2 },
          { plan: "GROWTH", count: 4 },
          { plan: "PREMIUM", count: 0 },
          { plan: "ENTERPRISE", count: 1 },
        ]}
      />,
    );
    expect(html).toContain("9 active");
    expect(html).toContain("width:44.4");
    for (const label of ["Starter", "Standard", "Growth", "Premium", "Enterprise"]) expect(html).toContain(label);
  });
});
