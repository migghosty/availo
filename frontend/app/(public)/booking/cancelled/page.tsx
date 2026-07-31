import Link from "next/link";

export default function BookingCancelledPage() {
  return (
    <div className="max-w-md">
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <p className="text-4xl mb-3">✓</p>
        <h1 className="text-xl font-bold text-slate-800">Appointment cancelled</h1>
        <p className="text-sm text-gray-500 mt-2">
          Your appointment has been cancelled. The slot is now available for others to book.
        </p>
        <Link
          href="/slots"
          className="inline-block mt-6 bg-amber-500 hover:bg-amber-600 text-white font-medium px-6 py-2 rounded-lg transition-colors text-sm"
        >
          Book a new appointment
        </Link>
      </div>
    </div>
  );
}
