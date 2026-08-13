"use client";

import { useActionState } from "react";
import Link from "next/link";
import { bookSlotAction } from "./actions";
import { PhoneField } from "@/components/PhoneField";

export function BookingForm({
  startMs,
  serviceId,
  askForSmsConsent,
}: {
  startMs: number;
  serviceId: number;
  /**
   * Whether texting is switched on. Passed down rather than read here: this is
   * a client component, and the Twilio config is server-only. Asking for
   * consent to something that cannot happen would be a promise the app can't
   * keep, so the box is absent until SMS is live.
   */
  askForSmsConsent: boolean;
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

      {/* Carrier rules for application-sent SMS require consent to be collected
          where the number is, unchecked by default, saying who is texting and
          about what. This block is also what gets screenshotted for the A2P
          10DLC campaign registration, so its wording and the samples submitted
          there have to agree. */}
      {askForSmsConsent && (
      <div className="flex items-start gap-3 pt-1">
        <input
          id="smsConsent"
          name="smsConsent"
          type="checkbox"
          required
          // A checkbox is a small target; the padding gives it a comfortable
          // hit area without changing how it looks.
          className="mt-0.5 h-4 w-4 flex-none accent-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 rounded"
        />
        <label
          htmlFor="smsConsent"
          className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed"
        >
          Text me about this appointment. You&apos;ll get a confirmation and a
          message if anything changes — no marketing. Message and data rates may
          apply. Reply STOP to opt out.{" "}
          <Link
            href="/sms-terms"
            className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 underline"
          >
            SMS Terms
          </Link>{" "}
          &middot;{" "}
          <Link
            href="/privacy"
            className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 underline"
          >
            Privacy
          </Link>
        </label>
      </div>
      )}

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
