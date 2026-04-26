"use server";

import { cookies } from "next/headers";

export async function setThemeCookieAction(theme: "light" | "dark") {
  "use server";
  const cookieStore = await cookies();
  cookieStore.set("theme", theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}