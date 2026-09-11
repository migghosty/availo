/**
 * The admin app's web app manifest, named after the business.
 *
 * A route rather than a static file in `public/` so the installed app carries
 * `Settings.businessName` — the same name clients see in the header, texts and
 * calendar events — instead of a second copy of it that could drift.
 *
 * **Why the manifest, specifically.** iOS reads the name from here when the
 * admin taps "Add to Home Screen", and it is the one place the name can live
 * that is guaranteed to be read. The alternative, `generateMetadata`, can have
 * its tags streamed into `<body>` on a dynamic page, and a manifest link or
 * app title outside `<head>` is not something to rely on Safari honouring.
 * So the `<link>` to this URL stays static in `app/admin/layout.tsx`; only
 * what it points at is dynamic.
 *
 * **iOS reads it once, at install time**, and never re-fetches it. Renaming the
 * business later changes new installs only — an icon already on the home
 * screen keeps its old label until it is deleted and added again.
 *
 * Sits at the root, not under `/admin/`: `proxy.ts` redirects unauthenticated
 * `/admin/**` requests to the login page, and the manifest is fetched before
 * anyone has signed in. Nothing here is private — the business name is on
 * every public page already.
 */

import { getBusinessName } from "@/lib/settingsData";

// Rendered per request, like the settings page: a manifest prerendered at build
// time would freeze whatever the name was when the deploy ran.
export const dynamic = "force-dynamic";

export async function GET() {
  const businessName = await getBusinessName();

  const manifest = {
    name: businessName,
    // iOS truncates the home-screen label at roughly 12–14 characters. The
    // admin can shorten it in the "Add to Home Screen" sheet, which is better
    // than this app guessing an abbreviation of someone's business name.
    short_name: businessName,
    description: "Manage your schedule, services and bookings.",
    start_url: "/admin/dashboard",
    // `/` rather than `/admin`, so a link to a public page stays inside the
    // app instead of bouncing the admin out to Safari.
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f172a",
    theme_color: "#1e293b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      // A rename should reach the next install, not whenever a cache expires.
      "Cache-Control": "no-store",
    },
  });
}
