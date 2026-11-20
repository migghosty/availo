/**
 * Shown the instant a service is tapped on the landing page.
 *
 * `/slots` is dynamic, so Next can't prefetch the page itself — but it does
 * prefetch everything down to this loading boundary. That turns "tap, stare
 * at the old page for a second, then jump" into "tap, the calendar's outline
 * is already there, then it fills in". Shaped like the real page (heading,
 * chip, month grid, time pills) so nothing shifts when it arrives.
 */
export default function SlotsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading available times">
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
          Book an Appointment
        </h1>
        <p className="text-gray-500 dark:text-slate-400 mt-1">
          Pick a day, then a time that works for you.
        </p>
      </div>

      <div className="mb-6 h-[58px] rounded-xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-blue-500/15 animate-pulse" />

      <div className="space-y-8 animate-pulse">
        <div className="sm:bg-white sm:dark:bg-neutral-950 sm:rounded-xl sm:border sm:border-gray-200 sm:dark:border-blue-500/15 sm:p-5">
          <div className="max-w-md">
            <div className="flex items-center justify-center h-9 mb-3">
              <div className="h-4 w-32 rounded bg-gray-200 dark:bg-neutral-800" />
            </div>
            <div className="h-5 mb-1" />
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }, (_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-lg bg-gray-100 dark:bg-neutral-900"
                />
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="h-3 w-24 rounded bg-gray-200 dark:bg-neutral-800 mb-3" />
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {Array.from({ length: 9 }, (_, i) => (
              <div
                key={i}
                className="h-[46px] rounded-lg bg-white dark:bg-neutral-950 border border-gray-200 dark:border-blue-500/15"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
