import Link from "next/link";

import { PageStatePanel } from "./PageStatePanel";

export function PageNotFoundState({
  title = "We could not find that record",
  description = "The item may have been removed, reassigned, or you may not have access to it.",
  primaryHref = "/jobs",
  primaryLabel = "Go to jobs",
  secondaryHref = "/dashboard",
  secondaryLabel = "Dashboard",
}: {
  title?: string;
  description?: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <PageStatePanel eyebrow="Not Found" title={title} description={description}>
      <Link href={primaryHref} className="btn-premium-secondary rounded-lg px-4 py-2.5 text-sm font-semibold">
        {primaryLabel}
      </Link>
      <Link href={secondaryHref} className="btn-premium rounded-lg px-4 py-2.5 text-sm font-semibold text-white">
        {secondaryLabel}
      </Link>
    </PageStatePanel>
  );
}
