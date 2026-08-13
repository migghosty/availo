"use client";

import { useActionState } from "react";
import { bookSlotAction } from "./actions";
import { PhoneField } from "@/components/PhoneField";

export function BookingForm({
  startMs,
  serviceId,
}: {
  startMs: number;
  serviceId: number;
}) {
  const boundAction = bookSlotAction.bind(null, startMs, serviceId);
  const [error, formAction, isPending] = useActionState(boundAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="clientName" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
          Full name
        </label>
        <input
          id="clientName"
          name="clientName"
          type="text"
          autoComplete="name"
          required
          className="w-full border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
        />
      </div>

      <div>
        <label htmlFor="clientPhone" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
          Phone number
        </label>
        <PhoneField
          id="clientPhone"
          name="clientPhone"
          required
          className="w-full border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
          So we can reach you about this appointment — and how you&apos;ll look
          it up later.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60"
      >
        {isPending ? "Booking…" : "Confirm Booking"}
      </button>
    </form>
  );
}
