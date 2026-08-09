import Link from "next/link";
import {
  DAY_ABBREVIATIONS,
  daysInMonth,
  firstDateKeyOfMonth,
  formatMonthLabel,
  weekdayOfDateKey,
} from "@/lib/schedule";

/**
 * A month grid for picking a day.
 *
 * Deliberately server-rendered — every cell and both month arrows are plain
 * links, so there is no hydration cost and the calendar works without JS. The
 * caller owns URL construction via `hrefForDate`, which keeps this component
 * reusable for any "pick a day" surface.
 *
 * Sunday-first, matching how consumer calendars read (and `DAY_ABBREVIATIONS`,
 * which is already indexed 0 = Sunday). The admin schedule editor is
 * Monday-first via `WEEK_ORDER` because business hours read better that way —
 * the two conventions are intentional, not an inconsistency.
 */

const CELL_BASE =
  "flex items-center justify-center aspect-square rounded-lg text-sm transition-colors";

export function MonthCalendar({
  monthKey,
  availableDates,
  selectedDate,
  todayKey,
  hrefForDate,
  prevHref,
  nextHref,
  countForDate,
}: {
  monthKey: string;
  /** Date keys that can be picked. Everything else renders inert. */
  availableDates: Set<string>;
  selectedDate?: string;
  todayKey: string;
  hrefForDate: (dateKey: string) => string;
  /** `null` disables the arrow — used at the edges of the booking horizon. */
  prevHref: string | null;
  nextHref: string | null;
  /** Optional, for screen-reader labels only; never rendered visually. */
  countForDate?: (dateKey: string) => number | undefined;
}) {
  const leadingBlanks = weekdayOfDateKey(firstDateKeyOfMonth(monthKey));
  const totalDays = daysInMonth(monthKey);

  return (
    <div className="max-w-md">
      <div className="flex items-center justify-between mb-3">
        <MonthArrow href={prevHref} label="Previous month" glyph="‹" />
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {formatMonthLabel(monthKey)}
        </h2>
        <MonthArrow href={nextHref} label="Next month" glyph="›" />
      </div>

      <div className="grid grid-cols-7 gap-1" aria-hidden>
        {DAY_ABBREVIATIONS.map((abbreviation) => (
          <div
            key={abbreviation}
            className="text-center text-[11px] font-medium text-gray-400 dark:text-slate-500 pb-1"
          >
            {abbreviation}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <div key={`blank-${i}`} />
        ))}

        {Array.from({ length: totalDays }, (_, i) => {
          const dayOfMonth = i + 1;
          const dateKey = `${monthKey}-${String(dayOfMonth).padStart(2, "0")}`;
          const isAvailable = availableDates.has(dateKey);
          const isSelected = dateKey === selectedDate;
          const isToday = dateKey === todayKey;

          // The ring marks "today" in amber so the you-are-here cue never
          // competes with blue, which means "has availability".
          const todayRing = isToday
            ? " ring-1 ring-inset ring-amber-400 dark:ring-amber-500"
            : "";

          if (!isAvailable) {
            return (
              <div
                key={dateKey}
                aria-hidden
                className={`${CELL_BASE} text-gray-300 dark:text-slate-700${todayRing}`}
              >
                {dayOfMonth}
              </div>
            );
          }

          const count = countForDate?.(dateKey);
          const label = new Intl.DateTimeFormat("en-US", {
            timeZone: "UTC",
            weekday: "long",
            month: "long",
            day: "numeric",
          }).format(new Date(`${dateKey}T12:00:00Z`));

          return (
            <Link
              key={dateKey}
              href={hrefForDate(dateKey)}
              aria-current={isSelected ? "date" : undefined}
              aria-label={
                count === undefined
                  ? label
                  : `${label} — ${count} time${count === 1 ? "" : "s"} available`
              }
              className={`${CELL_BASE} font-medium border${todayRing} ${
                isSelected
                  ? "bg-blue-600 dark:bg-blue-500 border-blue-600 dark:border-blue-500 text-white"
                  : "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 hover:border-blue-400 dark:hover:border-blue-700"
              }`}
            >
              {dayOfMonth}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function MonthArrow({
  href,
  label,
  glyph,
}: {
  href: string | null;
  label: string;
  glyph: string;
}) {
  const shared = "w-9 h-9 flex items-center justify-center rounded-lg text-lg";

  if (!href) {
    return (
      <span
        aria-hidden
        className={`${shared} text-gray-300 dark:text-slate-700`}
      >
        {glyph}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className={`${shared} text-slate-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors`}
    >
      {glyph}
    </Link>
  );
}
