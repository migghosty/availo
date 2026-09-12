import Link from "next/link";
import { ServiceChip } from "./ServiceChip";
import { formatDuration, formatPrice } from "@/lib/service";
import { totalDurationMinutes, totalPriceCents } from "@/lib/selection";
import type { BookableService } from "@/lib/serviceData";

/**
 * What the client is booking, shown on every step after it was chosen.
 *
 * One service delegates straight to `ServiceChip`, unchanged — which is the
 * cheapest possible proof that the one-person screens still render exactly what
 * they rendered before groups existed. Only the group case is new code.
 */
export function SelectionChip({
  services,
  showBreakdown = true,
}: {
  services: BookableService[];
  /**
   * Whether to list who is having what. Off on `/book/[start]`, which prints a
   * per-person timeline of its own directly below — with times, so it says
   * strictly more, and printing both would be the same list twice.
   */
  showBreakdown?: boolean;
}) {
  if (services.length === 1) {
    return <ServiceChip service={services[0]} changeHref="/" />;
  }

  // Duplicates collapsed: a party of three haircuts should read "✂️", not
  // "✂️✂️✂️". Order preserved so it matches the list below.
  const emoji = [...new Set(services.map((s) => s.emoji).filter(Boolean))];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl flex-none" aria-hidden>
            {emoji.join("")}
          </span>
          <div className="min-w-0">
            <p className="font-medium text-slate-700 dark:text-slate-200 truncate">
              {services.length} people
            </p>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {formatDuration(totalDurationMinutes(services))} &middot;{" "}
              {formatPrice(totalPriceCents(services))}
            </p>
          </div>
        </div>
        {/* p-2 -m-2 keeps a comfortable hit area behind small text */}
        <Link
          href="/group"
          className="flex-none text-sm font-medium text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 p-2 -m-2"
        >
          Change
        </Link>
      </div>
      {/* Who is having what, in the order they'll be seen. Without this the
          chip says "3 people" and the client has no way to check they picked
          the right services short of going back. */}
      {showBreakdown && (
      <ol className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-800 space-y-1">
        {services.map((service, index) => (
          <li
            key={index}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="text-gray-500 dark:text-slate-400 truncate">
              {index + 1}. {service.name}
            </span>
            <span className="flex-none text-gray-400 dark:text-slate-500">
              {formatDuration(service.durationMinutes)}
            </span>
          </li>
        ))}
      </ol>
      )}
    </div>
  );
}
