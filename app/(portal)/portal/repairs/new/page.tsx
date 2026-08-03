import Link from "next/link";

import { requirePortalSession } from "@/lib/portal-auth";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { SubmitForm } from "./SubmitForm";

export const dynamic = "force-dynamic";

export default async function NewPortalRepairPage() {
  const { portalUser, client, org, accessibleClients } = await requirePortalSession();
  const companyName = client.organization || client.fullName;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <PortalHeader orgName={org.name} userName={portalUser.name} role={portalUser.role} company={companyName} active="repairs" accounts={accessibleClients} activeClientId={client.id} />

      <Link href="/portal/repairs" className="text-[13px] text-[var(--ink-muted)] hover:text-[var(--ink)]">← All repairs</Link>

      <div className="mb-3 mt-2">
        <h1 className="text-lg font-black text-[var(--ink)]">Submit a repair</h1>
        <p className="text-[13px] text-[var(--ink-muted)]">
          Tell {org.name} what needs fixing. Your request goes to their intake team, who will confirm and open a repair.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <SubmitForm />
      </div>
    </div>
  );
}
