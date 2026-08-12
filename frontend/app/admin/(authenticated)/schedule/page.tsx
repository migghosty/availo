import Link from "next/link";
import { db } from "@/lib/db";
import { WeeklyScheduleEditor } from "@/components/WeeklyScheduleEditor";
import { ScheduleOverrides } from "@/components/ScheduleOverrides";
import { getConfig } from "@/lib/scheduleData";
import { todayInTimezone } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const [rules, overrides, config] = await Promise.all([
    db.scheduleRule.findMany({
      orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
      select: { dayOfWeek: true, startMinute: true, endMinute: true },
    }),
    db.scheduleOverride.findMany({
      where: { date: { gte: todayInTimezone() } },
      include: { windows: { orderBy: { startMinute: "asc" } } },
      orderBy: { date: "asc" },
    }),
    getConfig(),
  ]);

  return (
    <div className="max-w-lg space-y-10">
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Schedule</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Set the hours you work each week. Clients can start an appointment
            every {config.slotIntervalMin} minutes within those hours — how long
            it runs depends on the service they pick, set on the{" "}
            <Link
              href="/admin/services"
              className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 font-medium"
            >
              Services
            </Link>{" "}
            page.
          </p>
        </div>

        <WeeklyScheduleEditor rules={rules} />
      </div>

      <div>
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            Specific dates
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Different hours for one day, or a day off. These replace your weekly
            hours for that date only — the rest of your schedule stays the same.
          </p>
        </div>

        <ScheduleOverrides overrides={overrides} />
      </div>
    </div>
  );
}
