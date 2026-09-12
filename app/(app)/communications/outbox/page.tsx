import { redirect } from "next/navigation";

// Absorbed into Settings → Communications → Outbox.
// The search params are carried across: this page is reached from old
// bookmarks that may still carry filters, and dropping them silently returned
// an unfiltered list that looked like the filter had failed.
export default async function CommunicationsOutboxRedirect({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : {};
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") qs.set(k, v);
    else if (Array.isArray(v) && v[0] != null) qs.set(k, v[0]);
  }
  const q = qs.toString();
  redirect(`/settings/notifications/outbox${q ? `?${q}` : ""}`);
}
