import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
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

  const booking = await db.booking.findUnique({
    where: { cancelToken: token },
    include: { slot: true },
  });

  if (!booking) notFound();

  const cancelUrl = `/cancel/${booking.cancelToken}`;

  return (
    <div className="max-w-md">
      <div className="bg-white rounded-xl border border-green-200 p-8">
        <div className="flex items-center gap-3 mb-5">
          <span className="text-3xl">✓</span>
          <div>
            <h1 className="text-xl font-bold text-slate-800">You&apos;re booked!</h1>
            <p className="text-sm text-gray-500">See you soon, {booking.clientName}.</p>
          </div>
        </div>

        <dl className="space-y-3 text-sm border-t border-gray-100 pt-5">
          <div className="flex justify-between">
            <dt className="text-gray-500">Date &amp; time</dt>
            <dd className="font-medium text-slate-700">
              {formatDateTime(booking.slot.startTime)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Duration</dt>
            <dd className="font-medium text-slate-700">{booking.slot.durationMinutes} min</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Name</dt>
            <dd className="font-medium text-slate-700">{booking.clientName}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Email</dt>
            <dd className="font-medium text-slate-700">{booking.clientEmail}</dd>
          </div>
        </dl>

        <div className="mt-6 pt-5 border-t border-gray-100">
          <Link
            href={cancelUrl}
            className="text-sm text-red-600 hover:text-red-800 font-medium transition-colors"
          >
            Cancel appointment →
          </Link>
        </div>
      </div>

      <div className="mt-4 text-center">
        <Link href="/slots" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to slots
        </Link>
      </div>
    </div>
  );
}
