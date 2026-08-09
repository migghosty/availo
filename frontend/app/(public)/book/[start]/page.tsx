import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingForm } from "./BookingForm";
import { isStartBookable } from "@/lib/availability";
import { loadAvailabilityInputs } from "@/lib/scheduleData";
import { BUSINESS_TIMEZONE } from "@/lib/timezone";

export const dynamic = "force-dynamic";

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export default async function BookSlotPage({
  params,
}: {
  params: Promise<{ start: string }>;
}) {
  const { start: startParam } = await params;
  const startMs = Number(startParam);

  if (!Number.isFinite(startMs)) notFound();

  const start = new Date(startMs);
  if (Number.isNaN(start.getTime())) notFound();

  const inputs = await loadAvailabilityInputs();
  const bookable = isStartBookable({ start, ...inputs });

  const backLink = (
    <Link
      href="/slots"
      className="text-sm text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300"
    >
      ← Back to times
    </Link>
  );

  if (!bookable) {
    return (
      <div className="max-w-md">
        {backLink}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-8 text-center mt-4">
          <p className="text-gray-600 dark:text-slate-300 font-medium">
            That time isn&apos;t available.
          </p>
          <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
            It may have just been booked, or it&apos;s no longer part of the schedule.
          </p>
          <Link
            href="/slots"
            className="inline-block mt-4 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 text-sm font-medium"
          >
            View other available times →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md">
      {backLink}

      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          Confirm your booking
        </h1>
        <p className="text-gray-500 dark:text-slate-400 mt-1">
          {formatDateTime(start)} &middot; {inputs.config.slotDurationMin} min
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6">
        <BookingForm startMs={startMs} />
      </div>
    </div>
  );
}
