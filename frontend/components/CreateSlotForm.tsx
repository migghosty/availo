"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { todayInTimezone } from "@/lib/timezone";

export function CreateSlotForm({ defaultDuration }: { defaultDuration: number }) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [times, setTimes] = useState<string[]>([""]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null);

  function addTime() {
    setTimes((prev) => [...prev, ""]);
  }

  function removeTime(index: number) {
    setTimes((prev) => prev.filter((_, i) => i !== index));
  }

  function updateTime(index: number, value: string) {
    setTimes((prev) => prev.map((t, i) => (i === index ? value : t)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;

    const validTimes = times.filter((t) => t.trim());
    if (validTimes.length === 0) return;

    setSubmitting(true);
    setResult(null);

    const errors: string[] = [];
    let created = 0;

    for (const time of validTimes) {
      const startTime = `${date}T${time}:00`;
      const res = await fetch("/api/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startTime, durationMinutes: defaultDuration }),
      });
      if (res.ok) {
        created++;
      } else {
        const { error } = await res.json();
        errors.push(`${time}: ${error ?? "failed"}`);
      }
    }

    setResult({ created, errors });
    setSubmitting(false);
    if (created > 0) router.refresh();
  }

  const today = todayInTimezone();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
        <input
          type="date"
          value={date}
          min={today}
          onChange={(e) => setDate(e.target.value)}
          required
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Start times</label>
          <button
            type="button"
            onClick={addTime}
            className="text-sm text-amber-600 hover:text-amber-800 font-medium"
          >
            + Add time
          </button>
        </div>
        <div className="space-y-2">
          {times.map((time, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="time"
                value={time}
                onChange={(e) => updateTime(i, e.target.value)}
                required
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              {times.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTime(i)}
                  className="text-sm text-gray-400 hover:text-red-500 transition-colors"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Each slot is {defaultDuration} minutes. Change this in Settings.
        </p>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="bg-amber-500 hover:bg-amber-600 text-white font-medium px-6 py-2 rounded-lg transition-colors disabled:opacity-60"
      >
        {submitting ? "Creating…" : `Create ${times.filter((t) => t).length} slot(s)`}
      </button>

      {result && (
        <div className="rounded-lg border p-4 text-sm space-y-1">
          {result.created > 0 && (
            <p className="text-green-700 font-medium">
              ✓ {result.created} slot{result.created !== 1 ? "s" : ""} created successfully.
            </p>
          )}
          {result.errors.map((err, i) => (
            <p key={i} className="text-red-600">
              ✕ {err}
            </p>
          ))}
        </div>
      )}
    </form>
  );
}
