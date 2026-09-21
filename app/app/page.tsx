// Reads the live session; never prerender.
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";

export default async function AppEntryPage() {
  const session = await getSession();
  redirect(session?.user ? "/dashboard" : "/login");
}
