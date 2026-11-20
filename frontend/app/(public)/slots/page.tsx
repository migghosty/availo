import Link from "next/link";
import { redirect } from "next/navigation";
import { SelectionChip } from "@/components/SelectionChip";
import { SlotPicker, type SlotDay } from "@/components/SlotPicker";
import { computeAvailability } from "@/lib/availability";
import { loadAvailabilityInputs } from "@/lib/scheduleData";
import { loadSelection } from "@/lib/selectionData";
import {
  parseSelectionParam,
  serializeSelection,
  totalDurationMinutes,
} from "@/lib/selection";
import { formatDuration } from "@/lib/service";
import { monthKeyOf } from "@/lib/schedule";
import { BUSINESS_TIMEZONE, todayInTimezone, addDaysToDateKey } from "@/lib/timezone";

export const dynamic = "force-dynamic";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_KEY = /^\d{4}-\d{2}$/;

const longDateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "long",
  month: "long",
  day: "numeric",
});

const timeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** "2026-11-23" → "Monday, November 23", read as a calendar date, not an instant. */
function formatLongDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return longDateFormat.format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function formatDayHeading(dateKey: string, todayKey: string) {
  if (dateKey === todayKey) return "Today";
  if (dateKey === addDaysToDateKey(todayKey, 1)) return "Tomorrow";
  return formatLongDate(dateKey);
}

export default async function SlotsPage({
  searchParams,
}: {
  searchParams: Promise<{
    service?: string;
    services?: string;
    date?: string;
    month?: string;
  }>;
}) {
  const {
    service: serviceParam,
    services: servicesParam,
    date: dateParam,
    month: monthParam,
  } = await searchParams;

  // Which times exist depends entirely on how long the appointment is, so
  // there's nothing honest to render without a service. A stale bookmark or a
  // since-archived service lands back on the picker rather than on an error —
  // on `/group` for a party, so they don't lose the rest of their selection.
  const ids = parseSelectionParam({
    service: serviceParam,
    services: servicesParam,
  });
  const isGroup = (ids?.length ?? 0) > 1;
  // In parallel: the schedule doesn't depend on the service, and running these
  // back to back cost a whole extra database round trip on every page view.
  const [selection, inputs] = await Promise.all([
    ids ? loadSelection(ids) : null,
    loadAvailabilityInputs(),
  ]);
  if (!selection) redirect(isGroup ? "/group" : "/");

  // A group is one contiguous block, so its length is the sum: three 30-minute
  // services is a single 90-minute appointment as far as availability is
  // concerned, and every overlap and closing-time rule follows from that alone.
  const durationMin = totalDurationMinutes(selection);

  const days = computeAvailability({ ...inputs, durationMin });

  // Emits `service=5` for one id, so every URL below is byte-identical to what
  // this page produced before groups existed.
  const selectionQuery = serializeSelection(selection.map((s) => s.id));

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

  // The whole horizon goes to the client in one payload (a month of a busy
  // schedule is ~1k start times, ~25 kB), so switching day or month never
  // round-trips. `computeAvailability` only returns days that actually have an
  // open time, so membership in this list *is* the blue/gray split.
  const slotDays: SlotDay[] = days.map((day) => ({
    dateKey: day.dateKey,
    heading: formatDayHeading(day.dateKey, todayKey),
    ariaLabel: `${formatLongDate(day.dateKey)} — ${day.starts.length} time${
      day.starts.length === 1 ? "" : "s"
    } available`,
    starts: day.starts.map((start) => ({
      ms: start.getTime(),
      label: timeFormat.format(start),
    })),
  }));

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
          Book an Appointment
        </h1>
        <p className="text-gray-500 dark:text-slate-400 mt-1">
          Pick a day, then a time that works for you.
        </p>
      </div>

      <div className="mb-6">
        <SelectionChip services={selection} />
      </div>

      {slotDays.length === 0 ? (
        <div className="bg-white dark:bg-neutral-950 rounded-xl border border-gray-200 dark:border-blue-500/15 p-12 text-center">
          <p className="text-gray-500 dark:text-slate-400">
            No {formatDuration(durationMin)} openings right now.
          </p>
          {/* A block only fits where a single window is long enough, so for a
              group the useful advice is to shrink the block, not the service. */}
          <Link
            href={isGroup ? "/group" : "/"}
            className="inline-block mt-4 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium"
          >
            {isGroup
              ? "Try fewer people or shorter services →"
              : "Try a shorter service →"}
          </Link>
        </div>
      ) : (
        /* Keyed on what the server resolved, so a fresh server render (a
           reload, or a new ?service=) resets the picker's local state rather
           than keeping a day from the previous one. */
        <SlotPicker
          key={`${selectionQuery}|${visibleMonth}|${selectedDate ?? ""}`}
          days={slotDays}
          todayKey={todayKey}
          firstMonth={firstMonth}
          lastMonth={lastMonth}
          initialMonth={visibleMonth}
          initialDate={selectedDate}
          selectionQuery={selectionQuery}
        />
      )}
    </div>
  );
}
