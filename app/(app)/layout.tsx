import { AppSidebar } from "@/components/layout/AppSidebar";
import { Header } from "@/components/layout/Header";
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
      <AppSidebar role={user.role} />
      <div className="relative flex min-h-screen flex-1 flex-col">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(13,118,110,0.08),transparent_28%)]" />
        <Header userName={user.name} role={user.role} />
        <main className="fade-in flex-1 space-y-4 p-4 pb-24 md:space-y-5 md:p-6 md:pb-6">
          <PageThemeHeader role={user.role} />
          {children}
        </main>
      </div>
    </div>
  );
}
