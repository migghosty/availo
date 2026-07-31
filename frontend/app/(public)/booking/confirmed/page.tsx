import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";

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

  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const cancelUrl = `/cancel/${booking.cancelToken}`;
  const fullCancelUrl = `${protocol}://${host}${cancelUrl}`;

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

        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm font-medium text-amber-800 mb-1">Need to cancel?</p>
          <p className="text-xs text-amber-700 mb-2">
            Save this link — it&apos;s the only way to cancel without an account.
          </p>
          <p className="text-xs font-mono break-all text-amber-900 bg-white border border-amber-200 rounded px-2 py-1.5 mb-2">
            {fullCancelUrl}
          </p>
          <div className="flex items-center gap-3">
            <CopyButton text={fullCancelUrl} />
            <Link
              href={cancelUrl}
              className="text-xs text-amber-700 hover:text-amber-900 underline"
            >
              Open link
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-4 text-center">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to slots
        </Link>
      </div>
    </div>
  );
}
