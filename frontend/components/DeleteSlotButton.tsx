"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteSlotButton({ slotId }: { slotId: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this slot?")) return;
    setLoading(true);
    const res = await fetch(`/api/slots/${slotId}`, { method: "DELETE" });
    if (!res.ok) {
      const { error } = await res.json();
      alert(error ?? "Failed to delete slot.");
    } else {
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
    >
      {loading ? "Deleting…" : "Delete"}
    </button>
  );
}
