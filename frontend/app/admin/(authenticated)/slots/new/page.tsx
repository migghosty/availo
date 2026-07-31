import { db } from "@/lib/db";
import { CreateSlotForm } from "@/components/CreateSlotForm";

export default async function NewSlotPage() {
  const settings = await db.settings.findFirst();
  const duration = settings?.slotDurationMin ?? 30;

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Add Slots</h1>
        <p className="text-sm text-gray-500 mt-1">
          Choose a date and one or more start times. Each slot is {duration} minutes.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <CreateSlotForm defaultDuration={duration} />
      </div>
    </div>
  );
}
