export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { DeleteWorkspaceForm } from "@/components/settings/DeleteWorkspaceForm";
import { ImportForm } from "@/components/settings/ImportForm";
import { EIS_ORG_ID } from "@/lib/org";
import { requireOrgSession } from "@/lib/org-context";

import { importClientsAction, importProductsAction, requestWorkspaceDeletionAction } from "./actions";

const CLIENT_TEMPLATE = "data:text/csv;charset=utf-8," + encodeURIComponent("Name,Phone,Email,Company,Address\nJane Akello,0772123456,jane@example.com,Akello Traders,Kampala Road\n");
const PRODUCT_TEMPLATE = "data:text/csv;charset=utf-8," + encodeURIComponent("Name,Code,Cost,Price,Quantity,Category\nUSB-C cable 1m,,8000,15000,24,Cables\n");

/**
 * Getting data in and out of a workspace: bring clients and products in from a
 * spreadsheet, download everything, or close the workspace for good.
 */
export default async function SettingsDataPage() {
  const { user, orgId, org } = await requireOrgSession();
  if (user.role !== "ADMIN") redirect("/settings/profile");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-[var(--ink)]">Your data</h1>
        <p className="text-[0.8125rem] text-[var(--ink-muted)]">Bring it in, take it out.</p>
      </div>

      <ImportForm
        title="Import clients"
        columns="Name and Phone are needed. Email, Company and Address are optional."
        templateHref={CLIENT_TEMPLATE}
        action={importClientsAction}
      />
      <ImportForm
        title="Import products"
        columns="Name is needed. Code, Cost, Price, Quantity and Category are optional."
        templateHref={PRODUCT_TEMPLATE}
        action={importProductsAction}
      />

      <section className="dc-card space-y-2 px-4 py-3.5">
        <h2 className="text-sm font-semibold text-[var(--ink)]">Download everything</h2>
        <p className="text-[0.8125rem] text-[var(--ink-muted)]">One file with all your records. Passwords and sign-in details are left out.</p>
        <a href="/api/workspace/export" className="inline-block rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] font-semibold text-[var(--ink)] hover:border-[var(--accent)]/40">
          Download my data
        </a>
      </section>

      {orgId !== EIS_ORG_ID ? (
        <section className="dc-card space-y-2 border-red-500/20 px-4 py-3.5">
          <h2 className="text-sm font-semibold text-red-600">Close this workspace</h2>
          <p className="text-[0.8125rem] text-[var(--ink-muted)]">
            Everyone is signed out straight away and the data is deleted within 30 days. Download it first. This cannot be undone once the data is gone.
          </p>
          <DeleteWorkspaceForm orgName={org.name ?? ""} action={requestWorkspaceDeletionAction} />
        </section>
      ) : null}
    </div>
  );
}
