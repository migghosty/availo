import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AddToCalendar } from "@/components/AddToCalendar";
import { getBusinessAddress } from "@/lib/settingsData";
import { formatPhone } from "@/lib/phone";
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

export default async function BookingConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) notFound();

  const [booking, address] = await Promise.all([
    db.booking.findUnique({ where: { cancelToken: token } }),
    getBusinessAddress(),
  ]);

  if (!booking) notFound();

  // A group booking is several rows; the token identifies one of them and the
  // rest are its siblings. Everything below reads the group, which is a group
  // of one for an ordinary booking.
  const legs = booking.groupId
    ? await db.booking.findMany({
        where: { groupId: booking.groupId },
        orderBy: { startTime: "asc" },
      })
    : [booking];

  const group = toBookingGroup(legs);
  const isGroup = group.size > 1;
  const cancelUrl = `/cancel/${group.cancelToken}`;

  return (
    <div className="max-w-md">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-green-200 dark:border-green-900 p-8">
        <div className="flex items-center gap-3 mb-5">
          <span className="text-3xl">✓</span>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">You&apos;re booked!</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">See you soon, {group.clientName}.</p>
          </div>
        </div>

        <dl className="space-y-3 text-sm border-t border-gray-100 dark:border-slate-800 pt-5">
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500 dark:text-slate-400 flex-none">Date &amp; time</dt>
            <dd className="font-medium text-slate-700 dark:text-slate-200 text-right">
              {formatDateTime(group.startTime)}
              {isGroup && ` – ${formatClock(group.endTime)}`}
            </dd>
          </div>
          {/* Snapshotted on the booking, so a later rename doesn't rewrite
              what this client was told. Empty on bookings made before
              services were required — the row is then omitted entirely. */}
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
          <div className="flex justify-between">
            <dt className="text-gray-500 dark:text-slate-400">Phone</dt>
            <dd className="font-medium text-slate-700 dark:text-slate-200">
              {formatPhone(group.clientPhone)}
            </dd>
          </div>
          {/* Stacked rather than the justify-between of the rows above: an
              address runs to two or three lines, and squeezing it into the
              right half of a 375px screen wraps it into a mess. */}
          {address && (
            <div className="flex flex-col gap-1 pt-1">
              <dt className="text-gray-500 dark:text-slate-400">Where</dt>
              <dd className="font-medium text-slate-700 dark:text-slate-200 whitespace-pre-line">
                {address}
              </dd>
            </div>
          )}
        </dl>

        {/* Who is on at what time. The totals above are the block; this is the
            running order the group has to know. */}
        {isGroup && (
          <ol className="mt-5 pt-5 border-t border-gray-100 dark:border-slate-800 space-y-2 text-sm">
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

        <div className="mt-6 pt-5 border-t border-gray-100 dark:border-slate-800">
          <AddToCalendar bookings={group.legs} />
        </div>

        <div className="mt-6 pt-5 border-t border-gray-100 dark:border-slate-800">
          <Link
            href={cancelUrl}
            className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium transition-colors"
          >
            {isGroup
              ? `Cancel all ${group.size} appointments →`
              : "Cancel appointment →"}
          </Link>
        </div>
      </div>

      <div className="mt-4 text-center">
        <Link href="/slots" className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">
          ← Back to slots
        </Link>
      </div>
    </div>
  );
}
