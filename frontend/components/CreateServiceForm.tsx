"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { DURATION_OPTIONS } from "@/lib/service";

const DEFAULT_DURATION = 30;

export function CreateServiceForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [price, setPrice] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_DURATION);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, emoji, price, durationMinutes }),
    });

    setSubmitting(false);

    if (res.ok) {
      setName("");
      setEmoji("");
      setPrice("");
      setDurationMinutes(DEFAULT_DURATION);
      router.refresh();
    } else {
      const { error } = await res.json();
      setError(error ?? "Failed to create service.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Four fields now, so wrap at sm: rather than crushing them into one row */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
        <div className="sm:w-16">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Icon</label>
          <input
            type="text"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            placeholder="✂️"
            maxLength={8}
            className="w-full border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 sm:py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div className="flex-1 sm:min-w-[8rem]">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Haircut"
            required
            maxLength={60}
            className="w-full border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 sm:py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div className="sm:w-28">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Price ($)</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="25"
            min="0"
            step="0.01"
            required
            className="w-full border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 sm:py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        {/* A native select beats six pills here: it's one tap on a phone, and
            this is what decides which start times the service can even use. */}
        <div className="sm:w-32">
          <label
            htmlFor="new-service-duration"
            className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1"
          >
            Length
          </label>
          <select
            id="new-service-duration"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            className="w-full border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 sm:py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {DURATION_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} min
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="bg-amber-500 hover:bg-amber-600 text-white font-medium px-6 py-2 rounded-lg transition-colors disabled:opacity-60"
      >
        {submitting ? "Adding…" : "Add Service"}
      </button>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
