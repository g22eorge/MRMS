import { redirect } from "next/navigation";

export default function RepairRedirect() {
  // Keep the public link short even if the company site uses hash routing.
  redirect("https://eagleinfosolutions.com/#/Repair");
}
