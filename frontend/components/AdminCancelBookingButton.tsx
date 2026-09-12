"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminCancelBookingButton({
  bookingId,
  groupSize = 1,
}: {
  bookingId: number;
  /**
   * How many rows this actually removes. A back-to-back group cancels whole —
   * the same rule the client's link follows — so silently deleting three rows
   * the admin didn't point at would be the most surprising thing in the app.
   * Both the prompt and the label say the number instead.
   */
  groupSize?: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isGroup = groupSize > 1;

  async function handleClick() {
    const question = isGroup
      ? `Cancel all ${groupSize} of this client's back-to-back bookings and free the whole block?`
      : "Cancel this client's booking and free the slot?";
    if (!confirm(question)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-block -m-2 p-2 text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium disabled:opacity-50 transition-colors"
    >
      {loading
        ? "Cancelling…"
        : isGroup
          ? `Cancel group of ${groupSize}`
          : "Cancel booking"}
    </button>
  );
}
