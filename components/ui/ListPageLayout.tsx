import type { ReactNode } from "react";

import { PageHeader, type PageHeaderProps } from "./PageHeader";

/**
 * Standard shell for list pages: header → (kpis) → filters → content.
 * One spacing scale for the whole app (space-y-4) — do not hand-stack
 * page sections with ad-hoc `space-y-*` values.
 */

type ListPageLayoutProps = {
  /** Rendered above the header — e.g. a module hub tab bar (ServiceHubNav). */
  topBar?: ReactNode;
  /** Either structured header props or a fully custom node. */
  header?: PageHeaderProps;
  headerNode?: ReactNode;
  /** Filter/search bar (rendered between the header and content). */
  filters?: ReactNode;
  children: ReactNode;
  /** Extra content below the main panel (pagination notes, hints). */
  footer?: ReactNode;
};

export function ListPageLayout({ topBar, header, headerNode, filters, children, footer }: ListPageLayoutProps) {
  return (
    <div className="space-y-4 pb-24 lg:pb-8">
      {topBar}
      {header ? <PageHeader {...header} /> : headerNode}
      {filters}
      {children}
      {footer}
    </div>
  );
}
