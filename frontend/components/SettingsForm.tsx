"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

export function SettingsForm({ currentDuration }: { currentDuration: number }) {
  const router = useRouter();
  const [duration, setDuration] = useState(currentDuration);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotDurationMin: duration }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
          Default slot duration
        </label>
        <div className="flex flex-wrap gap-2">
          {DURATION_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => { setDuration(opt); setSaved(false); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                duration === opt
                  ? "bg-amber-500 border-amber-500 text-white"
                  : "border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-amber-400 dark:hover:border-amber-500"
              }`}
            >
              {opt} min
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
          Applied to all new slots you create going forward.
        </p>
      </div>

      <button
        type="submit"
        disabled={saving || duration === currentDuration}
        className="bg-amber-500 hover:bg-amber-600 text-white font-medium px-6 py-2 rounded-lg transition-colors disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save"}
      </button>

      {saved && (
        <p className="text-sm text-green-700 dark:text-green-400 font-medium">✓ Settings saved.</p>
      )}
    </form>
  );
}
