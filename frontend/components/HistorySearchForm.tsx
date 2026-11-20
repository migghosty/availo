"use client";

import Link from "next/link";

import { PhoneField } from "./PhoneField";
import type { HistoryFilter } from "@/lib/bookingHistory";

/**
 * The phone search on `/admin/history`.
 *
 * Same shape as `PhoneLookupForm`: a client component only so the number
 * formats as it's typed, submitting as a plain `method="GET"` form so the
 * results stay server-rendered and the search lives in the URL. The current
 * tab rides along in a hidden field, so searching from "Cancelled" stays on
 * "Cancelled".
 */
export function HistorySearchForm({
  defaultValue,
  filter,
  clearHref,
}: {
  defaultValue: string;
  filter: HistoryFilter;
  /** Shown only while a search is active. */
  clearHref: string | null;
}) {
  return (
    <form method="GET" action="/admin/history" className="mb-4">
      <label
        htmlFor="history-phone"
        className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5"
      >
        Search by phone number
      </label>
      <div className="flex gap-2">
        {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
        <PhoneField
          id="history-phone"
          name="phone"
          defaultValue={defaultValue}
          required
          className="flex-1 min-w-0 border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 dark:text-slate-100 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
        />
        <button
          type="submit"
          className="bg-blue-600 dark:shadow-glow hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors whitespace-nowrap"
        >
          Search
        </button>
      </div>
      {clearHref && (
        <Link
          href={clearHref}
          className="inline-block text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 p-2 -m-2 mt-1.5"
        >
          Clear search
        </Link>
      )}
    </form>
  );
}
