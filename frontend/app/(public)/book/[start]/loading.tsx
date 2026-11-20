/**
 * Shown while `/book/[start]` renders after a time pill is tapped.
 *
 * The pills don't prefetch (dozens per day, each a dynamic render — see
 * `SlotPicker.tsx`), so this appears once the server starts streaming rather
 * than on the tap itself; the pill's own pending spinner covers the gap
 * before that. Shaped like the confirm form so nothing jumps.
 */
export default function BookLoading() {
  return (
    <div className="max-w-md" aria-busy="true" aria-label="Loading booking form">
      <div className="h-5 w-28 rounded bg-gray-200 dark:bg-neutral-800 animate-pulse" />

      <div className="mt-4 mb-4">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          Confirm your booking
        </h1>
        <div className="h-5 w-56 mt-2 rounded bg-gray-200 dark:bg-neutral-800 animate-pulse" />
      </div>

      <div className="mb-6 h-[58px] rounded-xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-blue-500/15 animate-pulse" />

      <div className="bg-white dark:bg-neutral-950 rounded-xl border border-gray-200 dark:border-blue-500/15 p-6 space-y-4 animate-pulse">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i}>
            <div className="h-4 w-20 rounded bg-gray-200 dark:bg-neutral-800 mb-2" />
            <div className="h-[42px] rounded-lg bg-gray-100 dark:bg-neutral-900" />
          </div>
        ))}
        <div className="h-[46px] rounded-lg bg-blue-600/30" />
      </div>
    </div>
  );
}
