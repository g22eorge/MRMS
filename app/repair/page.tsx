import { headers } from "next/headers";
import { redirect } from "next/navigation";

/**
 * `/repair` is the public "book a repair" URL: it is in the sitemap, and
 * `/repair-request` forwards here.
 *
 * It used to send people to `${NEXT_PUBLIC_COMPANY_SITE_URL}/#repair-form`.
 * The company site has no such anchor, so the link landed at the top of an
 * unrelated marketing page. The booking form is in this app, on the shop home
 * page, at `#book`.
 *
 * The exception is the commercial host, whose home page is the product landing
 * and carries no form; there the company site is still the best answer.
 */
export default async function RepairRedirect() {
  const host = (await headers()).get("host")?.toLowerCase() ?? "";
  if (host.startsWith("app.eagleinfosolutions.com")) {
    redirect(process.env.NEXT_PUBLIC_COMPANY_SITE_URL || "/");
  }
  redirect("/#book");
}
