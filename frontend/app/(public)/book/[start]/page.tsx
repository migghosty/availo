import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BookingForm } from "./BookingForm";
import { SelectionChip } from "@/components/SelectionChip";
import { isStartBookable } from "@/lib/availability";
import { loadAvailabilityInputs } from "@/lib/scheduleData";
import { loadSelection } from "@/lib/selectionData";
import {
  parseSelectionParam,
  selectionEnd,
  selectionLegs,
  serializeSelection,
  totalDurationMinutes,
} from "@/lib/selection";
import { formatDuration } from "@/lib/service";
import { isSmsConfigured } from "@/lib/sms";
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

/** Just the clock, for the far end of a block's range. */
function formatEndTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export default async function BookSlotPage({
  params,
  searchParams,
}: {
  params: Promise<{ start: string }>;
  searchParams: Promise<{ service?: string; services?: string }>;
}) {
  const [
    { start: startParam },
    { service: serviceParam, services: servicesParam },
  ] = await Promise.all([params, searchParams]);
  const startMs = Number(startParam);

  if (!Number.isFinite(startMs)) notFound();

  const start = new Date(startMs);
  if (Number.isNaN(start.getTime())) notFound();

  // Same rule as /slots: no service, nothing to confirm.
  const ids = parseSelectionParam({
    service: serviceParam,
    services: servicesParam,
  });
  const isGroup = (ids?.length ?? 0) > 1;
  const selection = ids ? await loadSelection(ids) : null;
  if (!selection) redirect(isGroup ? "/group" : "/");

  // The block is checked as one appointment of the summed length — the same
  // call `createBooking` makes inside its transaction, so what this page offers
  // and what the server accepts cannot drift apart.
  const inputs = await loadAvailabilityInputs();
  const bookable = isStartBookable({
    start,
    ...inputs,
    durationMin: totalDurationMinutes(selection),
  });

  const selectionQuery = serializeSelection(selection.map((s) => s.id));
  const slotsHref = `/slots?${selectionQuery}`;
  const end = selectionEnd(start, selection);

  const backLink = (
    <Link
      href={slotsHref}
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
            href={slotsHref}
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

      <div className="mt-4 mb-4">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          Confirm your booking
        </h1>
        <p className="text-gray-500 dark:text-slate-400 mt-1">
          {formatDateTime(start)}
          {isGroup && ` – ${formatEndTime(end)}`}
        </p>
      </div>

      <div className="mb-6">
        <SelectionChip services={selection} showBreakdown={false} />
      </div>

      {/* Who is on at what time. The chip above says what was chosen; this says
          when each person is actually seen, which is the part a group has to
          agree on before they confirm. */}
      {isGroup && (
        <div className="mb-6 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-800">
          {selectionLegs(start, selection).map((leg) => (
            <div
              key={leg.index}
              className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
            >
              <span className="font-medium text-slate-700 dark:text-slate-200 flex-none tabular-nums">
                {formatEndTime(leg.start)}
              </span>
              <span className="text-gray-500 dark:text-slate-400 truncate min-w-0 flex-1">
                {leg.service.name}
              </span>
              <span className="text-gray-400 dark:text-slate-500 flex-none">
                {formatDuration(leg.service.durationMinutes)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6">
        {/* The consent checkbox promises a text, so it only appears when texts
            can actually be sent. `createBooking` relaxes its own consent check
            under the same condition — the two must stay in step. */}
        <BookingForm
          startMs={startMs}
          serviceIds={selection.map((s) => s.id)}
          askForSmsConsent={isSmsConfigured()}
        />
      </div>
    </div>
  );
}
