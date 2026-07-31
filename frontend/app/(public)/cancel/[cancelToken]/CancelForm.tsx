"use client";

import { useActionState } from "react";
import { cancelBookingAction } from "./actions";

export function CancelForm({ cancelToken }: { cancelToken: string }) {
  const boundAction = cancelBookingAction.bind(null, cancelToken);
  const [error, formAction, isPending] = useActionState(boundAction, null);

  return (
    <form action={formAction}>
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60"
      >
        {isPending ? "Cancelling…" : "Yes, cancel my appointment"}
      </button>
    </form>
  );
}
