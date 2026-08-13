import { toCalendarEvent, type BookableEvent } from "@/lib/bookingEvent";
import { googleCalendarUrl } from "@/lib/calendar";
import { getBusinessAddress, getBusinessName } from "@/lib/settingsData";
import { getOrigin } from "@/lib/siteUrl";

/**
 * "Add to calendar" for a confirmed booking.
 *
 * Server-rendered — both targets are links, so there's no hydration cost,
 * following the same reasoning as `MonthCalendar.tsx`.
 *
 * Two deliberate choices, both about iPhone:
 *
 * - The .ics is a plain `<a>`, **not** `next/link`. A `next/link` prefetches and
 *   attempts a client-side transition, which breaks the hand-off to iOS.
 * - It has no `target="_blank"`. Safari shows its "Add All to Calendar" sheet in
 *   place; a new tab just strands the user on a blank page. The Google link does
 *   open a new tab, because it genuinely leaves the site.
 */
export async function AddToCalendar({ booking }: { booking: BookableEvent }) {
  const [origin, address, businessName] = await Promise.all([
    getOrigin(),
    getBusinessAddress(),
    getBusinessName(),
  ]);
  const event = toCalendarEvent(booking, { origin, address, businessName });

  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">
        Add to calendar
      </p>
      {/* Stacked full-width on a phone, side by side once there's room. */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* The transparent border is load-bearing: without it this button is 2px
            shorter than the outlined one sitting directly below it on a phone. */}
        <a
          href={`/api/bookings/calendar/${booking.cancelToken}`}
          aria-label="Add to Apple Calendar or Outlook (downloads a calendar file)"
          className="flex-1 text-center bg-amber-500 hover:bg-amber-600 border border-transparent text-white font-medium px-4 py-3 rounded-lg text-sm transition-colors"
        >
          Apple / Outlook
        </a>
        <a
          href={googleCalendarUrl(event)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Add to Google Calendar (opens in a new tab)"
          className="flex-1 text-center dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-amber-400 dark:hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 font-medium px-4 py-3 rounded-lg text-sm transition-colors"
        >
          Google Calendar
        </a>
      </div>
    </div>
  );
}
