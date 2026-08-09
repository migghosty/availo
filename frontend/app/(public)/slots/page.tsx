import Link from "next/link";
import { MonthCalendar } from "@/components/MonthCalendar";
import { computeAvailability } from "@/lib/availability";
import { loadAvailabilityInputs } from "@/lib/scheduleData";
import {
  addMonthsToMonthKey,
  formatMonthLabel,
  monthKeyOf,
} from "@/lib/schedule";
import { BUSINESS_TIMEZONE, todayInTimezone, addDaysToDateKey } from "@/lib/timezone";

export const dynamic = "force-dynamic";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_KEY = /^\d{4}-\d{2}$/;

function formatDayHeading(dateKey: string) {
  const today = todayInTimezone();
  if (dateKey === today) return "Today";
  if (dateKey === addDaysToDateKey(today, 1)) return "Tomorrow";

  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export default async function SlotsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; month?: string }>;
}) {
  const { date: dateParam, month: monthParam } = await searchParams;

  const inputs = await loadAvailabilityInputs();
  const days = computeAvailability(inputs);

  // `computeAvailability` only returns days that actually have an open time, so
  // membership in this map *is* the blue/gray split — no extra logic needed.
  const startsByDate = new Map(days.map((day) => [day.dateKey, day.starts]));
  const availableDates = new Set(startsByDate.keys());

  const todayKey = todayInTimezone();
  const horizonKey = addDaysToDateKey(todayKey, inputs.config.bookingHorizonDays);
  const firstMonth = monthKeyOf(todayKey);
  const lastMonth = monthKeyOf(horizonKey);

  const requestedDate = dateParam && DATE_KEY.test(dateParam) ? dateParam : undefined;

  // A month may come from ?month=, from the date being viewed, or default to
  // now. Clamp it so nobody can page into months that are gray by definition.
  const rawMonth =
    (monthParam && MONTH_KEY.test(monthParam) ? monthParam : undefined) ??
    (requestedDate ? monthKeyOf(requestedDate) : undefined) ??
    firstMonth;
  const visibleMonth =
    rawMonth < firstMonth ? firstMonth : rawMonth > lastMonth ? lastMonth : rawMonth;

  // An explicit ?date= stays selected even with nothing open, so a stale or
  // hand-typed link gets an honest "no times" answer instead of silently
  // jumping somewhere else. Otherwise pick the soonest day in view.
  const soonestInMonth = days.find((day) => monthKeyOf(day.dateKey) === visibleMonth);
  const selectedDate =
    requestedDate && monthKeyOf(requestedDate) === visibleMonth
      ? requestedDate
      : soonestInMonth?.dateKey;

  const selectedStarts = selectedDate ? startsByDate.get(selectedDate) : undefined;

  const prevMonth = addMonthsToMonthKey(visibleMonth, -1);
  const nextMonth = addMonthsToMonthKey(visibleMonth, 1);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
          Book an Appointment
        </h1>
        <p className="text-gray-500 dark:text-slate-400 mt-1">
          Pick a day, then a time that works for you.
        </p>
      </div>

      {availableDates.size === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-12 text-center">
          <p className="text-gray-500 dark:text-slate-400">
            No available times right now. Check back soon!
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Card framing starts at sm:. On a phone the calendar sits directly on
              the page so the full width goes to the day cells — the difference
              between a 42px and a 46px tap target. */}
          <div className="sm:bg-white sm:dark:bg-slate-900 sm:rounded-xl sm:border sm:border-gray-200 sm:dark:border-slate-800 sm:p-5">
            <MonthCalendar
              monthKey={visibleMonth}
              availableDates={availableDates}
              selectedDate={selectedDate}
              todayKey={todayKey}
              hrefForDate={(dateKey) => `/slots?date=${dateKey}`}
              prevHref={
                prevMonth < firstMonth ? null : `/slots?month=${prevMonth}`
              }
              nextHref={nextMonth > lastMonth ? null : `/slots?month=${nextMonth}`}
              countForDate={(dateKey) => startsByDate.get(dateKey)?.length}
            />
          </div>

          <section>
            {selectedDate && selectedStarts && selectedStarts.length > 0 ? (
              <>
                <h2 className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">
                  {formatDayHeading(selectedDate)}
                </h2>
                {/* Time pills: dense grid so a long day stays scannable on a phone */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {selectedStarts.map((start) => (
                    <Link
                      key={start.getTime()}
                      href={`/book/${start.getTime()}`}
                      className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 px-2 py-3 text-center text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-amber-400 dark:hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 hover:shadow-sm transition-all"
                    >
                      {formatTime(start)}
                    </Link>
                  ))}
                </div>
              </>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-8 text-center">
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
      )}
    </div>
  );
}
