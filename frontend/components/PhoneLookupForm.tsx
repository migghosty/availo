"use client";

import { PhoneField } from "./PhoneField";

/**
 * The `/my-booking` search box.
 *
 * A client component only so the number formats as it's typed — it's still a
 * plain `method="GET"` form, so submitting works without any client-side
 * routing and the results page stays server-rendered with the number in the
 * URL, shareable and refreshable.
 */
export function PhoneLookupForm({ defaultValue }: { defaultValue: string }) {
  return (
    <form method="GET" action="/my-booking" className="flex gap-2 mb-8">
      <label htmlFor="phone" className="sr-only">
        Phone number
      </label>
      <PhoneField
        id="phone"
        name="phone"
        defaultValue={defaultValue}
        required
        className="flex-1 min-w-0 border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
      />
      <button
        type="submit"
        className="bg-amber-500 hover:bg-amber-600 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors whitespace-nowrap"
      >
        Look up
      </button>
    </form>
  );
}
