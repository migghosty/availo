"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { DURATION_OPTIONS, formatDuration, formatPrice } from "@/lib/service";

type Service = {
  id: number;
  name: string;
  emoji: string;
  priceCents: number;
  durationMinutes: number;
  isActive: boolean;
};

export function ServiceListItem({ service }: { service: Service }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(service.name);
  const [emoji, setEmoji] = useState(service.emoji);
  const [price, setPrice] = useState((service.priceCents / 100).toString());
  const [durationMinutes, setDurationMinutes] = useState(service.durationMinutes);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/services/${service.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, emoji, price, durationMinutes }),
    });

    setSaving(false);

    if (res.ok) {
      setEditing(false);
      router.refresh();
    } else {
      const { error } = await res.json();
      setError(error ?? "Failed to save service.");
    }
  }

  /**
   * Archiving is the normal way to retire a service: it disappears for clients
   * but keeps its row, so bookings that reference it stay intact.
   */
  async function setActive(isActive: boolean) {
    setBusy(true);
    const res = await fetch(`/api/services/${service.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });

    if (res.ok) {
      router.refresh();
    } else {
      const { error } = await res.json();
      alert(error ?? "Failed to update service.");
    }
    setBusy(false);
  }

  /** Only ever succeeds for a service nothing has booked; the route 409s otherwise. */
  async function handleDelete() {
    if (!confirm(`Permanently delete "${service.name}"?`)) return;
    setBusy(true);
    const res = await fetch(`/api/services/${service.id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      const { error } = await res.json();
      alert(error ?? "Failed to delete service.");
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <form
        onSubmit={handleSave}
        className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 px-5 py-4 sm:px-6 bg-amber-50/50 dark:bg-amber-500/10"
      >
        <div className="sm:w-16">
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Icon</label>
          <input
            type="text"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            maxLength={8}
            className="w-full border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 sm:py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div className="flex-1 sm:min-w-[8rem]">
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={60}
            className="w-full border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 sm:py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div className="sm:w-28">
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Price ($)</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            min="0"
            step="0.01"
            required
            className="w-full border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 sm:py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div className="sm:w-32">
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Length</label>
          <select
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            className="w-full border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 sm:py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {/* A service edited to a length outside the presets keeps it */}
            {[...new Set([...DURATION_OPTIONS, durationMinutes])]
              .sort((a, b) => a - b)
              .map((option) => (
                <option key={option} value={option}>
                  {option} min
                </option>
              ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 sm:flex-none bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2.5 sm:py-2 rounded-lg transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 px-2 py-2.5 sm:py-2"
          >
            Cancel
          </button>
        </div>
        {error && <p className="w-full text-sm text-red-600 dark:text-red-400">{error}</p>}
      </form>
    );
  }

  return (
    <div
      className={`flex items-center justify-between gap-3 px-5 py-4 sm:px-6 ${
        service.isActive ? "" : "opacity-60"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-2xl flex-none" aria-hidden>{service.emoji}</span>
        <div className="min-w-0">
          <p className="font-medium text-slate-700 dark:text-slate-200 truncate">
            {service.name}
          </p>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {formatDuration(service.durationMinutes)} &middot;{" "}
            {formatPrice(service.priceCents)}
          </p>
        </div>
      </div>
      {/* p-2 -m-2 on each action: small text, comfortable thumb target */}
      <div className="flex items-center gap-4 flex-none">
        {service.isActive ? (
          <>
            <button
              onClick={() => setEditing(true)}
              className="text-sm text-gray-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-2 -m-2"
            >
              Edit
            </button>
            <button
              onClick={() => setActive(false)}
              disabled={busy}
              className="text-sm text-gray-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-50 transition-colors p-2 -m-2"
            >
              Archive
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setActive(true)}
              disabled={busy}
              className="text-sm text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 disabled:opacity-50 transition-colors p-2 -m-2"
            >
              Restore
            </button>
            <button
              onClick={handleDelete}
              disabled={busy}
              className="text-sm text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50 transition-colors p-2 -m-2"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}
