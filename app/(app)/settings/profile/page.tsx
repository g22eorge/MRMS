// Reads the live session; never prerender.
export const dynamic = "force-dynamic";

import { getCurrentUserRole } from "@/lib/session";
import { ChangePasswordForm } from "@/components/settings/ChangePasswordForm";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { TwoFactorCard } from "@/components/settings/TwoFactorCard";
import { prisma } from "@/lib/prisma";
import { LOCALES, localeOrDefault } from "@/lib/i18n";
import { LanguageForm } from "@/components/settings/LanguageForm";
import { setOrgLocaleAction } from "./actions";

export default async function ProfilePage() {
  const { user } = await getCurrentUserRole();
  const orgLocale = user?.orgId
    ? localeOrDefault((await prisma.organization.findUnique({ where: { id: user.orgId }, select: { locale: true } }).catch(() => null))?.locale)
    : null;
  const security = user?.id
    ? await prisma.user.findUnique({ where: { id: user.id }, select: { twoFactorEnabled: true } }).catch(() => null)
    : null;

  return (
    <div className="space-y-4">
      <ProfileForm name={user.name} email={user.email} role={user.role} phone={user.phone} />
      <ChangePasswordForm />
      <TwoFactorCard enabled={Boolean(security?.twoFactorEnabled)} />
      {user.role === "ADMIN" && orgLocale !== null ? (
        <section className="dc-card space-y-2 px-4 py-3.5">
          <h2 className="text-sm font-semibold text-[var(--ink)]">Language</h2>
          <p className="text-[0.8125rem] text-[var(--ink-muted)]">For everyone in your business. Menus and common page text. Longer sentences, documents and messages stay in English.</p>
          <LanguageForm current={orgLocale} options={LOCALES} action={setOrgLocaleAction} />
        </section>
      ) : null}
    </div>
  );
}
