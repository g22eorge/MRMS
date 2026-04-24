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
    <div className="min-h-dvh overflow-x-clip md:flex md:h-screen md:overflow-hidden">
      <AppSidebar role={user.role} permissions={user.permissions} />
      <div className="relative flex min-h-screen min-w-0 flex-1 flex-col overflow-x-clip md:h-full md:min-h-0">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,rgba(212,175,55,0.06),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(212,175,55,0.04),transparent_40%)]" />
        <Header userName={user.name} role={user.role} />
        <main className="fade-in flex-1 overflow-x-hidden px-4 pb-[var(--mobile-shell-bottom)] pt-[var(--mobile-shell-top)] md:min-h-0 md:overflow-y-auto md:px-6 md:pb-8">
          <div className="mobile-page-shell mx-auto w-full max-w-lg md:max-w-[1240px] md:space-y-5 xl:max-w-[1360px]">
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
