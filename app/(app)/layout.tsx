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
    <div className="min-h-dvh overflow-x-clip md:h-dvh md:flex md:overflow-hidden">
      <AppSidebar role={user.role} permissions={user.permissions} />
      <div className="relative flex min-h-screen min-w-0 flex-1 flex-col overflow-x-clip md:h-full md:overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(212,175,55,0.08),transparent_28%)]" />
        <Header userName={user.name} role={user.role} />
        <main className="fade-in flex-1 overflow-x-hidden px-4 pb-[var(--mobile-shell-bottom)] pt-[var(--mobile-shell-top)] md:overflow-y-auto md:px-6 md:pb-6">
          <div className="mobile-page-shell mx-auto w-full max-w-lg md:mx-0 md:max-w-none md:space-y-5">
            <MobileQuickActions role={user.role} permissions={user.permissions} />
            <PageThemeHeader role={user.role} />
            {children}
          </div>
        </main>
      </div>
      <BottomNav role={user.role} permissions={user.permissions} />
    </div>
  );
}
