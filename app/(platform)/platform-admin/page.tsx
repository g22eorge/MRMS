import { redirect } from "next/navigation";

// Legacy duplicate of /platform. The two trees drifted (this copy passed
// `userCount`/`jobCount` to OrgTable, which expects `_count.users`/`_count.jobs`,
// crashing with "Cannot read properties of undefined (reading 'users')").
// Redirect until the trees are consolidated (system-analysis.md, Phase 3.5).
export default function PlatformAdminRedirect() {
  redirect("/platform");
}
