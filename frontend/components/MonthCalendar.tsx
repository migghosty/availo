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
 * Presentational and callback-driven: the caller (`SlotPicker`) holds the
 * selection in client state, so tapping a day or a month arrow re-renders
 * locally instead of round-tripping to the server. It was once all plain
 * links, server-rendered with no hydration — but every tap then cost a full
 * dynamic render, and Next prefetched every visible cell, so a phone fired
 * ~40 useless requests per page view. See "Picking a time" in `PLAN.md`.
 *
 * It has no "use client" of its own and uses no hooks; it simply runs in
 * whichever client component renders it.
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
  onSelectDate,
  onPrev,
  onNext,
  labelForDate,
}: {
  monthKey: string;
  /** Date keys that can be picked. Everything else renders inert. */
  availableDates: Set<string>;
  selectedDate?: string;
  todayKey: string;
  onSelectDate: (dateKey: string) => void;
  /** `null` disables the arrow — used at the edges of the booking horizon. */
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  /**
   * Screen-reader label for an available day, never rendered visually.
   * Supplied by the caller (pre-formatted on the server) so no date
   * formatting runs during hydration, where Node's and the browser's ICU can
   * disagree on whitespace and trigger a mismatch.
   */
  labelForDate: (dateKey: string) => string;
}) {
  const leadingBlanks = weekdayOfDateKey(firstDateKeyOfMonth(monthKey));
  const totalDays = daysInMonth(monthKey);

  return (
    <div className="max-w-md">
      <div className="flex items-center justify-between mb-3">
        <MonthArrow onClick={onPrev} label="Previous month" glyph="‹" />
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {formatMonthLabel(monthKey)}
        </h2>
        <MonthArrow onClick={onNext} label="Next month" glyph="›" />
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

          // The ring marks "today" in black (white in dark mode) so the
          // you-are-here cue never competes with blue, which means "has
          // availability" — and blue is now the brand accent too.
          const todayRing = isToday
            ? " ring-1 ring-inset ring-slate-900 dark:ring-white"
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

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onSelectDate(dateKey)}
              aria-pressed={isSelected}
              aria-label={labelForDate(dateKey)}
              className={`${CELL_BASE} cursor-pointer font-medium border${todayRing} ${
                isSelected
                  ? "bg-blue-600 dark:bg-blue-500 border-blue-600 dark:border-blue-500 text-white"
                  : "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 hover:border-blue-400 dark:hover:border-blue-700"
              }`}
            >
              {dayOfMonth}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MonthArrow({
  onClick,
  label,
  glyph,
}: {
  onClick: (() => void) | null;
  label: string;
  glyph: string;
}) {
  const shared = "w-9 h-9 flex items-center justify-center rounded-lg text-lg";

  if (!onClick) {
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
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`${shared} cursor-pointer text-slate-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors`}
    >
      {glyph}
    </button>
  );
}
