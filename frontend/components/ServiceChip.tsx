import Link from "next/link";
import { formatDuration, formatPrice } from "@/lib/service";
import type { BookableService } from "@/lib/serviceData";

/**
 * The service the client picked, shown on every step after the landing page so
 * the choice driving which times exist is never off-screen. `changeHref` sends
 * them back to wherever that choice is made.
 */
export function ServiceChip({
  service,
  changeHref,
  changeLabel = "Change",
}: {
  service: BookableService;
  changeHref: string;
  changeLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-2xl flex-none" aria-hidden>
          {service.emoji}
        </span>
        <div className="min-w-0">
          <p className="font-medium text-slate-700 dark:text-slate-200 truncate">
            {service.name}
          </p>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {formatDuration(service.durationMinutes)} &middot;{" "}
            {formatPrice(service.priceCents)}
          </p>
        </div>
      </div>
      {/* p-2 -m-2 keeps a comfortable hit area behind small text */}
      <Link
        href={changeHref}
        className="flex-none text-sm font-medium text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 p-2 -m-2"
      >
        {changeLabel}
      </Link>
    </div>
  );
}
