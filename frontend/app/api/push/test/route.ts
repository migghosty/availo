/**
 * "Send test notification" — the only way to verify push end to end without
 * making a fake booking.
 *
 * Worth its own route because so much of this feature is invisible when it
 * breaks: iOS reports nothing when a subscription has expired, and the
 * transport is fail-open by design, so a booking alert that never arrives looks
 * identical to one that was never sent. This returns the counts `sendPushToAll`
 * reports, which is the one place a silent failure becomes visible.
 *
 * Session-guarded for the same reason as the subscription routes: `proxy.ts`
 * does not cover `/api/**`.
 */

import { auth } from "@/lib/auth";
import { getBusinessName } from "@/lib/settingsData";
import { isWebPushConfigured, sendPushToAll } from "@/lib/webPush";

export async function POST() {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!isWebPushConfigured()) {
    return Response.json(
      { error: "Push is not configured on the server (VAPID keys missing)." },
      { status: 503 }
    );
  }

  const businessName = await getBusinessName();

  const result = await sendPushToAll({
    title: "Notifications are on",
    body: `This is what a booking alert for ${businessName} will look like.`,
    url: "/admin/dashboard",
    tag: "push-test",
  });

  /**
   * Zero sent with nothing pruned means the subscription list is empty — the
   * toggle thinks it is on while the server has no record of it, which is
   * exactly the state worth reporting rather than claiming success.
   */
  if (result.sent === 0) {
    return Response.json(
      {
        error:
          result.pruned > 0
            ? "This device's subscription had expired and was removed. Turn notifications off and on again."
            : "No subscribed devices. Turn notifications off and on again.",
        ...result,
      },
      { status: 409 }
    );
  }

  return Response.json({ success: true, ...result });
}
