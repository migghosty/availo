/**
 * Shown the instant the admin switches tabs.
 *
 * Every admin page is dynamic, so the nav's prefetches can't fetch the pages
 * themselves — they stop at the nearest loading boundary. Before this file
 * existed there was none, so each prefetch came back as an empty shell and a
 * tap sat on the old tab for the whole server render (~700 ms on the live
 * site). With it, the nav (which stays mounted in the layout) highlights the
 * new tab and this skeleton appears at once, then the page streams in.
 *
 * One generic skeleton for all five tabs, sitting at the group level: it's
 * on screen for a fraction of a second, so matching each page's layout isn't
 * worth five files.
 *
 * It does **not** flash on in-page navigations — History's All/Cancelled
 * tabs, "Show older", the timeframe dropdown, or a phone search. Next 16
 * keys the boundary by segment *without* search params, so those stay
 * transitions that keep the current list on screen until the new one is
 * ready (and "Show older" keeps its scroll position).
 */
export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse">
      <div className="h-8 w-40 rounded bg-gray-200 dark:bg-neutral-800" />
      <div className="h-4 w-64 max-w-full mt-2 rounded bg-gray-200 dark:bg-neutral-800" />

      <div className="mt-6 bg-white dark:bg-neutral-950 rounded-xl border border-gray-200 dark:border-blue-500/15 divide-y divide-gray-100 dark:divide-blue-500/10">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="p-4 sm:px-5 space-y-2">
            <div className="h-4 w-1/3 rounded bg-gray-200 dark:bg-neutral-800" />
            <div className="h-3 w-1/2 rounded bg-gray-100 dark:bg-neutral-900" />
          </div>
        ))}
      </div>
    </div>
  );
}
