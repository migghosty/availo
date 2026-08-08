"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Service = {
  id: number;
  name: string;
  emoji: string;
  priceCents: number;
};

export function ServiceListItem({ service }: { service: Service }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(service.name);
  const [emoji, setEmoji] = useState(service.emoji);
  const [price, setPrice] = useState((service.priceCents / 100).toString());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/services/${service.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, emoji, price }),
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

  async function handleDelete() {
    if (!confirm(`Delete "${service.name}"?`)) return;
    setDeleting(true);
    const res = await fetch(`/api/services/${service.id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      const { error } = await res.json();
      alert(error ?? "Failed to delete service.");
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <form
        onSubmit={handleSave}
        className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 px-5 py-4 sm:px-6 bg-amber-50/50"
      >
        <div className="sm:w-16">
          <label className="block text-xs font-medium text-gray-500 mb-1">Icon</label>
          <input
            type="text"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            maxLength={8}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 sm:py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div className="flex-1 sm:min-w-[8rem]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={60}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 sm:py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div className="sm:w-28">
          <label className="block text-xs font-medium text-gray-500 mb-1">Price ($)</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            min="0"
            step="0.01"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 sm:py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
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
            className="text-sm text-gray-500 hover:text-gray-700 px-2 py-2.5 sm:py-2"
          >
            Cancel
          </button>
        </div>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between px-5 py-4 sm:px-6">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-2xl" aria-hidden>{service.emoji}</span>
        <span className="font-medium text-slate-700 truncate">{service.name}</span>
      </div>
      <div className="flex items-center gap-4 flex-none">
        <span className="text-amber-600 font-semibold">
          ${(service.priceCents / 100).toFixed(2)}
        </span>
        <button
          onClick={() => setEditing(true)}
          className="text-sm text-gray-500 hover:text-slate-700 transition-colors p-2 -m-2"
        >
          Edit
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors p-2 -m-2"
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  );
}
