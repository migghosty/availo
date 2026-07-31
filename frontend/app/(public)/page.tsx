import Link from "next/link";

const services = [
  { emoji: "✂️", name: "Haircut", price: "$25" },
  { emoji: "✨", name: "Eyebrows", price: "$10" },
  { emoji: "🪒", name: "Beard", price: "$20" },
  { emoji: "💈", name: "Hair & Beard", price: "$40" },
];

export default function LandingPage() {
  return (
    <div>
      {/* Hero */}
      <div className="py-10 sm:py-16 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 tracking-tight">
          Fresh cuts. Clean edges.
        </h1>
        <p className="text-gray-500 mt-3 text-base sm:text-lg px-2">
          Book your next appointment in seconds — no account needed.
        </p>
        <Link
          href="/slots"
          className="inline-block mt-7 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-semibold px-8 py-3 rounded-xl text-sm transition-colors shadow-sm"
        >
          Book Now
        </Link>
      </div>

      {/* Services */}
      <div className="mt-2">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
          Services
        </h2>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {services.map((service) => (
            <div
              key={service.name}
              className="flex items-center justify-between px-5 py-4 sm:px-6"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden>{service.emoji}</span>
                <span className="font-medium text-slate-700">{service.name}</span>
              </div>
              <span className="text-amber-600 font-semibold">{service.price}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA footer */}
      <div className="mt-10 text-center">
        <Link
          href="/slots"
          className="text-sm text-amber-600 hover:text-amber-800 font-medium transition-colors"
        >
          View available times →
        </Link>
      </div>
    </div>
  );
}
