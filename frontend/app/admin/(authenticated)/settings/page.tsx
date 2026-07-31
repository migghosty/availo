import { db } from "@/lib/db";
import { SettingsForm } from "@/components/SettingsForm";

export default async function SettingsPage() {
  const settings = await db.settings.findFirst();
  const duration = settings?.slotDurationMin ?? 30;

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure your booking preferences.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <SettingsForm currentDuration={duration} />
      </div>
    </div>
  );
}
