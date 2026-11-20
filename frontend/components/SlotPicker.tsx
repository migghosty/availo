"use client";

import Link, { useLinkStatus } from "next/link";
import { useState } from "react";

import { MonthCalendar } from "./MonthCalendar";
import {
  addMonthsToMonthKey,
  formatMonthLabel,
  monthKeyOf,
} from "@/lib/schedule";

/**
 * One bookable day, pre-formatted on the server.
 *
 * Every label is built server-side so the client does no date formatting at
 * all: Node's and the browser's ICU disagree on details like the narrow
 * no-break space in "4:30 PM", and any difference would be a hydration
 * mismatch on the most-used page in the app.
 */
export type SlotDay = {
  dateKey: string;
  /** "Today", "Tomorrow", or "Monday, November 23". */
  heading: string;
  /** Screen-reader label for the calendar cell, count included. */
  ariaLabel: string;
  starts: { ms: number; label: string }[];
};

/**
 * The `/slots` day-and-time picker.
 *
 * The server already computes availability for the whole booking horizon on
 * every request (that's what `computeAvailability` returns), so it hands all
 * of it over once and this component switches days and months locally — a
 * tap is a re-render, not a round trip. The URL still tracks `?date=` /
 * `?month=` via `history.replaceState`, which Next syncs into its router, so
 * a reload or a shared link lands on the same day. `replaceState` rather than
 * `pushState`: browsing days isn't navigation, and Back should return to the
 * service picker rather than step through every day the client looked at.
 *
 * Only the time pills are links, and they don't prefetch: there are dozens per
 * day, each one a dynamic render with database reads, and a prefetch of a
 * dynamic route stops at the loading boundary anyway — so it bought nothing
 * but load. `TimePill` shows the tap instantly instead, and
 * `book/[start]/loading.tsx` takes over as soon as the server starts
 * streaming.
 */
export function SlotPicker({
  days,
  todayKey,
  firstMonth,
  lastMonth,
  initialMonth,
  initialDate,
  selectionQuery,
}: {
  days: SlotDay[];
  todayKey: string;
  firstMonth: string;
  lastMonth: string;
  initialMonth: string;
  initialDate?: string;
  /** `service=5` or `services=…`, threaded into every URL. */
  selectionQuery: string;
}) {
  const [visibleMonth, setVisibleMonth] = useState(initialMonth);
  const [selectedDate, setSelectedDate] = useState(initialDate);

  const dayByKey = new Map(days.map((day) => [day.dateKey, day]));
  const availableDates = new Set(dayByKey.keys());
  const selectedDay = selectedDate ? dayByKey.get(selectedDate) : undefined;

  function syncUrl(query: string) {
    window.history.replaceState(null, "", `/slots?${selectionQuery}&${query}`);
  }

  function selectDate(dateKey: string) {
    setSelectedDate(dateKey);
    syncUrl(`date=${dateKey}`);
  }

  // Same rule the server applies on first load: paging to a month selects its
  // soonest open day, so the times below never belong to a month out of view.
  function showMonth(monthKey: string) {
    setVisibleMonth(monthKey);
    setSelectedDate(days.find((day) => monthKeyOf(day.dateKey) === monthKey)?.dateKey);
    syncUrl(`month=${monthKey}`);
  }

  const prevMonth = addMonthsToMonthKey(visibleMonth, -1);
  const nextMonth = addMonthsToMonthKey(visibleMonth, 1);

  return (
    <div className="space-y-8">
      {/* Card framing starts at sm:. On a phone the calendar sits directly on
          the page so the full width goes to the day cells — the difference
          between a 42px and a 46px tap target. */}
      <div className="sm:bg-white sm:dark:bg-neutral-950 sm:rounded-xl sm:border sm:border-gray-200 sm:dark:border-blue-500/15 sm:p-5">
        <MonthCalendar
          monthKey={visibleMonth}
          availableDates={availableDates}
          selectedDate={selectedDate}
          todayKey={todayKey}
          onSelectDate={selectDate}
          onPrev={prevMonth < firstMonth ? null : () => showMonth(prevMonth)}
          onNext={nextMonth > lastMonth ? null : () => showMonth(nextMonth)}
          labelForDate={(dateKey) => dayByKey.get(dateKey)?.ariaLabel ?? dateKey}
        />
      </div>

      <section>
        {selectedDay ? (
          <>
            <h2 className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">
              {selectedDay.heading}
            </h2>
            {/* Time pills: dense grid so a long day stays scannable on a phone */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {selectedDay.starts.map((start) => (
                <Link
                  key={start.ms}
                  href={`/book/${start.ms}?${selectionQuery}`}
                  prefetch={false}
                  className="bg-white dark:bg-neutral-950 rounded-lg border border-gray-200 dark:border-blue-500/15 px-2 py-3 text-center text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 hover:shadow-sm transition-all"
                >
                  <TimePillLabel label={start.label} />
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="bg-white dark:bg-neutral-950 rounded-xl border border-gray-200 dark:border-blue-500/15 p-8 text-center">
            <p className="text-gray-600 dark:text-slate-300 font-medium">
              {selectedDate
                ? "No times available on this day."
                : `No times available in ${formatMonthLabel(visibleMonth)}.`}
            </p>
            <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
              Pick another day from the calendar above.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * `useLinkStatus` must be called from a descendant of the `<Link>`, hence its
 * own component. Pending flips the instant the pill is tapped, so the client
 * sees their choice register before the server has answered at all.
 */
function TimePillLabel({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return (
    <span
      className={`inline-flex items-center justify-center gap-1.5 ${
        pending ? "text-blue-600 dark:text-blue-400" : ""
      }`}
    >
      {label}
      {pending && (
        <span
          aria-hidden
          className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin"
        />
      )}
    </span>
  );
}
