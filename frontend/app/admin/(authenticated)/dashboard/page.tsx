import { db } from "@/lib/db";
import { DeleteSlotButton } from "@/components/DeleteSlotButton";
import { AdminCancelBookingButton } from "@/components/AdminCancelBookingButton";
import Link from "next/link";
import {
  BUSINESS_TIMEZONE,
  todayInTimezone,
  dateKeyInTimezone,
  addDaysToDateKey,
} from "@/lib/timezone";

export const dynamic = "force-dynamic";

type Slot = Awaited<ReturnType<typeof getUpcomingSlots>>[number];

async function getUpcomingSlots() {
  return db.slot.findMany({
    where: { startTime: { gte: new Date() } },
    include: { booking: true },
    orderBy: { startTime: "asc" },
  });
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
}

function formatDayHeading(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

function DaySlots({ slots }: { slots: Slot[] }) {
  if (slots.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm text-gray-400">
        None
      </div>
    );
  }

  return (
    <>
      {/* Card list: default (phones/tablets) */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 md:hidden">
        {slots.map((slot) => (
          <div key={slot.id} className="flex items-start justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="font-medium text-slate-700 text-sm">
                {formatTime(slot.startTime)}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-gray-500">{slot.durationMinutes} min</span>
                {slot.booking ? (
                  <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
                    Booked
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
                    Available
                  </span>
                )}
              </div>
              {slot.booking && (
                <p className="text-xs text-gray-500 mt-1 truncate">
                  {slot.booking.clientName} &middot; {slot.booking.clientEmail}
                </p>
              )}
            </div>
            <div className="flex-none">
              {slot.booking ? (
                <AdminCancelBookingButton bookingId={slot.booking.id} />
              ) : (
                <DeleteSlotButton slotId={slot.id} />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Table: medium screens and up */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-600">Time</th>
              <th className="text-left px-5 py-3 font-medium text-gray-600">Duration</th>
              <th className="text-left px-5 py-3 font-medium text-gray-600">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {slots.map((slot) => (
              <tr key={slot.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3 font-medium text-slate-700">
                  {formatTime(slot.startTime)}
                </td>
                <td className="px-5 py-3 text-gray-500">{slot.durationMinutes} min</td>
                <td className="px-5 py-3">
                  {slot.booking ? (
                    <div>
                      <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
                        Booked
                      </span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {slot.booking.clientName} &middot; {slot.booking.clientEmail}
                      </p>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
                      Available
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-right whitespace-nowrap">
                  {slot.booking ? (
                    <AdminCancelBookingButton bookingId={slot.booking.id} />
                  ) : (
                    <DeleteSlotButton slotId={slot.id} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default async function DashboardPage() {
  const slots = await getUpcomingSlots();

  const todayKey = todayInTimezone();
  const tomorrowKey = addDaysToDateKey(todayKey, 1);

  const byDate = new Map<string, Slot[]>();
  for (const slot of slots) {
    const key = dateKeyInTimezone(slot.startTime);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(slot);
  }

  const laterKeys = Array.from(byDate.keys())
    .filter((key) => key !== todayKey && key !== tomorrowKey)
    .sort();

  const sections = [
    { key: todayKey, label: "Today" },
    { key: tomorrowKey, label: "Tomorrow" },
    ...laterKeys.map((key) => ({ key, label: formatDayHeading(key) })),
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <Link
          href="/admin/slots/new"
          className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Add Slots
        </Link>
      </div>

      <div className="space-y-7">
        {sections.map((section) => (
          <section key={section.key}>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              {section.label}
            </h2>
            <DaySlots slots={byDate.get(section.key) ?? []} />
          </section>
        ))}
      </div>
    </div>
  );
}
