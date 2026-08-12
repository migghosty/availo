import Link from "next/link";
import { getBookableServices } from "@/lib/serviceData";
import { formatDuration, formatPrice } from "@/lib/service";

export const dynamic = "force-dynamic";

/**
 * The landing page is the service picker. There's no generic "Book Now"
 * anywhere: the service determines the appointment length, and the length
 * determines which start times exist at all, so `/slots` has nothing to show
 * until a service is chosen.
 */
export default async function LandingPage() {
  const services = await getBookableServices();

  return (
    <div>
      {/* Hero */}
      <div className="py-10 sm:py-16 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
          Fresh cuts. Clean edges.
        </h1>
        <p className="text-gray-500 dark:text-slate-400 mt-3 text-base sm:text-lg px-2">
          Pick a service to book your next appointment — no account needed.
        </p>
        {services.length > 0 && (
          <a
            href="#services"
            className="inline-block mt-7 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-semibold px-8 py-3 rounded-xl text-sm transition-colors shadow-sm"
          >
            Choose a service
          </a>
        )}
      </div>

      {/* Services — each row is the whole tap target, not a small inline link */}
      <div className="mt-2" id="services">
        <h2 className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-4">
          Services
        </h2>

        {services.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-12 text-center">
            <p className="text-gray-500 dark:text-slate-400">
              No services available right now. Check back soon!
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-800 overflow-hidden">
            {services.map((service) => (
              <Link
                key={service.id}
                href={`/slots?service=${service.id}`}
                className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6 hover:bg-amber-50/60 dark:hover:bg-amber-500/10 active:bg-amber-100/60 dark:active:bg-amber-500/15 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl flex-none" aria-hidden>
                    {service.emoji}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-700 dark:text-slate-200 truncate">
                      {service.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-slate-400">
                      {formatDuration(service.durationMinutes)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-none">
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
    </div>
  );
}
