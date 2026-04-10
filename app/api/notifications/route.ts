import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getUnreadNotifications, getAllNotifications, getUnreadCount } from "@/lib/notifications";

export async function GET(request: NextRequest) {
  const session = await getCurrentUser();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const all = searchParams.get("all") === "true";
  const limit = parseInt(searchParams.get("limit") || "20");

  try {
    const notifications = all
      ? await getAllNotifications(session.user.id, limit)
      : await getUnreadNotifications(session.user.id, limit);
    const unreadCount = await getUnreadCount(session.user.id);

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
        readAt: n.readAt?.toISOString() ?? null,
      })),
      unreadCount,
    });
  } catch (error) {
    console.error("Failed to fetch notifications", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}