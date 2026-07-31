import { db } from "@/lib/db";
import Link from "next/link";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(date));
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
}

export default async function HomePage() {
  const slots = await db.slot.findMany({
    where: { startTime: { gte: new Date() }, isAvailable: true },
    orderBy: { startTime: "asc" },
  });

  const grouped = new Map<string, typeof slots>();
  for (const slot of slots) {
    const key = formatDate(slot.startTime);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(slot);
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Book an Appointment</h1>
        <p className="text-gray-500 mt-1">Pick a time that works for you.</p>
      </div>

      {grouped.size === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500">No available slots right now. Check back soon!</p>
        </div>
      ) : (
        <div className="space-y-7">
          {Array.from(grouped.entries()).map(([dateLabel, dateSlots]) => (
            <section key={dateLabel}>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                {dateLabel}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {dateSlots.map((slot) => (
                  <Link
                    key={slot.id}
                    href={`/book/${slot.id}`}
                    className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between hover:border-amber-400 hover:shadow-sm transition-all group"
                  >
                    <div>
                      <p className="font-semibold text-slate-700">
                        {formatTime(slot.startTime)}
                      </p>
                      <p className="text-sm text-gray-400">{slot.durationMinutes} min</p>
                    </div>
                    <span className="text-amber-500 text-sm font-medium group-hover:translate-x-1 transition-transform">
                      Book →
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
