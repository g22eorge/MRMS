// Reads the live session; never prerender.
export const dynamic = "force-dynamic";

import { getCurrentUserRole } from "@/lib/session";
import { ChangePasswordForm } from "@/components/settings/ChangePasswordForm";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { TwoFactorCard } from "@/components/settings/TwoFactorCard";
import { prisma } from "@/lib/prisma";
import { LOCALES, localeOrDefault } from "@/lib/i18n";
import { SubmitButton } from "@/components/ui/SubmitButton";
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
          <form action={setOrgLocaleAction} className="flex flex-wrap items-center gap-2">
            <select
              name="locale"
              defaultValue={orgLocale}
              className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-[0.8125rem] text-[var(--ink)]"
            >
              {LOCALES.map((locale) => (
                <option key={locale.code} value={locale.code}>{locale.label}</option>
              ))}
            </select>
            <SubmitButton bare className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] font-semibold text-[var(--ink)]">
              Save
            </SubmitButton>
          </form>
        </section>
      ) : null}
    </div>
  );
}
