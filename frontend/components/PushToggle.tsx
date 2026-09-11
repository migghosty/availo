"use client";

import { useEffect, useState } from "react";

/**
 * Turns iPhone notifications on for the admin's home-screen app.
 *
 * Everything awkward about this component comes from one fact: **iOS only
 * allows push for a site the user has added to their home screen**, and only
 * from inside that installed app. In Safari itself the API is present but
 * asking for permission cannot succeed, so a plain "Enable" button would be a
 * dead button with no explanation. Hence the states below — each one exists
 * because it is a real situation the admin can be in, and the wrong message
 * would send them looking for a bug that isn't there.
 *
 * `vapidPublicKey` arrives as a prop from the server page rather than through a
 * `NEXT_PUBLIC_*` variable, matching how `isSmsConfigured()` reaches the booking
 * form: those are inlined at build time, so one build could not serve preview
 * and production with different keys.
 */

/**
 * The subscribe call wants the VAPID key as bytes. Safari rejects the base64
 * string that Chrome tolerates, so this conversion is not optional.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const standard = padded.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(standard);

  // Backed by a plain ArrayBuffer explicitly: `subscribe` wants a BufferSource,
  // and TypeScript 5.7's generic typed arrays otherwise widen this to
  // ArrayBufferLike, which includes SharedArrayBuffer and so isn't assignable.
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * Running as an installed app rather than in a browser tab.
 *
 * Both checks are needed: `display-mode: standalone` is the standard and what
 * a manifest-installed app reports, while `navigator.standalone` is Apple's
 * original and the only signal on older iOS.
 */
function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iPadOS reports a Mac user agent, hence the touch-point fallback. */
function isIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1)
  );
}

type Status =
  /** Before the first check completes — the server can't know any of this. */
  | "loading"
  /** No service worker or no Push API at all. */
  | "unsupported"
  /** iOS, but running in Safari rather than from the home screen. */
  | "needs-install"
  /** Permission was refused; iOS never shows the prompt again. */
  | "denied"
  | "off"
  | "on";

/**
 * Works out which of the states above this device is in.
 *
 * Written as one async function returning a single value rather than a series
 * of `setStatus` calls in the effect body, because ESLint's
 * `react-hooks/set-state-in-effect` rejects synchronous `setState` there — the
 * same rule that put `ThemeToggle` on `useSyncExternalStore`. Resolving it in a
 * promise callback is allowed, and reads better anyway: there is exactly one
 * answer and one place it is applied.
 */
async function detectStatus(): Promise<Status> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }

  if (isIOS() && !isStandalone()) return "needs-install";

  if (Notification.permission === "denied") return "denied";

  /**
   * Registering now rather than inside the click handler is deliberate: on iOS,
   * awaiting registration first can cost the user gesture that
   * `requestPermission()` requires, and the prompt then never appears at all.
   */
  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });

    return (await registration.pushManager.getSubscription()) ? "on" : "off";
  } catch (cause) {
    console.error("[push] service worker registration failed", cause);
    return "unsupported";
  }
}

export function PushToggle({
  vapidPublicKey,
  appName,
}: {
  vapidPublicKey: string | null;
  /**
   * What the installed app is called — `Settings.businessName`, the same value
   * `/admin.webmanifest` gives iOS. Needed because the instructions below name
   * it, and "Settings → Notifications → <name>" is only useful if it matches.
   */
  appName: string;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    detectStatus().then((next) => {
      if (!cancelled) setStatus(next);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      if (!vapidPublicKey) throw new Error("Push isn’t configured on the server.");

      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        // A promise to the browser that every push shows something. `sw.js`
        // keeps it; breaking it can get the subscription revoked.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const res = await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });

      if (!res.ok) {
        // A subscription the server didn't record would look enabled here and
        // send nothing, so it is rolled back rather than left dangling.
        await subscription.unsubscribe();
        throw new Error((await res.json().catch(() => ({}))).error ?? "Could not save");
      }

      setStatus("on");
      setMessage("Notifications are on for this device.");
    } catch (cause) {
      console.error("[push] enable failed", cause);
      setError(cause instanceof Error ? cause.message : "Could not turn notifications on.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Tell the server first: unsubscribing locally discards the endpoint,
        // and the row would then be unreachable until its next failed send.
        await fetch("/api/push/subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }

      setStatus("off");
      setMessage("Notifications are off for this device.");
    } catch (cause) {
      console.error("[push] disable failed", cause);
      setError("Could not turn notifications off.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(body.error ?? "Could not send the test notification.");
        return;
      }

      setMessage("Sent. It should appear in a second or two.");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const note = "text-sm text-gray-600 dark:text-slate-400";
  const primaryButton =
    "w-full rounded-lg bg-amber-600 px-4 py-3 text-sm font-semibold text-white " +
    "hover:bg-amber-700 disabled:opacity-50 transition-colors";
  const secondaryButton =
    "w-full rounded-lg border border-gray-300 dark:border-slate-700 px-4 py-3 text-sm " +
    "font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 " +
    "disabled:opacity-50 transition-colors";

  if (status === "loading") {
    return <p className={note}>Checking this device…</p>;
  }

  if (!vapidPublicKey) {
    return (
      <p className={note}>
        Push notifications aren’t set up on the server yet. See{" "}
        <code className="text-xs">NOTIFICATIONS_SETUP.md</code> — it needs the three{" "}
        <code className="text-xs">VAPID_*</code> environment variables.
      </p>
    );
  }

  if (status === "unsupported") {
    return (
      <p className={note}>
        This browser can’t receive push notifications. On iPhone you need iOS 16.4 or
        later; Telegram alerts keep working regardless.
      </p>
    );
  }

  if (status === "needs-install") {
    return (
      <div className="space-y-3">
        <p className={note}>
          To get notifications on this phone, {appName} has to be on your home screen —
          Apple only allows them for installed apps.
        </p>
        <ol className="text-sm text-gray-600 dark:text-slate-400 space-y-1 list-decimal pl-5">
          <li>Tap the Share button in Safari — the square with an arrow coming out of it</li>
          <li>Choose “Add to Home Screen”</li>
          <li>Open {appName} from the new icon, then come back to this page</li>
        </ol>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <p className={note}>
        Notifications are blocked for this device. iOS won’t ask again, so it has to be
        changed in Settings → Notifications → {appName}, or by removing the home-screen
        icon and adding it back.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${status === "on" ? "bg-green-500" : "bg-gray-300 dark:bg-slate-600"}`}
          aria-hidden
        />
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
          {status === "on" ? "On for this device" : "Off for this device"}
        </p>
      </div>

      <p className={note}>
        {status === "on"
          ? "You’ll get a notification here when a booking is made or cancelled. Telegram alerts still come through too."
          : "Get a notification on this device when a booking is made or cancelled."}
      </p>

      {/* Stacked full-width on phones, side by side once there's room. */}
      <div className="flex flex-col sm:flex-row gap-2">
        {status === "on" ? (
          <>
            <button onClick={sendTest} disabled={busy} className={primaryButton}>
              {busy ? "Working…" : "Send test notification"}
            </button>
            <button onClick={disable} disabled={busy} className={secondaryButton}>
              Turn off
            </button>
          </>
        ) : (
          <button onClick={enable} disabled={busy} className={primaryButton}>
            {busy ? "Working…" : "Turn on notifications"}
          </button>
        )}
      </div>

      {message && (
        <p className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40 rounded-lg px-3 py-2">
          {message}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <p className="text-xs text-gray-500 dark:text-slate-500">
        This is per device — turning it on here doesn’t affect your other phone or laptop.
      </p>
    </div>
  );
}
