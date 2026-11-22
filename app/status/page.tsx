import { redirect } from "next/navigation";

/**
 * `/status` on its own has never resolved: the only route here is
 * `/status/[...jobNumber]`, a catch-all for tracking one repair, so a bare visit
 * fell through to a 404 while still being listed as a public path. Repair
 * tracking links carry a job number; anyone arriving without one wants the shop.
 */
export default function StatusIndex() {
  redirect("/");
}
