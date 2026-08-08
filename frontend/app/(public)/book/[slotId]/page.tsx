import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BookingForm } from "./BookingForm";
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

export default async function BookSlotPage({
  params,
}: {
  params: Promise<{ slotId: string }>;
}) {
  const { slotId } = await params;

  const slot = await db.slot.findUnique({
    where: { id: Number(slotId) },
    include: { booking: true },
  });

  if (!slot) notFound();

  const backLink = (
    <Link href="/slots" className="text-sm text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300">
      ← Back to slots
    </Link>
  );

  if (new Date(slot.startTime) < new Date()) {
    return (
      <div className="max-w-md">
        {backLink}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-8 text-center mt-4">
          <p className="text-gray-600 dark:text-slate-300 font-medium">This time has already passed.</p>
          <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">This slot is no longer available for booking.</p>
          <Link href="/slots" className="inline-block mt-4 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 text-sm font-medium">
            View other available slots →
          </Link>
        </div>
      </div>
    );
  }

  if (!slot.isAvailable || slot.booking) {
    return (
      <div className="max-w-md">
        {backLink}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-8 text-center mt-4">
          <p className="text-gray-600 dark:text-slate-300 font-medium">This slot is no longer available.</p>
          <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">Someone else just booked it.</p>
          <Link
            href="/slots"
            className="inline-block mt-4 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 text-sm font-medium"
          >
            View other available slots →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md">
      {backLink}

      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Confirm your booking</h1>
        <p className="text-gray-500 dark:text-slate-400 mt-1">
          {formatDateTime(slot.startTime)} &middot; {slot.durationMinutes} min
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6">
        <BookingForm slotId={slot.id} />
      </div>
    </div>
  );
}
