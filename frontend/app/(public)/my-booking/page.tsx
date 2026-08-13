import { db } from "@/lib/db";
import Link from "next/link";
import { AddToCalendar } from "@/components/AddToCalendar";
import { PhoneLookupForm } from "@/components/PhoneLookupForm";
import { getBusinessAddress } from "@/lib/settingsData";
import { formatPhone, normalizePhone } from "@/lib/phone";
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

export default async function MyBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string }>;
}) {
  const { phone } = await searchParams;
  const submitted = phone?.trim() ?? "";

  // The same normalizer the booking path writes through, which is the entire
  // reason any spelling of a number finds the booking it made.
  const lookupPhone = submitted ? normalizePhone(submitted) : null;
  // Something was typed, but it isn't a number we could have stored — say so
  // rather than running a query that can only come back empty.
  const invalidFormat = submitted !== "" && lookupPhone === null;

  let bookings: Awaited<ReturnType<typeof fetchBookings>> | null = null;
  // One address for every card, so it's loaded once — and only when there is
  // actually a lookup to render.
  let address = "";

  if (lookupPhone) {
    [bookings, address] = await Promise.all([
      fetchBookings(lookupPhone),
      getBusinessAddress(),
    ]);
  }

  return (
    <div className="max-w-lg">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Find your booking</h1>
        <p className="text-gray-500 dark:text-slate-400 mt-1 text-sm">
          Enter the phone number you used when booking.
        </p>
      </div>

      <PhoneLookupForm defaultValue={submitted} />

      {invalidFormat && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-8 text-center">
          <p className="text-gray-600 dark:text-slate-300 font-medium">
            That doesn&apos;t look like a phone number.
          </p>
          <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
            Enter a US or Canada number, e.g. (619) 123-4567.
          </p>
        </div>
      )}

      {bookings !== null && (
        bookings.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-8 text-center">
            <p className="text-gray-600 dark:text-slate-300 font-medium">No upcoming bookings found.</p>
            <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
              No reservations were found for{" "}
              {/* The number as a person reads it, not the +1… we store. */}
              <span className="font-medium text-gray-500 dark:text-slate-400">
                {formatPhone(lookupPhone!)}
              </span>
              .
            </p>
            <Link
              href="/slots"
              className="inline-block mt-4 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 text-sm font-medium"
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
                  className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6"
                >
                  <dl className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-500 dark:text-slate-400">Date &amp; time</dt>
                      <dd className="font-medium text-slate-700 dark:text-slate-200 text-right">
                        {formatDateTime(booking.startTime)}
                      </dd>
                    </div>
                    {booking.serviceName && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500 dark:text-slate-400">Service</dt>
                        <dd className="font-medium text-slate-700 dark:text-slate-200">
                          {booking.serviceName}
                        </dd>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <dt className="text-gray-500 dark:text-slate-400">Duration</dt>
                      <dd className="font-medium text-slate-700 dark:text-slate-200">
                        {booking.durationMinutes} min
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500 dark:text-slate-400">Name</dt>
                      <dd className="font-medium text-slate-700 dark:text-slate-200">{booking.clientName}</dd>
                    </div>
                    {/* Stacked, matching the confirmation page: an address runs
                        to several lines and wraps badly in half a phone width. */}
                    {address && (
                      <div className="flex flex-col gap-1 pt-1">
                        <dt className="text-gray-500 dark:text-slate-400">Where</dt>
                        <dd className="font-medium text-slate-700 dark:text-slate-200 whitespace-pre-line">
                          {address}
                        </dd>
                      </div>
                    )}
                  </dl>

                  <div className="mt-5 pt-4 border-t border-gray-100 dark:border-slate-800">
                    <AddToCalendar booking={booking} />
                  </div>

                  <div className="mt-5 pt-4 border-t border-gray-100 dark:border-slate-800">
                    <Link
                      href={`/cancel/${booking.cancelToken}`}
                      className="inline-block text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium transition-colors"
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

/** `phone` must already be normalized — this is an exact match on the stored form. */
async function fetchBookings(phone: string) {
  return db.booking.findMany({
    where: {
      clientPhone: phone,
      startTime: { gte: new Date() },
    },
    orderBy: { startTime: "asc" },
  });
}
