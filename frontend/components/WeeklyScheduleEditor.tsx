"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DAY_NAMES,
  WEEK_ORDER,
  minutesToTimeInput,
  timeInputToMinutes,
  type TimeWindow,
} from "@/lib/schedule";

/**
 * Times are held as the "HH:MM" strings the inputs use rather than as minutes,
 * so a half-typed value can exist in the field without corrupting state. The
 * conversion to minutes happens once, on save.
 */
type WindowRow = { id: string; start: string; end: string };
type WeekState = Record<number, WindowRow[]>;

const DEFAULT_WINDOW = { start: "09:00", end: "17:00" };

let rowCounter = 0;
function newRow(start = DEFAULT_WINDOW.start, end = DEFAULT_WINDOW.end): WindowRow {
  rowCounter += 1;
  return { id: `w${rowCounter}`, start, end };
}

function toWeekState(rules: { dayOfWeek: number; startMinute: number; endMinute: number }[]) {
  const week: WeekState = {};
  for (const day of WEEK_ORDER) week[day] = [];

  for (const rule of rules) {
    week[rule.dayOfWeek] ??= [];
    week[rule.dayOfWeek].push(
      newRow(minutesToTimeInput(rule.startMinute), minutesToTimeInput(rule.endMinute))
    );
  }

  return week;
}

function serialize(week: WeekState) {
  return WEEK_ORDER.map((day) =>
    (week[day] ?? []).map((row) => `${row.start}-${row.end}`).join(",")
  ).join("|");
}

export function WeeklyScheduleEditor({
  rules,
}: {
  rules: { dayOfWeek: number; startMinute: number; endMinute: number }[];
}) {
  const router = useRouter();
  const [week, setWeek] = useState<WeekState>(() => toWeekState(rules));
  const [savedSnapshot, setSavedSnapshot] = useState(() => serialize(toWeekState(rules)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isDirty = serialize(week) !== savedSnapshot;

  function update(next: WeekState) {
    setWeek(next);
    setSaved(false);
    setError(null);
  }

  function setDayRows(day: number, rows: WindowRow[]) {
    update({ ...week, [day]: rows });
  }

  function toggleDay(day: number) {
    const isOpen = (week[day] ?? []).length > 0;
    setDayRows(day, isOpen ? [] : [newRow()]);
  }

  function addWindow(day: number) {
    setDayRows(day, [...(week[day] ?? []), newRow()]);
  }

  function removeWindow(day: number, id: string) {
    setDayRows(
      day,
      (week[day] ?? []).filter((row) => row.id !== id)
    );
  }

  function editWindow(day: number, id: string, field: "start" | "end", value: string) {
    setDayRows(
      day,
      (week[day] ?? []).map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  }

  /** Copies one day's hours onto every other day that's currently open. */
  function copyToOpenDays(sourceDay: number) {
    const source = week[sourceDay] ?? [];
    const next: WeekState = { ...week };

    for (const day of WEEK_ORDER) {
      if (day === sourceDay) continue;
      if ((week[day] ?? []).length === 0) continue;
      next[day] = source.map((row) => newRow(row.start, row.end));
    }

    update(next);
  }

  async function handleSave() {
    const days: { dayOfWeek: number; windows: TimeWindow[] }[] = [];

    for (const day of WEEK_ORDER) {
      const windows: TimeWindow[] = [];

      for (const row of week[day] ?? []) {
        const startMinute = timeInputToMinutes(row.start);
        const endMinute = timeInputToMinutes(row.end);

        if (startMinute === null || endMinute === null) {
          setError(`${DAY_NAMES[day]}: please fill in both times.`);
          return;
        }
        if (endMinute <= startMinute) {
          setError(`${DAY_NAMES[day]}: the end time must come after the start time.`);
          return;
        }

        windows.push({ startMinute, endMinute });
      }

      days.push({ dayOfWeek: day, windows });
    }

    setSaving(true);
    setError(null);

    const res = await fetch("/api/schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days }),
    });

    setSaving(false);

    if (res.ok) {
      setSavedSnapshot(serialize(week));
      setSaved(true);
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not save your schedule.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-800">
        {WEEK_ORDER.map((day) => {
          const rows = week[day] ?? [];
          const isOpen = rows.length > 0;

          return (
            <div key={day} className="p-4 sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`font-medium ${
                    isOpen
                      ? "text-slate-700 dark:text-slate-200"
                      : "text-gray-400 dark:text-slate-500"
                  }`}
                >
                  {DAY_NAMES[day]}
                </span>

                <div className="flex items-center gap-3">
                  {!isOpen && (
                    <span className="text-xs text-gray-400 dark:text-slate-500">Closed</span>
                  )}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isOpen}
                    aria-label={`${isOpen ? "Close" : "Open"} ${DAY_NAMES[day]}`}
                    onClick={() => toggleDay(day)}
                    className={`relative w-11 h-6 rounded-full transition-colors flex-none ${
                      isOpen ? "bg-amber-500" : "bg-gray-300 dark:bg-slate-700"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        isOpen ? "translate-x-5" : ""
                      }`}
                    />
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="mt-3 space-y-2">
                  {rows.map((row) => (
                    <div key={row.id} className="flex items-center gap-2">
                      <input
                        type="time"
                        value={row.start}
                        onChange={(e) => editWindow(day, row.id, "start", e.target.value)}
                        aria-label={`${DAY_NAMES[day]} start time`}
                        className="flex-1 min-w-0 border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <span className="text-gray-400 dark:text-slate-500 flex-none">–</span>
                      <input
                        type="time"
                        value={row.end}
                        onChange={(e) => editWindow(day, row.id, "end", e.target.value)}
                        aria-label={`${DAY_NAMES[day]} end time`}
                        className="flex-1 min-w-0 border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeWindow(day, row.id)}
                        aria-label="Remove this time range"
                        className="text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors p-2 -m-1 flex-none"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
                    <button
                      type="button"
                      onClick={() => addWindow(day)}
                      className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 font-medium p-2 -m-2"
                    >
                      + Add hours
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToOpenDays(day)}
                      className="text-xs text-gray-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-medium p-2 -m-2"
                    >
                      Copy to other open days
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="bg-amber-500 hover:bg-amber-600 text-white font-medium px-6 py-2.5 rounded-lg transition-colors disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save schedule"}
        </button>
        {saved && !isDirty && (
          <p className="text-sm text-green-700 dark:text-green-400 font-medium">
            ✓ Schedule saved.
          </p>
        )}
      </div>
    </div>
  );
}
