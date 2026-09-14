import { getCurrentUserRole } from "@/lib/session";
import { ChangePasswordForm } from "@/components/settings/ChangePasswordForm";
import { ProfileForm } from "@/components/settings/ProfileForm";

// Reads the live session; never prerender.
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const { user } = await getCurrentUserRole();

  return (
    <div className="space-y-4">
      <ProfileForm name={user.name} email={user.email} role={user.role} phone={user.phone} />
      <ChangePasswordForm />
    </div>
  );
}
