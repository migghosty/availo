import Link from "next/link";
import { computeAvailability } from "@/lib/availability";
import { loadAvailabilityInputs } from "@/lib/scheduleData";
import { BUSINESS_TIMEZONE, todayInTimezone, addDaysToDateKey } from "@/lib/timezone";

export const dynamic = "force-dynamic";

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

export default async function SlotsPage() {
  const inputs = await loadAvailabilityInputs();
  const days = computeAvailability(inputs);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
          Book an Appointment
        </h1>
        <p className="text-gray-500 dark:text-slate-400 mt-1">
          Pick a time that works for you.
        </p>
      </div>

      {days.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-12 text-center">
          <p className="text-gray-500 dark:text-slate-400">
            No available times right now. Check back soon!
          </p>
        </div>
      ) : (
        <div className="space-y-7">
          {days.map((day) => (
            <section key={day.dateKey}>
              <h2 className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">
                {formatDayHeading(day.dateKey)}
              </h2>
              {/* Time pills: dense grid so a long day stays scannable on a phone */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {day.starts.map((start) => (
                  <Link
                    key={start.getTime()}
                    href={`/book/${start.getTime()}`}
                    className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 px-2 py-3 text-center text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-amber-400 dark:hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 hover:shadow-sm transition-all"
                  >
                    {formatTime(start)}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
