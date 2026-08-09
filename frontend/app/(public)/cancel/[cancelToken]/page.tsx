import { db } from "@/lib/db";
import Link from "next/link";
import { CancelForm } from "./CancelForm";
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

  return (
    <div className="max-w-md">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Cancel appointment</h1>
        <p className="text-gray-500 dark:text-slate-400 mt-1">Are you sure you want to cancel?</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 mb-4">
        <dl className="space-y-3 text-sm">
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
        </dl>
      </div>

      <CancelForm cancelToken={cancelToken} />

      <div className="mt-3 text-center">
        <Link href="/" className="text-sm text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300">
          Keep my appointment
        </Link>
      </div>
    </div>
  );
}
