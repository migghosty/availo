import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AddToCalendar } from "@/components/AddToCalendar";
import { getBusinessAddress } from "@/lib/settingsData";
import { BUSINESS_TIMEZONE } from "@/lib/timezone";

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

  const cancelUrl = `/cancel/${booking.cancelToken}`;

  return (
    <div className="max-w-md">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-green-200 dark:border-green-900 p-8">
        <div className="flex items-center gap-3 mb-5">
          <span className="text-3xl">✓</span>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">You&apos;re booked!</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">See you soon, {booking.clientName}.</p>
          </div>
        </div>

        <dl className="space-y-3 text-sm border-t border-gray-100 dark:border-slate-800 pt-5">
          <div className="flex justify-between">
            <dt className="text-gray-500 dark:text-slate-400">Date &amp; time</dt>
            <dd className="font-medium text-slate-700 dark:text-slate-200">
              {formatDateTime(booking.startTime)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500 dark:text-slate-400">Duration</dt>
            <dd className="font-medium text-slate-700 dark:text-slate-200">{booking.durationMinutes} min</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500 dark:text-slate-400">Name</dt>
            <dd className="font-medium text-slate-700 dark:text-slate-200">{booking.clientName}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500 dark:text-slate-400">Email</dt>
            <dd className="font-medium text-slate-700 dark:text-slate-200">{booking.clientEmail}</dd>
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

        <div className="mt-6 pt-5 border-t border-gray-100 dark:border-slate-800">
          <AddToCalendar booking={booking} />
        </div>

        <div className="mt-6 pt-5 border-t border-gray-100 dark:border-slate-800">
          <Link
            href={cancelUrl}
            className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium transition-colors"
          >
            Cancel appointment →
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
