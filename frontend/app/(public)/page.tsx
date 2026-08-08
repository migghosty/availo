import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function formatPrice(priceCents: number) {
  const dollars = priceCents / 100;
  return `$${dollars % 1 === 0 ? dollars.toFixed(0) : dollars.toFixed(2)}`;
}

export default async function LandingPage() {
  const services = await db.service.findMany({ orderBy: { id: "asc" } });

  return (
    <div>
      {/* Hero */}
      <div className="py-10 sm:py-16 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
          Fresh cuts. Clean edges.
        </h1>
        <p className="text-gray-500 dark:text-slate-400 mt-3 text-base sm:text-lg px-2">
          Book your next appointment in seconds — no account needed.
        </p>
        <Link
          href="/slots"
          className="inline-block mt-7 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-semibold px-8 py-3 rounded-xl text-sm transition-colors shadow-sm"
        >
          Book Now
        </Link>
      </div>

      {/* Services */}
      {services.length > 0 && (
        <div className="mt-2">
          <h2 className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-4">
            Services
          </h2>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-800">
            {services.map((service) => (
              <div
                key={service.id}
                className="flex items-center justify-between px-5 py-4 sm:px-6"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden>{service.emoji}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">{service.name}</span>
                </div>
                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                  {formatPrice(service.priceCents)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA footer */}
      <div className="mt-10 text-center">
        <Link
          href="/slots"
          className="text-sm text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 font-medium transition-colors"
        >
          View available times →
        </Link>
      </div>
    </div>
  );
}
