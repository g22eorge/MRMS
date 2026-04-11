import { AppSidebar } from "@/components/layout/AppSidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { MobileQuickActions } from "@/components/layout/MobileQuickActions";
import { PageThemeHeader } from "@/components/layout/PageThemeHeader";
import { getCurrentUserRole } from "@/lib/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await getCurrentUserRole();

  return (
    <div className="min-h-screen md:flex">
      <AppSidebar role={user.role} permissions={user.permissions} />
      <div className="relative flex min-h-screen flex-1 flex-col">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(212,175,55,0.08),transparent_28%)]" />
        <Header userName={user.name} role={user.role} />
        <main className="fade-in mobile-page-shell flex-1 overflow-x-hidden p-4 pb-[var(--mobile-shell-bottom)] pt-[var(--mobile-shell-top)] md:space-y-5 md:p-6 md:pb-6">
          <MobileQuickActions role={user.role} permissions={user.permissions} />
          <PageThemeHeader role={user.role} />
          {children}
        </main>
      </div>
      <BottomNav role={user.role} permissions={user.permissions} />
    </div>
  );
}
