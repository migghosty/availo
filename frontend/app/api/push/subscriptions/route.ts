/**
 * Storing and removing the admin's push subscriptions.
 *
 * A browser subscription can only be created *by the browser* — it hands back
 * an endpoint on its vendor's push service plus the keys to encrypt for it —
 * so this endpoint exists to persist what `components/PushToggle.tsx` is given.
 *
 * **These routes carry their own auth check.** `proxy.ts` matches `/admin` and
 * `/admin/**` only; it does not cover `/api/**`, so nothing upstream guards
 * them. Without the check below, anyone could register their own browser to
 * receive this business's booking alerts — client names, phone numbers and all.
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest } from "next/server";

/** The shape `PushSubscription.toJSON()` produces in the browser. */
type SubscriptionBody = {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
};

function readSubscription(body: SubscriptionBody) {
  const endpoint = body.endpoint;
  const p256dh = body.keys?.p256dh;
  const auth = body.keys?.auth;

  if (
    typeof endpoint !== "string" ||
    !endpoint.startsWith("https://") ||
    typeof p256dh !== "string" ||
    typeof auth !== "string"
  ) {
    return null;
  }

  return { endpoint, p256dh, auth };
}

/**
 * Register this browser.
 *
 * Upserts on the endpoint because re-subscribing an already-subscribed browser
 * returns the *same* endpoint: inserting blindly would either violate the
 * unique index or, without it, quietly send every notification twice.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const subscription = readSubscription(await req.json().catch(() => ({})));
  if (!subscription) {
    return Response.json({ error: "Invalid subscription" }, { status: 400 });
  }

  // Only to tell one subscription from another when reviewing them; never
  // parsed or branched on.
  const userAgent = req.headers.get("user-agent")?.slice(0, 255) ?? "";

  await db.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: { p256dh: subscription.p256dh, auth: subscription.auth, userAgent },
    create: { ...subscription, userAgent },
  });

  return Response.json({ success: true });
}

/**
 * Forget this browser.
 *
 * The browser has already called `subscription.unsubscribe()` by the time this
 * runs, so an endpoint that is already absent is a success, not a 404 — the
 * desired state has been reached either way.
 */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const endpoint = (body as { endpoint?: unknown }).endpoint;

  if (typeof endpoint !== "string") {
    return Response.json({ error: "Invalid endpoint" }, { status: 400 });
  }

  await db.pushSubscription.deleteMany({ where: { endpoint } });

  return Response.json({ success: true });
}
