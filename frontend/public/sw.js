/**
 * Availo's service worker: a notification receiver, and nothing else.
 *
 * Deliberately not a PWA shell — there is no caching, no offline page, no
 * precache manifest. The admin app is useless offline (every page is a live
 * read of bookings), so a cache layer would only ever serve stale schedules.
 * The one thing a service worker is *required* for here is push: the browser
 * wakes this script up when a message arrives, and there is no other way to be
 * handed one.
 *
 * Lives in `public/` rather than being bundled so it is served from the origin
 * root and therefore gets root scope — a worker can only control pages at or
 * below its own path.
 *
 * Plain ES5-ish JS with no imports: this file is not compiled, linted or typed
 * by the Next build, so nothing here can rely on the toolchain.
 */

/**
 * A push arrived.
 *
 * **This must always show a notification.** Subscriptions are created with
 * `userVisibleOnly: true`, which is a promise to the browser that every push
 * produces something the user can see; breaking it can get the subscription
 * revoked outright. So the fallbacks below are not politeness — a malformed or
 * bodyless push still has to end in `showNotification`.
 */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    // A push we can't parse is still a push we must surface.
    console.error("[sw] unparseable push payload", error);
  }

  const title = payload.title || "Availo";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      // iOS ignores these and uses the installed app's icon; Android and
      // desktop Chrome honour them.
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      // Same tag replaces rather than stacks, so a re-sent alert for one
      // booking can't pile up three deep on the lock screen.
      tag: payload.tag || "availo",
      data: { url: payload.url || "/admin/dashboard" },
    })
  );
});

/**
 * The notification was tapped.
 *
 * Reuses an already-open window when there is one — on iOS the app is usually
 * still resident, and `openWindow` would otherwise be a no-op or a duplicate.
 * `navigate()` is unavailable in some browsers, hence the fallback.
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target = (event.notification.data && event.notification.data.url) || "/admin/dashboard";

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of windows) {
        // Any window of ours will do; it gets navigated to the right page next.
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target);
          return;
        }
      }

      await self.clients.openWindow(target);
    })()
  );
});
