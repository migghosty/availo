"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { MAX_ADDRESS_LENGTH } from "@/lib/settings";

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];
const INTERVAL_OPTIONS = [10, 15, 20, 30, 60];
const HORIZON_OPTIONS = [7, 14, 30, 60, 90];

export type SettingsValues = {
  slotDurationMin: number;
  slotIntervalMin: number;
  bookingHorizonDays: number;
  address: string;
};

function PillGroup({
  label,
  hint,
  options,
  value,
  format,
  onChange,
}: {
  label: string;
  hint: string;
  options: number[];
  value: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
        {label}
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              value === option
                ? "bg-amber-500 border-amber-500 text-white"
                : "border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-amber-400 dark:hover:border-amber-500"
            }`}
          >
            {format(option)}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">{hint}</p>
    </div>
  );
}

export function SettingsForm({ current }: { current: SettingsValues }) {
  const router = useRouter();
  const [values, setValues] = useState<SettingsValues>(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isDirty =
    values.slotDurationMin !== current.slotDurationMin ||
    values.slotIntervalMin !== current.slotIntervalMin ||
    values.bookingHorizonDays !== current.bookingHorizonDays ||
    values.address !== current.address;

  function set<K extends keyof SettingsValues>(key: K, value: SettingsValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    setSaving(false);

    if (res.ok) {
      setSaved(true);
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not save your settings.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PillGroup
        label="Appointment length"
        hint="How long each booking takes. A booking blocks this much of your schedule."
        options={DURATION_OPTIONS}
        value={values.slotDurationMin}
        format={(v) => `${v} min`}
        onChange={(v) => set("slotDurationMin", v)}
      />

      <PillGroup
        label="Start times every"
        hint={`Clients see a start time this often within your hours — e.g. ${
          values.slotIntervalMin === 60 ? "4:00, 5:00" : "4:00, 4:15, 4:30"
        }. Booking one also blocks the times it would overlap.`}
        options={INTERVAL_OPTIONS}
        value={values.slotIntervalMin}
        format={(v) => `${v} min`}
        onChange={(v) => set("slotIntervalMin", v)}
      />

      <PillGroup
        label="Book up to"
        hint="How far ahead clients can book."
        options={HORIZON_OPTIONS}
        value={values.bookingHorizonDays}
        format={(v) => `${v} days`}
        onChange={(v) => set("bookingHorizonDays", v)}
      />

      {/* Not a scheduling knob like the pills above, so it sits below a divider. */}
      <div className="pt-6 border-t border-gray-100 dark:border-slate-800">
        <label
          htmlFor="address"
          className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2"
        >
          Address
        </label>
        <textarea
          id="address"
          name="address"
          rows={3}
          maxLength={MAX_ADDRESS_LENGTH}
          value={values.address}
          onChange={(e) => set("address", e.target.value)}
          placeholder={"123 Main St\nSpringfield, CA 90210"}
          className="w-full border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
          Where clients should go. Added to the calendar event when they tap
          &ldquo;Add to calendar&rdquo;, so their phone can map it. Leave empty to
          include no location.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || !isDirty}
          className="bg-amber-500 hover:bg-amber-600 text-white font-medium px-6 py-2.5 rounded-lg transition-colors disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {saved && !isDirty && (
          <p className="text-sm text-green-700 dark:text-green-400 font-medium">
            ✓ Settings saved.
          </p>
        )}
      </div>
    </form>
  );
}
