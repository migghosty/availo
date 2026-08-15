import Link from "next/link";
import { getBookableServices } from "@/lib/serviceData";
import { formatDuration, formatPrice } from "@/lib/service";

export const dynamic = "force-dynamic";

/**
 * The landing page is the service picker. There's no generic "Book Now"
 * anywhere: the service determines the appointment length, and the length
 * determines which start times exist at all, so `/slots` has nothing to show
 * until a service is chosen.
 *
 * The hero stays, but the CTA under it does not: it was an amber "Choose a
 * service" pill whose href was `#services`, so its only job was scrolling past
 * chrome this page had itself added. The single-line rows below are what pay
 * for the hero — with two-line rows the picker runs past one phone screen at
 * 390px wide. Budget holds to roughly six services before it scrolls.
 */
export default async function LandingPage() {
  const services = await getBookableServices();

  return (
    <div>
      <div className="py-8 sm:py-14 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
          Fresh cuts. Clean edges.
        </h1>
        <p className="text-gray-500 dark:text-slate-400 mt-3 text-base sm:text-lg px-2">
          Pick a service to book your next appointment — no account needed.
        </p>
      </div>

      {services.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-8 text-center">
          <p className="text-gray-500 dark:text-slate-400">
            No services available right now. Check back soon!
          </p>
        </div>
      ) : (
        /* Each row is the whole tap target, not a small inline link. */
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-800 overflow-hidden">
          {services.map((service) => (
            <Link
              key={service.id}
              href={`/slots?service=${service.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5 hover:bg-amber-50/60 dark:hover:bg-amber-500/10 active:bg-amber-100/60 dark:active:bg-amber-500/15 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xl flex-none" aria-hidden>
                  {service.emoji}
                </span>
                <p className="font-medium text-slate-700 dark:text-slate-200 truncate">
                  {service.name}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-none">
                <span className="text-sm text-gray-500 dark:text-slate-400">
                  {formatDuration(service.durationMinutes)}
                </span>
                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                  {formatPrice(service.priceCents)}
                </span>
                <span className="text-gray-300 dark:text-slate-600" aria-hidden>
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
