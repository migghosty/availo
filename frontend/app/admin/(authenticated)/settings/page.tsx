import { db } from "@/lib/db";
import { SettingsForm } from "@/components/SettingsForm";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await db.settings.findFirst();
  const duration = settings?.slotDurationMin ?? 30;

  return (
    <div className="max-w-lg space-y-8">
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Settings</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Configure your booking preferences.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6">
          <SettingsForm currentDuration={duration} />
        </div>
      </div>

      <div>
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Password</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Change your admin login password.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6">
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
