"use client";

import Link from "next/link";
import { Role } from "@prisma/client";
import { usePathname } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { AppLogo } from "@/components/ui/AppLogo";
import {
  NAV,
  type NavItem,
  type SuperGroup,
  activeHrefForPath,
  activeSuperGroup,
  buildSidebarModel,
  isVisible,
} from "@/lib/nav/sidebar-model";
import { COMMUNICATIONS_ROUTES } from "@/lib/communications/routes";

const STORAGE_KEY = "sidebar:open-groups";

// ── icons ─────────────────────────────────────────────────────────────────────

function navIcon(href: string) {
  switch (href) {
    case "/dashboard":
      return <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M2.5 9.5 10 3l7.5 6.5V17a.75.75 0 0 1-.75.75h-4.5v-4h-4.5v4h-4.5A.75.75 0 0 1 2.5 17V9.5Z" /></svg>;

    case "/jobs":
      return <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M6 2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.414A2 2 0 0 0 15.414 6L12 2.586A2 2 0 0 0 10.586 2H6Zm2 5a1 1 0 0 0 0 2h4a1 1 0 1 0 0-2H8Zm-1 4a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2H8Z" clipRule="evenodd" /></svg>;

    case "/intake":
      return <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" /></svg>;

    case "/field":
      return <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.003-.001.005-.003.019-.008a5.741 5.741 0 0 0 .282-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 15.01 17 12.669 17 9.5a7 7 0 1 0-14 0c0 3.169 1.698 5.51 3.354 7.085.829.799 1.654 1.38 2.274 1.765.311.193.571.337.757.433a5.741 5.741 0 0 0 .282.14l.019.008.005.003ZM10 11.25a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5Z" clipRule="evenodd" /></svg>;

    case "/technicians":
      return <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM1.49 15.326a.78.78 0 0 1-.358-.442 3 3 0 0 1 4.308-3.516 6.484 6.484 0 0 0-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 0 1-2.07-.655ZM16.44 15.98a4.97 4.97 0 0 0 2.07-.654.78.78 0 0 0 .357-.442 3 3 0 0 0-4.308-3.517 6.484 6.484 0 0 1 1.907 3.96 2.32 2.32 0 0 1-.026.654ZM18 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM5.304 16.19a.844.844 0 0 1-.277-.71 5 5 0 0 1 9.947 0 .843.843 0 0 1-.277.71A6.975 6.975 0 0 1 10 18a6.974 6.974 0 0 1-4.696-1.81Z" /></svg>;

    case "/complaints":
      return <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" /></svg>;

    case "/inventory":
      return <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M2 3a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H2Z" /><path fillRule="evenodd" d="M2 7.5h16l-.811 7.71a2 2 0 0 1-1.99 1.79H4.802a2 2 0 0 1-1.99-1.79L2 7.5ZM7.75 11a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5Z" clipRule="evenodd" /></svg>;

    case "/procurement":
      return <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M6 5v1H4.667a1.75 1.75 0 0 0-1.743 1.598l-.826 9.5A1.75 1.75 0 0 0 3.84 19H16.16a1.75 1.75 0 0 0 1.743-1.902l-.826-9.5A1.75 1.75 0 0 0 15.333 6H14V5a4 4 0 0 0-8 0Zm4-2.5A2.5 2.5 0 0 0 7.5 5v1h5V5A2.5 2.5 0 0 0 10 2.5ZM7.5 10a2.5 2.5 0 0 0 5 0V8.75a.75.75 0 0 1 1.5 0V10a4 4 0 0 1-8 0V8.75a.75.75 0 0 1 1.5 0V10Z" clipRule="evenodd" /></svg>;

    case "/inventory/purchase-requests":
      return <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M2.695 14.763l-1.262 3.154a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.885L17.5 5.5a2.121 2.121 0 0 0-3-3L3.58 13.42a4 4 0 0 0-.885 1.343Z" /></svg>;

    case "/inventory/purchase-orders":
      return <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M6 5v1H4.667a1.75 1.75 0 0 0-1.743 1.598l-.826 9.5A1.75 1.75 0 0 0 3.84 19H16.16a1.75 1.75 0 0 0 1.743-1.902l-.826-9.5A1.75 1.75 0 0 0 15.333 6H14V5a4 4 0 0 0-8 0Zm4-2.5A2.5 2.5 0 0 0 7.5 5v1h5V5A2.5 2.5 0 0 0 10 2.5ZM7.5 10a2.5 2.5 0 0 0 5 0V8.75a.75.75 0 0 1 1.5 0V10a4 4 0 0 1-8 0V8.75a.75.75 0 0 1 1.5 0V10Z" clipRule="evenodd" /></svg>;

    case "/clients":
      return <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 0 1 7 18a9.953 9.953 0 0 1-5.385-1.572ZM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 0 0-1.588-3.755 4.502 4.502 0 0 1 5.874 2.153c.176.463-.039.964-.51 1.16A8.46 8.46 0 0 1 14.5 16Z" /></svg>;

    case "/sales":
      return <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M12 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-1-5a7 7 0 1 0 0 14A7 7 0 0 0 11 2Zm0 1.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM9.5 10.5v3a.75.75 0 0 0 1.5 0v-3a.75.75 0 0 0-1.5 0Z" clipRule="evenodd" /></svg>;

    case "/sales/campaigns":
      return <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M13.92 3.845a19.362 19.362 0 0 1-6.3 1.98C6.765 5.942 5.89 6 5 6a4 4 0 0 0-.504 7.969 15.97 15.97 0 0 0 1.271 3.34c.397.771 1.342 1.05 2.108.632l.542-.295a2.06 2.06 0 0 0 .858-2.708 13.963 13.963 0 0 1-.681-1.71 19.364 19.364 0 0 1 6.328 1.987c.657.346 1.446-.107 1.567-.844A16.293 16.293 0 0 0 18 10c0-1.078-.104-2.132-.303-3.153-.144-.737-.933-1.19-1.59-.844a19.34 19.34 0 0 1-2.187.842Z" /></svg>;

    case "/pos":
      return <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M2.5 4A1.5 1.5 0 0 0 1 5.5V6h18v-.5A1.5 1.5 0 0 0 17.5 4h-15ZM19 8.5H1v6A1.5 1.5 0 0 0 2.5 16h15a1.5 1.5 0 0 0 1.5-1.5v-6ZM3 13.25a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75Zm4.75-.75a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 0-1.5h-3.5Z" clipRule="evenodd" /></svg>;

    case "/documents/job-cards":
    case "/documents/quotations":
    case "/documents/invoices":
    case "/documents/receipts":
      return <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M5.25 2A2.25 2.25 0 0 0 3 4.25v11.5A2.25 2.25 0 0 0 5.25 18h9.5A2.25 2.25 0 0 0 17 15.75V6.56a2.25 2.25 0 0 0-.659-1.591L14.03 2.66A2.25 2.25 0 0 0 12.44 2H5.25Zm6.5 1.5v2.75c0 .414.336.75.75.75h2.75v8.75a.75.75 0 0 1-.75.75h-9.5a.75.75 0 0 1-.75-.75V4.25a.75.75 0 0 1 .75-.75h6.75Zm-5.5 6.25a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5h-6a.75.75 0 0 1-.75-.75Zm0 3a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 0 1.5H7a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" /></svg>;

    case COMMUNICATIONS_ROUTES.home:
    case COMMUNICATIONS_ROUTES.outbox:
      return <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M2.5 6.5A2.5 2.5 0 0 1 5 4h10a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 15 17H5a2.5 2.5 0 0 1-2.5-2.5v-7Zm2.1-.5 5.4 3.6 5.4-3.6H4.6Z" /></svg>;

    case COMMUNICATIONS_ROUTES.templates:
    case COMMUNICATIONS_ROUTES.policies:
      return <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 15.5 2h-11ZM6 6.75A.75.75 0 0 1 6.75 6h6.5a.75.75 0 0 1 0 1.5h-6.5A.75.75 0 0 1 6 6.75Zm0 3A.75.75 0 0 1 6.75 9h6.5a.75.75 0 0 1 0 1.5h-6.5A.75.75 0 0 1 6 9.75Zm0 3a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" /></svg>;

    case COMMUNICATIONS_ROUTES.whatsapp:
      return <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M10 18a8 8 0 1 0-6.32-12.906L2 18l6.553-1.717A7.957 7.957 0 0 0 10 18Zm-.995-2.322a6.553 6.553 0 0 1-3.453-.981l-.248-.148-2.557.67.682-2.492-.162-.257a6.557 6.557 0 0 1-1.01-3.496c0-3.634 2.966-6.6 6.6-6.6a6.557 6.557 0 0 1 4.657 1.93 6.557 6.557 0 0 1 1.93 4.657c0 3.634-2.966 6.6-6.6 6.6Zm3.58-4.858c-.197-.099-1.17-.578-1.352-.644-.182-.066-.315-.099-.448.099-.133.198-.515.644-.632.777-.116.133-.232.149-.43.05-.197-.1-.832-.307-1.585-.98-.586-.522-.982-1.166-1.098-1.364-.116-.198-.012-.305.087-.404.09-.089.197-.232.296-.347.099-.116.132-.198.198-.331.066-.133.033-.248-.017-.347-.05-.099-.448-1.08-.614-1.48-.162-.397-.326-.344-.448-.35-.116-.007-.248-.008-.381-.008s-.347.05-.529.248c-.182.198-.694.678-.694 1.653 0 .975.714 1.916.814 2.049.099.133 1.405 2.145 3.404 3.008.476.205.847.327 1.136.419.477.152.911.13 1.254.079.383-.057 1.17-.478 1.335-.94.165-.463.165-.86.116-.94-.05-.082-.182-.133-.38-.232Z" clipRule="evenodd" /></svg>;

    case "/finance":
      return <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10.75 10.818v2.614A3.13 3.13 0 0 0 11.888 13c.482-.315.612-.648.612-.875 0-.227-.13-.56-.612-.875a3.13 3.13 0 0 0-1.138-.432ZM8.33 8.62c.053.055.115.11.184.164.208.16.46.284.736.363V6.603a2.45 2.45 0 0 0-.35.13c-.14.065-.27.143-.386.233-.377.292-.514.627-.514.909 0 .184.058.39.33.576Z" /><path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-6a.75.75 0 0 1 .75.75v.316a3.78 3.78 0 0 1 1.653.713c.426.33.744.74.925 1.2a.75.75 0 0 1-1.395.55 1.35 1.35 0 0 0-.428-.507 2.276 2.276 0 0 0-.755-.36V8.5c.558.157 1.072.443 1.482.8.542.47.87 1.096.87 1.7 0 .604-.328 1.23-.87 1.7a4.841 4.841 0 0 1-1.482.8V14a.75.75 0 0 1-1.5 0v-.311a4.5 4.5 0 0 1-1.681-.845.75.75 0 1 1 .914-1.198c.382.29.813.487 1.267.551V9.5a3.702 3.702 0 0 1-1.29-.645 2.193 2.193 0 0 1-.798-1.678c0-.845.467-1.58 1.129-2.066A3.947 3.947 0 0 1 9.25 4.81V4.75A.75.75 0 0 1 10 4Z" clipRule="evenodd" /></svg>;

    case "/technicians/payouts":
      return <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10.75 10.818v2.614A3.13 3.13 0 0 0 11.888 13c.482-.315.612-.648.612-.875 0-.227-.13-.56-.612-.875a3.13 3.13 0 0 0-1.138-.432ZM8.33 8.62c.053.055.115.11.184.164.208.16.46.284.736.363V6.603a2.45 2.45 0 0 0-.35.13c-.14.065-.27.143-.386.233-.377.292-.514.627-.514.909 0 .184.058.39.33.576Z" /><path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-6a.75.75 0 0 1 .75.75v.316a3.78 3.78 0 0 1 1.653.713c.426.33.744.74.925 1.2a.75.75 0 0 1-1.395.55 1.35 1.35 0 0 0-.428-.507 2.276 2.276 0 0 0-.755-.36V8.5c.558.157 1.072.443 1.482.8.542.47.87 1.096.87 1.7 0 .604-.328 1.23-.87 1.7a4.841 4.841 0 0 1-1.482.8V14a.75.75 0 0 1-1.5 0v-.311a4.5 4.5 0 0 1-1.681-.845.75.75 0 1 1 .914-1.198c.382.29.813.487 1.267.551V9.5a3.702 3.702 0 0 1-1.29-.645 2.193 2.193 0 0 1-.798-1.678c0-.845.467-1.58 1.129-2.066A3.947 3.947 0 0 1 9.25 4.81V4.75A.75.75 0 0 1 10 4Z" clipRule="evenodd" /></svg>;

    case "/settings":
      return <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.993 6.993 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" /></svg>;

    // Hub pages — grid/squares icon
    case "/service":
    case "/inventory/ops":
    case "/documents":
      return <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M4.25 2A2.25 2.25 0 0 0 2 4.25v2.5A2.25 2.25 0 0 0 4.25 9h2.5A2.25 2.25 0 0 0 9 6.75v-2.5A2.25 2.25 0 0 0 6.75 2h-2.5Zm0 9A2.25 2.25 0 0 0 2 13.25v2.5A2.25 2.25 0 0 0 4.25 18h2.5A2.25 2.25 0 0 0 9 15.75v-2.5A2.25 2.25 0 0 0 6.75 11h-2.5Zm6.5-9A2.25 2.25 0 0 0 8.5 4.25v2.5A2.25 2.25 0 0 0 10.75 9h2.5A2.25 2.25 0 0 0 15.5 6.75v-2.5A2.25 2.25 0 0 0 13.25 2h-2.5Zm0 9A2.25 2.25 0 0 0 8.5 13.25v2.5A2.25 2.25 0 0 0 10.75 18h2.5A2.25 2.25 0 0 0 15.5 15.75v-2.5A2.25 2.25 0 0 0 13.25 11h-2.5Z" clipRule="evenodd" /></svg>;

    default:
      return <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-5.5-2.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM10 12a5.99 5.99 0 0 0-4.793 2.39A6.483 6.483 0 0 0 10 16.5a6.483 6.483 0 0 0 4.793-2.11A5.99 5.99 0 0 0 10 12Z" clipRule="evenodd" /></svg>;
  }
}

