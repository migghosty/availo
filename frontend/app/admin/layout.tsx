import type { Metadata } from "next";
import { getBusinessName } from "@/lib/settingsData";

/**
 * Exists only to declare the admin app's metadata — it renders its children
 * untouched. The chrome (nav, page background) belongs to
 * `(authenticated)/layout.tsx`, since `/admin/login` must not have it.
 *
 * **This is what makes iOS push possible at all.** Safari only grants
 * notification permission to a site the user has added to their home screen,
 * and it only treats that icon as an installed app — rather than a Safari
 * bookmark — if the page declared a manifest with `display: standalone`. No
 * manifest, no permission prompt, ever.
 *
 * It sits at `/admin` rather than in the `(authenticated)` group so the login
 * page carries it too: installing while signed out still has to produce a
 * working app icon, and a session can expire between installs.
 *
 * The public pages deliberately have no manifest. Clients visit the site once
 * to book; nothing should invite them to install it.
 *
 * The app is named after `Settings.businessName`. The manifest at
 * `/admin.webmanifest` is the authoritative source iOS reads; the title here
 * says the same thing so that whichever one Safari prefers, it gets the same
 * answer — and so admin pages don't inherit the root layout's "Availo" title.
 */
export async function generateMetadata(): Promise<Metadata> {
  const businessName = await getBusinessName();

  return {
    title: businessName,
    manifest: "/admin.webmanifest",
    /**
     * iOS shows the *installed app's* icon on every notification and ignores
     * any icon in the push payload, so this link is functional, not decorative.
     */
    icons: { apple: "/icons/icon-180.png" },
    appleWebApp: {
      capable: true,
      title: businessName,
      statusBarStyle: "black-translucent",
    },
  };
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
