"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminCancelBookingButton({ bookingId }: { bookingId: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!confirm("Cancel this client's booking and free the slot?")) return;
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
      className="inline-block -m-2 p-2 text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50 transition-colors"
    >
      {loading ? "Cancelling…" : "Cancel booking"}
    </button>
  );
}
