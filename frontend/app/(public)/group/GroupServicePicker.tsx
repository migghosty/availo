"use client";

import { useState } from "react";
import { formatDuration, formatPrice } from "@/lib/service";
import { totalDurationMinutes, totalPriceCents } from "@/lib/selection";
import type { BookableService } from "@/lib/serviceData";

/**
 * A service dropdown per person, plus the running total for the block.
 *
 * The only client component in the group flow. The count step above it is
 * plain links, and the submit is a Server Action, so this holds state for
 * exactly one reason: the total has to update the instant a dropdown changes.
 * A server round-trip per change is a visible stall on a phone, and the total
 * ("3 people · 90 min · $70") is the whole point of the screen — it is how
 * somebody discovers a party of four will be there for two hours.
 *
 * The totals are computed with the same pure functions the server uses to
 * decide availability, so the number shown here and the length actually booked
 * cannot disagree.
 */
export function GroupServicePicker({
  services,
  count,
}: {
  services: BookableService[];
  count: number;
}) {
  // Defaults to the first service for everyone, so the total is real on first
  // paint and a submit is never empty.
  const [chosen, setChosen] = useState<number[]>(() =>
    Array.from({ length: count }, () => services[0].id)
  );

  const byId = new Map(services.map((service) => [service.id, service]));
  const selected = chosen.map((id) => byId.get(id) ?? services[0]);
  const minutes = totalDurationMinutes(selected);
  const price = totalPriceCents(selected);

  const setAt = (index: number, id: number) =>
    setChosen((current) => current.map((v, i) => (i === index ? id : v)));

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-800">
        {selected.map((service, index) => (
          <div
            key={index}
            className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3.5"
          >
            <label
              htmlFor={`person-${index}`}
              className="text-sm font-medium text-gray-700 dark:text-slate-300 sm:w-24 sm:flex-none"
            >
              Person {index + 1}
            </label>
            <div className="min-w-0 flex-1">
              <select
                id={`person-${index}`}
                name="service"
                value={service.id}
                onChange={(e) => setAt(index, Number(e.target.value))}
                className="w-full border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 sm:py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {services.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} — {formatDuration(option.durationMinutes)} —{" "}
                    {formatPrice(option.priceCents)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      {/* aria-live so the total is announced, not just seen — it changes
          without any navigation. */}
      <div
        aria-live="polite"
        className="flex items-center justify-between gap-3 px-1 text-sm"
      >
        <span className="text-gray-500 dark:text-slate-400">
          {count} people &middot; {formatDuration(minutes)} total
        </span>
        <span className="font-semibold text-amber-600 dark:text-amber-400">
          {formatPrice(price)}
        </span>
      </div>

      <button
        type="submit"
        className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60"
      >
        Continue to times
      </button>
    </div>
  );
}
