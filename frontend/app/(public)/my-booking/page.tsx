import { db } from "@/lib/db";
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

export default async function MyBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  const trimmedEmail = email?.trim().toLowerCase() ?? "";

  let bookings: Awaited<ReturnType<typeof fetchBookings>> | null = null;

  if (trimmedEmail) {
    bookings = await fetchBookings(trimmedEmail);
  }

  return (
    <div className="max-w-lg">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-800">Find your booking</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Enter the email address you used when booking.
        </p>
      </div>

      <form method="GET" action="/my-booking" className="flex gap-2 mb-8">
        <input
          type="email"
          name="email"
          defaultValue={email ?? ""}
          placeholder="your@email.com"
          required
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
        />
        <button
          type="submit"
          className="bg-amber-500 hover:bg-amber-600 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors whitespace-nowrap"
        >
          Look up
        </button>
      </form>

      {bookings !== null && (
        bookings.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-600 font-medium">No upcoming bookings found.</p>
            <p className="text-sm text-gray-400 mt-1">
              No reservations were found for <span className="font-mono">{trimmedEmail}</span>.
            </p>
            <Link
              href="/"
              className="inline-block mt-4 text-amber-600 hover:text-amber-800 text-sm font-medium"
            >
              Book an appointment →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => {
              return (
                <div
                  key={booking.id}
                  className="bg-white rounded-xl border border-gray-200 p-6"
                >
                  <dl className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Date &amp; time</dt>
                      <dd className="font-medium text-slate-700 text-right">
                        {formatDateTime(booking.slot.startTime)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Duration</dt>
                      <dd className="font-medium text-slate-700">
                        {booking.slot.durationMinutes} min
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Name</dt>
                      <dd className="font-medium text-slate-700">{booking.clientName}</dd>
                    </div>
                  </dl>

                  <div className="mt-5 pt-4 border-t border-gray-100">
                    <Link
                      href={`/cancel/${booking.cancelToken}`}
                      className="inline-block text-sm text-red-600 hover:text-red-800 font-medium transition-colors"
                    >
                      Cancel appointment →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

async function fetchBookings(email: string) {
  return db.booking.findMany({
    where: {
      clientEmail: email,
      slot: { startTime: { gte: new Date() } },
    },
    include: { slot: true },
    orderBy: { slot: { startTime: "asc" } },
  });
}
