import Link from "next/link";
import { HistoryRangeSelect } from "@/components/HistoryRangeSelect";
import { HistorySearchForm } from "@/components/HistorySearchForm";
import { loadBookingHistory, loadPhoneSummary } from "@/lib/bookingHistoryData";
import {
  HISTORY_MAX_LIMIT,
  HISTORY_PAGE_SIZE,
  historyHref,
  historyRangeLabel,
  parseHistoryFilter,
  parseHistoryLimit,
  parseHistoryRange,
  type HistoryEntry,
  type HistoryFilter,
  type HistoryStatus,
} from "@/lib/bookingHistory";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { formatPrice } from "@/lib/service";
import { BUSINESS_TIMEZONE } from "@/lib/timezone";

export const dynamic = "force-dynamic";

const dayFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIMEZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

const timeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** For the booked/cancelled stamps: when something happened, to the minute. */
const stampFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIMEZONE,
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const STATUS_BADGE: Record<HistoryStatus, { label: string; className: string }> = {
  upcoming: {
    label: "Upcoming",
    className:
      "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  },
  past: {
    label: "Past",
    className: "bg-gray-100 text-gray-600 dark:bg-neutral-900 dark:text-slate-300",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  },
};

function EntryCard({ entry }: { entry: HistoryEntry }) {
  const badge = STATUS_BADGE[entry.status];
  const isCancelled = entry.status === "cancelled";

  return (
    <li className="p-4 sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* A cancelled time is struck through so the list scans as "what
              happened" at a glance — the stamp below says when and by whom. */}
          <p
            className={`font-medium text-sm text-slate-700 dark:text-slate-200 ${
              isCancelled ? "line-through decoration-gray-400 dark:decoration-slate-500" : ""
            }`}
          >
            {dayFormat.format(entry.startTime)}
          </p>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {timeFormat.format(entry.startTime)} – {timeFormat.format(entry.endTime)}
          </p>
        </div>
        <span
          className={`flex-none text-xs font-medium px-2 py-0.5 rounded-full ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
        {entry.size > 1 && (
          <span className="font-medium">Party of {entry.size} · </span>
        )}
        {entry.services.map((name) => name || "—").join(", ")}
        <span className="text-gray-400 dark:text-slate-500">
          {" "}
          · {formatPrice(entry.totalPriceCents)}
        </span>
      </p>

      <p className="text-sm text-slate-600 dark:text-slate-300 truncate">
        {entry.clientName}
      </p>
      {/* Same affordance as the dashboard: the admin is on a phone, and
          calling back is the natural next step after a cancellation. */}
      <a
        href={`tel:${entry.clientPhone}`}
        className="inline-block text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 p-2 -m-2 mt-0.5"
      >
        {formatPhone(entry.clientPhone)}
      </a>

      <ul className="mt-3 space-y-1 text-xs text-gray-500 dark:text-slate-400">
        <li className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-neutral-500 flex-none" />
          Booked {stampFormat.format(entry.bookedAt)}
        </li>
        {entry.cancelledAt && (
          <li className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 dark:bg-red-400 flex-none" />
            Cancelled
            {entry.cancelledBy === "client"
              ? " by client"
              : entry.cancelledBy === "admin"
                ? " by you"
                : ""}{" "}
            {stampFormat.format(entry.cancelledAt)}
          </li>
        )}
      </ul>
    </li>
  );
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string;
    range?: string;
    limit?: string;
    phone?: string;
  }>;
}) {
  const params = await searchParams;
  const filter = parseHistoryFilter(params.filter);
  const range = parseHistoryRange(params.range);
  const limit = parseHistoryLimit(params.limit);

  // What the admin typed, kept for the URL and the search box; the normalized
  // form is what's matched. Same split as /my-booking — `normalizePhone` is
  // the one normalizer, so every spelling of a number finds the same rows.
  const typedPhone = typeof params.phone === "string" ? params.phone.trim() : "";
  const searchPhone = typedPhone ? normalizePhone(typedPhone) : null;
  // A typo must read as "that isn't a phone number", not as "this client has
  // no history" — the second is a wrong answer, the first is a prompt to fix.
  const invalidPhone = typedPhone !== "" && searchPhone === null;

  const [{ entries, hasMore }, summary] = invalidPhone
    ? [{ entries: [], hasMore: false }, null]
    : await Promise.all([
        loadBookingHistory({ filter, range, limit, phone: searchPhone }),
        searchPhone ? loadPhoneSummary(searchPhone, range) : Promise.resolve(null),
      ]);

  const linkPhone = typedPhone || undefined;

  const tabs: { filter: HistoryFilter; label: string }[] = [
    { filter: "all", label: "All" },
    { filter: "cancelled", label: "Cancelled" },
  ];

  const nextLimit = limit + HISTORY_PAGE_SIZE;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">
        History
      </h1>

      {/* Keyed on the search so "Clear search" (a client-side navigation to
          the same route) remounts the field instead of keeping the old number
          in its local state. */}
      <HistorySearchForm
        key={typedPhone}
        defaultValue={typedPhone}
        filter={filter}
        range={range}
        clearHref={typedPhone ? historyHref({ filter, range }) : null}
      />

      {invalidPhone && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3 mb-5">
          That doesn&apos;t look like a phone number. Enter a US or Canada number,
          e.g. (619) 123-4567.
        </div>
      )}

      {summary && searchPhone && (
        <p className="text-sm text-slate-700 dark:text-slate-200 mb-4">
          <span className="font-medium">{formatPhone(searchPhone)}</span>
          <span className="text-gray-500 dark:text-slate-400">
            {" "}
            · {summary.bookings} booking{summary.bookings === 1 ? "" : "s"},{" "}
            {summary.cancelled} cancelled · {historyRangeLabel(range).toLowerCase()}
          </span>
        </p>
      )}

      {/* Tabs and timeframe share a row; at phone width there's room for both,
          and flex-wrap drops the dropdown underneath if a font size says no. */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="inline-flex rounded-lg bg-gray-100 dark:bg-neutral-900 p-1">
          {tabs.map((tab) => (
            <Link
              key={tab.filter}
              href={historyHref({ filter: tab.filter, range, phone: linkPhone })}
              className={`text-sm px-4 py-1.5 rounded-md transition-colors ${
                tab.filter === filter
                  ? "bg-white dark:bg-neutral-950 text-slate-800 dark:text-slate-100 shadow-sm font-medium"
                  : "text-gray-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <HistoryRangeSelect range={range} filter={filter} phone={linkPhone} />
      </div>

      {invalidPhone ? null : entries.length === 0 ? (
        <div className="bg-white dark:bg-neutral-950 rounded-xl border border-gray-200 dark:border-blue-500/15 p-4 text-sm text-gray-400 dark:text-slate-500">
          {/* Name the window: "no bookings" alone would read as "never". */}
          {filter === "cancelled" ? "No cancellations" : "No bookings"}
          {searchPhone ? " for this number" : ""} in the{" "}
          {historyRangeLabel(range).toLowerCase()}.
        </div>
      ) : (
        <ul className="bg-white dark:bg-neutral-950 rounded-xl border border-gray-200 dark:border-blue-500/15 divide-y divide-gray-100 dark:divide-blue-500/10">
          {entries.map((entry) => (
            <EntryCard key={entry.key} entry={entry} />
          ))}
        </ul>
      )}

      {hasMore && limit < HISTORY_MAX_LIMIT && (
        <div className="mt-5 text-center">
          <Link
            href={historyHref({ filter, range, limit: nextLimit, phone: linkPhone })}
            scroll={false}
            className="inline-block text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 px-4 py-2"
          >
            Show older
          </Link>
        </div>
      )}
    </div>
  );
}
