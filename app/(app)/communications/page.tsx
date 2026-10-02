import { redirect } from "next/navigation";

// Communications has been absorbed into Settings → Communications.
// Search params are carried across like the sibling /communications/*
// stubs, so old bookmarks carrying filters don't silently land on an
// unfiltered list.
export default async function CommunicationsHomePage({
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