// ── component ─────────────────────────────────────────────────────────────────

export function AppSidebar({
  role,
  permissions = [],
  badges,
  isPlatformAdmin = false,
  enabledModules,
  orgName,
}: {
  role: Role;
  permissions?: string[];
  isPlatformAdmin?: boolean;
  enabledModules?: Set<string>;
  orgName?: string | null;
  badges?: {
    receivedJobs?: number;
    inventory?: number;
    procurement?: number;
    purchaseRequests?: number;
    purchaseOrders?: number;
    paymentFollowups?: number;
    pendingRequests?: number;
    complaints?: number;
  };
}) {
  const pathname = usePathname();

  const model = useMemo(
    () => buildSidebarModel(role, permissions, enabledModules),
    [role, permissions, enabledModules],
  );
  const visibleHrefs = useMemo(
    () => NAV.filter((item) => isVisible(role, item.roles)).map((item) => item.href),
    [role],
  );
  const activeHref = activeHrefForPath(pathname, visibleHrefs);
  const activeGroup = activeSuperGroup(model, activeHref);

  // Collapsible group state — persisted; defaults to the active group open.
  const [openGroups, setOpenGroups] = useState<Set<SuperGroup>>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) return new Set(JSON.parse(raw) as SuperGroup[]);
      } catch {
        /* ignore malformed storage */
      }
    }
    return new Set(activeGroup ? [activeGroup] : []);
  });

  const toggleGroup = useCallback((group: SuperGroup) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore quota/availability errors */
      }
      return next;
    });
  }, []);

  const countBadge = useCallback(
    (href: string): number | undefined => {
      switch (href) {
        case "/inventory": return badges?.inventory;
        case "/procurement": return badges?.procurement;
        case "/inventory/purchase-requests": return badges?.purchaseRequests;
        case "/inventory/purchase-orders": return badges?.purchaseOrders;
        case "/intake": return badges?.pendingRequests;
        default: return undefined;
      }
    },
    [badges],
  );
  const newBadge = useCallback(
    (href: string): number | undefined => (href === "/jobs" ? badges?.receivedJobs : undefined),
    [badges],
  );

  const groupAttention = useCallback(
    (items: NavItem[]) =>
      items.reduce((sum, item) => sum + (countBadge(item.href) ?? 0) + (newBadge(item.href) ?? 0), 0),
    [countBadge, newBadge],
  );

  const renderRow = (item: NavItem) => {
    const active = activeHref === item.href;
    const nb = newBadge(item.href);
    const cb = countBadge(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`group relative flex items-center gap-2.5 rounded-[9px] px-3 py-2 text-[0.8125rem] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dc-accent)]/40 focus-visible:ring-offset-1 ${
          active
            ? "bg-[var(--dc-accent-soft)] font-semibold text-[var(--dc-accent-2)] before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-[var(--dc-accent)]"
            : "font-medium text-[var(--dc-ink-2)] hover:bg-[var(--dc-panel-2)] hover:text-[var(--dc-ink)]"
        }`}
      >
        <span
          className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center [&_svg]:h-[18px] [&_svg]:w-[18px] ${
            active ? "text-[var(--dc-accent-2)]" : "text-[var(--dc-ink-3)] group-hover:text-[var(--dc-ink-2)]"
          }`}
        >
          {navIcon(item.href)}
        </span>
        <span className="flex-1 truncate">{item.label}</span>
        <span className="flex items-center gap-1">
          {typeof nb === "number" && nb > 0 && (
            <span className="rounded-full bg-[var(--dc-accent)] px-1.5 py-0.5 text-[0.625rem] font-bold text-[#1c1600]">
              {nb > 99 ? "99+" : nb} new
            </span>
          )}
          {typeof cb === "number" && cb > 0 && (
            <span className="rounded-full bg-[var(--dc-panel-2)] px-1.5 py-0.5 text-[0.65625rem] font-bold text-[var(--dc-ink-2)]">
              {cb > 99 ? "99+" : cb}
            </span>
          )}
        </span>
      </Link>
    );
  };

  return (
    <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:flex-col bg-[var(--dc-side)] border-r border-[var(--dc-line)]">

      {/* ── Brand — exactly h-14 so its border-b lines up with the top header ── */}
      <Link
        href="/"
        className="flex h-14 shrink-0 items-center border-b border-[var(--dc-line-soft)] px-5 hover:opacity-80 transition-opacity"
      >
        <AppLogo height={48} priority />
      </Link>

      {/* ── Navigation ── */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">

        {/* Pinned daily items */}
        {model.pinned.length > 0 && (
          <div className="space-y-0.5">{model.pinned.map(renderRow)}</div>
        )}

        {/* Collapsible super-groups */}
        {model.sections.map((section) => {
          // The group owning the current page stays open; others follow the persisted toggle.
          const open = section.group === activeGroup || openGroups.has(section.group);
          const attention = groupAttention(section.items);
          return (
            <div key={section.group} className="mt-2">
              <button
                type="button"
                onClick={() => toggleGroup(section.group)}
                aria-expanded={open}
                className="flex w-full items-center gap-2 rounded-[9px] px-2 py-1.5 text-[0.625rem] font-bold uppercase tracking-[0.13em] text-[var(--dc-ink-3)] transition-colors hover:bg-[var(--dc-panel-2)] hover:text-[var(--dc-ink-2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dc-accent)]/40"
              >
                <span>{section.label}</span>
                <span className="h-px flex-1 bg-[var(--dc-line-soft)]" />
                {!open && attention > 0 && (
                  <span className="rounded-full bg-[var(--dc-accent)] px-1.5 py-0.5 text-[0.625rem] font-bold text-[#1c1600]">
                    {attention > 99 ? "99+" : attention}
                  </span>
                )}
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                  className={`h-3.5 w-3.5 shrink-0 text-[var(--dc-ink-3)] transition-transform ${open ? "" : "-rotate-90"}`}
                >
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z" clipRule="evenodd" />
                </svg>
              </button>
              {open && <div className="mt-0.5 space-y-0.5">{section.items.map(renderRow)}</div>}
            </div>
          );
        })}
      </nav>

      {/* ── Platform admin section ── */}
      {isPlatformAdmin && (
        <div className="border-t border-[var(--dc-line-soft)] px-3 py-2">
          <p className="mb-1 px-2 text-[0.8125rem] font-bold uppercase tracking-[0.18em] text-amber-500/70">
            Platform Admin
          </p>
          <Link
            href="/admin/orgs"
            className={`flex items-center gap-2 rounded-[9px] px-2 py-1.5 text-[0.75rem] font-medium transition-colors ${
              pathname.startsWith("/admin/orgs")
                ? "bg-amber-500/15 text-amber-600"
                : "text-[var(--dc-ink-2)] hover:bg-[var(--dc-panel-2)] hover:text-[var(--dc-ink)]"
            }`}
          >
            <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center text-amber-500 [&_svg]:h-[18px] [&_svg]:w-[18px]">
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M8 7a5 5 0 1 1 10 0A5 5 0 0 1 8 7ZM2.293 9.707a1 1 0 0 1 1.414-1.414l4.586 4.586a1 1 0 0 1-1.414 1.414L2.293 9.707Z" clipRule="evenodd" />
              </svg>
            </span>
            Module Access
          </Link>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="border-t border-[var(--dc-line-soft)] px-5 py-3 text-left">
        {orgName && (
          <p className="truncate text-[0.8125rem] font-semibold text-[var(--dc-ink)]" title={orgName}>{orgName}</p>
        )}
        <p className="mt-0.5 text-[0.75rem] font-medium tracking-[0.08em] text-[var(--dc-accent-2)]" aria-hidden="true">Duuka ProMax</p>
      </div>
    </aside>
  );
}
