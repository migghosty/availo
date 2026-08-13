import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getBusinessName } from "@/lib/settingsData";

/**
 * Async so the header can carry the admin's own trading name.
 *
 * That costs one Settings read per public page render, which is cheap here and
 * worth it for a reason beyond tidiness: a client who browses "Availo" but gets
 * texts from "Ada's Barbershop" is a brand mismatch, and a carrier reviewing an
 * A2P 10DLC registration may well open the site to check.
 */
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const businessName = await getBusinessName();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col">
      <header className="bg-slate-800 dark:bg-slate-900 text-white shadow-md">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-amber-400 text-xl" aria-hidden>✂</span>
            <span className="font-bold text-lg tracking-tight">{businessName}</span>
          </Link>
          <div className="flex items-center gap-4 sm:gap-5">
            <Link
              href="/slots"
              className="text-sm text-slate-300 hover:text-white transition-colors"
            >
              Book
            </Link>
            <Link
              href="/my-booking"
              className="text-sm text-slate-300 hover:text-white transition-colors"
            >
              My booking
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 sm:py-10">
        {children}
      </main>
      {/* These two links are not decoration: the A2P 10DLC campaign
          registration asks for a public URL showing the messaging policy, and
          reviewers do open it. Footer rather than the header nav, which is
          already tight on a phone. */}
      <footer className="border-t border-gray-200 dark:border-slate-800 mt-8">
        <div className="max-w-3xl mx-auto px-4 py-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-slate-400">
          <span>
            &copy; {new Date().getFullYear()} {businessName}
          </span>
          <Link
            href="/sms-terms"
            className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-2 -m-2"
          >
            SMS Terms
          </Link>
          <Link
            href="/privacy"
            className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-2 -m-2"
          >
            Privacy
          </Link>
        </div>
      </footer>
    </div>
  );
}
