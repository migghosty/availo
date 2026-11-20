"use client";

import { useRouter } from "next/navigation";

import {
  HISTORY_RANGES,
  historyHref,
  parseHistoryRange,
  type HistoryFilter,
  type HistoryRange,
} from "@/lib/bookingHistory";

/**
 * The timeframe dropdown on `/admin/history`.
 *
 * A client component only so picking an option navigates straight away — a
 * `<select>` has no submit of its own, and a separate "Apply" button is one
 * more tap on a phone. The page stays server-rendered: this just builds the
 * URL through `historyHref()`, like every other link there, so the tab and
 * any phone search survive the change. `limit` is deliberately dropped —
 * "Show older" depth from one window means nothing in another.
 */
export function HistoryRangeSelect({
  range,
  filter,
  phone,
}: {
  range: HistoryRange;
  filter: HistoryFilter;
  phone?: string;
}) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="history-range" className="sr-only">
        Timeframe
      </label>
      <select
        id="history-range"
        value={range}
        onChange={(event) =>
          router.push(
            historyHref({
              filter,
              range: parseHistoryRange(event.target.value),
              phone,
            })
          )
        }
        className="border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-700 dark:text-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
      >
        {HISTORY_RANGES.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
