import { db } from "@/lib/db";
import Link from "next/link";
import { CancelForm } from "./CancelForm";
import { formatPrice } from "@/lib/service";
import { toBookingGroup } from "@/lib/bookingGroup";
import { BUSINESS_TIMEZONE } from "@/lib/timezone";

/** Just the clock, for the far end of a block and its per-person rows. */
function formatClock(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
}

export default async function CancelPage({
  params,
}: {
  params: Promise<{ cancelToken: string }>;
}) {
  const { cancelToken } = await params;

  const booking = await db.booking.findUnique({
    where: { cancelToken },
  });

  if (!booking) {
    return (
      <div className="max-w-md">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-8 text-center">
          <p className="text-gray-600 dark:text-slate-300 font-medium">Booking not found.</p>
          <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
            This link may have already been used or is invalid.
          </p>
          <Link href="/slots" className="inline-block mt-4 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 text-sm font-medium">
            View available slots →
          </Link>
        </div>
      </div>
    );
  }

  // A group booked together cancels together, so the page has to show the
  // whole block — a client who thinks they are dropping one appointment and
  // loses three would be badly surprised.
  const legs = booking.groupId
    ? await db.booking.findMany({
        where: { groupId: booking.groupId },
        orderBy: { startTime: "asc" },
      })
    : [booking];

  const group = toBookingGroup(legs);
  const isGroup = group.size > 1;

  return (
    <div className="max-w-md">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          {isGroup ? `Cancel ${group.size} appointments` : "Cancel appointment"}
        </h1>
        <p className="text-gray-500 dark:text-slate-400 mt-1">
          {isGroup
            ? `This cancels the whole block for all ${group.size} people.`
            : "Are you sure you want to cancel?"}
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 mb-4">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500 dark:text-slate-400 flex-none">Date &amp; time</dt>
            <dd className="font-medium text-slate-700 dark:text-slate-200 text-right">
              {formatDateTime(group.startTime)}
              {isGroup && ` – ${formatClock(group.endTime)}`}
            </dd>
          </div>
          {!isGroup && booking.serviceName && (
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-slate-400">Service</dt>
              <dd className="font-medium text-slate-700 dark:text-slate-200">
                {booking.serviceName}
              </dd>
            </div>
          )}
          {isGroup && (
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-slate-400">People</dt>
              <dd className="font-medium text-slate-700 dark:text-slate-200">
                {group.size}
              </dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-gray-500 dark:text-slate-400">
              {isGroup ? "Total" : "Duration"}
            </dt>
            <dd className="font-medium text-slate-700 dark:text-slate-200">
              {group.totalDurationMinutes} min
              {isGroup &&
                group.totalPriceCents > 0 &&
                ` · ${formatPrice(group.totalPriceCents)}`}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500 dark:text-slate-400">Name</dt>
            <dd className="font-medium text-slate-700 dark:text-slate-200">{group.clientName}</dd>
          </div>
        </dl>

        {isGroup && (
          <ol className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800 space-y-2 text-sm">
            {group.legs.map((leg) => (
              <li key={leg.id} className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-700 dark:text-slate-200 flex-none tabular-nums">
                  {formatClock(leg.startTime)}
                </span>
                <span className="text-gray-500 dark:text-slate-400 truncate min-w-0 flex-1">
                  {leg.serviceName || "Appointment"}
                </span>
                <span className="text-gray-400 dark:text-slate-500 flex-none">
                  {leg.durationMinutes} min
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <CancelForm cancelToken={cancelToken} count={group.size} />

      <div className="mt-3 text-center">
        <Link href="/" className="text-sm text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300">
          {isGroup ? "Keep our appointments" : "Keep my appointment"}
        </Link>
      </div>
    </div>
  );
}
