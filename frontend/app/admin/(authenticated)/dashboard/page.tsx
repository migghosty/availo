import { db } from "@/lib/db";
import { AdminCancelBookingButton } from "@/components/AdminCancelBookingButton";
import Link from "next/link";
import { computeAvailability, windowsForDate, overridesByDate } from "@/lib/availability";
import { loadAvailabilityInputs } from "@/lib/scheduleData";
import { formatWindow } from "@/lib/schedule";
import {
  BUSINESS_TIMEZONE,
  todayInTimezone,
  dateKeyInTimezone,
  addDaysToDateKey,
} from "@/lib/timezone";

export const dynamic = "force-dynamic";

type Booking = {
  id: number;
  startTime: Date;
  durationMinutes: number;
  clientName: string;
  clientEmail: string;
};

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function formatDayHeading(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function DayBookings({ bookings, hours }: { bookings: Booking[]; hours: string }) {
  return (
    <>
      <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">{hours}</p>

      {bookings.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 text-sm text-gray-400 dark:text-slate-500">
          No bookings
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-800">
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="flex items-start justify-between gap-3 p-4 sm:px-5"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-700 dark:text-slate-200 text-sm">
                  {formatTime(booking.startTime)}
                  <span className="text-gray-400 dark:text-slate-500 font-normal">
                    {" "}
                    · {booking.durationMinutes} min
                  </span>
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 truncate">
                  {booking.clientName}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                  {booking.clientEmail}
                </p>
              </div>
              <div className="flex-none">
                <AdminCancelBookingButton bookingId={booking.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default async function DashboardPage() {
  const inputs = await loadAvailabilityInputs();

  const bookings = await db.booking.findMany({
    where: { startTime: { gte: new Date() } },
    orderBy: { startTime: "asc" },
  });

  const availability = computeAvailability(inputs);
  const openCount = availability.reduce((total, day) => total + day.starts.length, 0);

  const todayKey = todayInTimezone();
  const tomorrowKey = addDaysToDateKey(todayKey, 1);

  const byDate = new Map<string, Booking[]>();
  for (const booking of bookings) {
    const key = dateKeyInTimezone(booking.startTime);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(booking);
  }

  const laterKeys = Array.from(byDate.keys())
    .filter((key) => key !== todayKey && key !== tomorrowKey)
    .sort();

  const sections = [
    { key: todayKey, label: "Today" },
    { key: tomorrowKey, label: "Tomorrow" },
    ...laterKeys.map((key) => ({ key, label: formatDayHeading(key) })),
  ];

  const overrideMap = overridesByDate(inputs.overrides);

  function hoursFor(dateKey: string) {
    const windows = windowsForDate(dateKey, inputs.rules, overrideMap);
    if (windows.length === 0) return "Closed";
    return windows.map(formatWindow).join(", ");
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Dashboard</h1>
        <Link
          href="/admin/schedule"
          className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex-none"
        >
          Edit schedule
        </Link>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 sm:px-5 mb-7 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {bookings.length} upcoming booking{bookings.length === 1 ? "" : "s"}
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            {openCount} open time{openCount === 1 ? "" : "s"} over the next{" "}
            {inputs.config.bookingHorizonDays} days
          </p>
        </div>
      </div>

      <div className="space-y-7">
        {sections.map((section) => (
          <section key={section.key}>
            <h2 className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1">
              {section.label}
            </h2>
            <DayBookings
              bookings={byDate.get(section.key) ?? []}
              hours={hoursFor(section.key)}
            />
          </section>
        ))}
      </div>
    </div>
  );
}
