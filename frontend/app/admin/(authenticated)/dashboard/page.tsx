import { db } from "@/lib/db";
import { DeleteSlotButton } from "@/components/DeleteSlotButton";
import { AdminCancelBookingButton } from "@/components/AdminCancelBookingButton";
import Link from "next/link";

export const dynamic = "force-dynamic";

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
}

export default async function DashboardPage() {
  const slots = await db.slot.findMany({
    where: { startTime: { gte: new Date() } },
    include: { booking: true },
    orderBy: { startTime: "asc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <Link
          href="/admin/slots/new"
          className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Add Slots
        </Link>
      </div>

      {slots.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-sm">No upcoming slots.</p>
          <Link
            href="/admin/slots/new"
            className="inline-block mt-3 text-amber-600 hover:text-amber-800 text-sm font-medium"
          >
            Add your first slot →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Date &amp; Time</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Duration</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {slots.map((slot) => (
                <tr key={slot.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-slate-700">
                    {formatDateTime(slot.startTime)}
                  </td>
                  <td className="px-5 py-3 text-gray-500">
                    {slot.durationMinutes} min
                  </td>
                  <td className="px-5 py-3">
                    {slot.booking ? (
                      <div>
                        <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
                          Booked
                        </span>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {slot.booking.clientName} &middot; {slot.booking.clientEmail}
                        </p>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
                        Available
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    {slot.booking ? (
                      <AdminCancelBookingButton bookingId={slot.booking.id} />
                    ) : (
                      <DeleteSlotButton slotId={slot.id} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
