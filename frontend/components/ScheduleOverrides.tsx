"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  formatWindow,
  minutesToTimeInput,
  timeInputToMinutes,
  type TimeWindow,
} from "@/lib/schedule";
import { todayInTimezone } from "@/lib/timezone";

export type OverrideRecord = {
  id: number;
  date: string;
  isClosed: boolean;
  windows: { id: number; startMinute: number; endMinute: number }[];
};

type WindowRow = { id: string; start: string; end: string };

let rowCounter = 0;
function newRow(start = "09:00", end = "17:00"): WindowRow {
  rowCounter += 1;
  return { id: `o${rowCounter}`, start, end };
}

function formatDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function describe(override: OverrideRecord) {
  if (override.isClosed) return "Closed all day";
  return override.windows
    .map((w) => formatWindow({ startMinute: w.startMinute, endMinute: w.endMinute }))
    .join(", ");
}

export function ScheduleOverrides({ overrides }: { overrides: OverrideRecord[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState("");
  const [isClosed, setIsClosed] = useState(false);
  const [rows, setRows] = useState<WindowRow[]>([newRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  function resetForm() {
    setDate("");
    setIsClosed(false);
    setRows([newRow()]);
    setError(null);
  }

  function startAdding(existing?: OverrideRecord) {
    if (existing) {
      setDate(existing.date);
      setIsClosed(existing.isClosed);
      setRows(
        existing.windows.length > 0
          ? existing.windows.map((w) =>
              newRow(minutesToTimeInput(w.startMinute), minutesToTimeInput(w.endMinute))
            )
          : [newRow()]
      );
      setError(null);
    } else {
      resetForm();
    }
    setAdding(true);
  }

  async function handleSave() {
    if (!date) {
      setError("Pick a date.");
      return;
    }

    const windows: TimeWindow[] = [];

    if (!isClosed) {
      for (const row of rows) {
        const startMinute = timeInputToMinutes(row.start);
        const endMinute = timeInputToMinutes(row.end);

        if (startMinute === null || endMinute === null) {
          setError("Please fill in both times for each range.");
          return;
        }
        if (endMinute <= startMinute) {
          setError("Each end time must come after its start time.");
          return;
        }

        windows.push({ startMinute, endMinute });
      }

      if (windows.length === 0) {
        setError("Add at least one time range, or mark the day as closed.");
        return;
      }
    }

    setSaving(true);
    setError(null);

    const res = await fetch("/api/schedule/overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, isClosed, windows }),
    });

    setSaving(false);

    if (res.ok) {
      setAdding(false);
      resetForm();
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not save this date.");
    }
  }

  async function handleRemove(id: number) {
    setRemovingId(id);
    const res = await fetch(`/api/schedule/overrides/${id}`, { method: "DELETE" });

    if (res.ok) {
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Could not remove this date.");
    }
    setRemovingId(null);
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-800">
        {overrides.length === 0 ? (
          <p className="px-5 py-4 sm:px-6 text-sm text-gray-400 dark:text-slate-500">
            No date-specific changes. Your weekly schedule applies to every day.
          </p>
        ) : (
          overrides.map((override) => (
            <div
              key={override.id}
              className="flex items-start justify-between gap-3 px-5 py-4 sm:px-6"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-700 dark:text-slate-200 text-sm">
                  {formatDateKey(override.date)}
                </p>
                <p
                  className={`text-xs mt-0.5 ${
                    override.isClosed
                      ? "text-red-600 dark:text-red-400"
                      : "text-gray-500 dark:text-slate-400"
                  }`}
                >
                  {describe(override)}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-none">
                <button
                  onClick={() => startAdding(override)}
                  className="text-sm text-gray-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-2 -m-2"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleRemove(override.id)}
                  disabled={removingId === override.id}
                  className="text-sm text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50 transition-colors p-2 -m-2"
                >
                  {removingId === override.id ? "Removing…" : "Remove"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {adding ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-5 sm:p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Date
            </label>
            <input
              type="date"
              value={date}
              min={todayInTimezone()}
              onChange={(e) => setDate(e.target.value)}
              className="w-full sm:w-auto border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={isClosed}
              onChange={(e) => setIsClosed(e.target.checked)}
              className="w-4 h-4 accent-amber-500"
            />
            Closed all day
          </label>

          {!isClosed && (
            <div className="space-y-2">
              <span className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                Hours for this date
              </span>
              {rows.map((row) => (
                <div key={row.id} className="flex items-center gap-2">
                  <input
                    type="time"
                    value={row.start}
                    onChange={(e) =>
                      setRows(rows.map((r) => (r.id === row.id ? { ...r, start: e.target.value } : r)))
                    }
                    aria-label="Start time"
                    className="flex-1 min-w-0 border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-gray-400 dark:text-slate-500 flex-none">–</span>
                  <input
                    type="time"
                    value={row.end}
                    onChange={(e) =>
                      setRows(rows.map((r) => (r.id === row.id ? { ...r, end: e.target.value } : r)))
                    }
                    aria-label="End time"
                    className="flex-1 min-w-0 border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setRows(rows.filter((r) => r.id !== row.id))}
                      aria-label="Remove this time range"
                      className="text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors p-2 -m-1 flex-none"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setRows([...rows, newRow()])}
                className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 font-medium p-2 -m-2"
              >
                + Add hours
              </button>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 sm:flex-none bg-amber-500 hover:bg-amber-600 text-white font-medium px-6 py-2.5 rounded-lg transition-colors disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save date"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                resetForm();
              }}
              className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 px-3 py-2.5"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => startAdding()}
          className="text-sm text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 font-medium p-2 -m-2"
        >
          + Add a date-specific change
        </button>
      )}
    </div>
  );
}
