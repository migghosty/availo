import Link from "next/link";
import { GroupServicePicker } from "./GroupServicePicker";
import { chooseGroupAction } from "./actions";
import { MAX_GROUP_SIZE } from "@/lib/selection";
import { getBookableServices } from "@/lib/serviceData";

export const dynamic = "force-dynamic";

/**
 * Booking for a party: how many people, then a service for each.
 *
 * Two steps on one screen, and only the second holds client state. The count is
 * `?count=` in the URL, so the pills are plain links — back and forward work,
 * the half-made choice survives a reload, and nothing hydrates. The dropdowns
 * below it need `useState` for the running total, and nothing else.
 *
 * The order of the dropdowns is the order people are seen, because the block is
 * booked back to back: person 1 starts at the chosen time, person 2 when person
 * 1 finishes. That is the whole reason a group can't just book three times in a
 * row on the normal flow and hope the slots end up adjacent.
 */

/** 2 is the floor: one person is the ordinary flow, which the landing page is. */
const COUNTS = Array.from({ length: MAX_GROUP_SIZE - 1 }, (_, i) => i + 2);

export default async function GroupPage({
  searchParams,
}: {
  searchParams: Promise<{ count?: string }>;
}) {
  const [{ count: countParam }, services] = await Promise.all([
    searchParams,
    getBookableServices(),
  ]);

  const requested = Number(countParam);
  const count = COUNTS.includes(requested) ? requested : null;

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
          Book for a group
        </h1>
        <p className="text-gray-500 dark:text-slate-400 mt-1">
          Everyone is seen one after another, in the order below.
        </p>
      </div>

      {services.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-8 text-center">
          <p className="text-gray-500 dark:text-slate-400">
            No services available right now. Check back soon!
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">
              How many people?
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {COUNTS.map((option) => {
                const isSelected = option === count;
                return (
                  <Link
                    key={option}
                    href={`/group?count=${option}`}
                    aria-current={isSelected ? "true" : undefined}
                    className={
                      isSelected
                        ? "rounded-lg border border-amber-500 bg-amber-500 py-3 text-center text-sm font-semibold text-white transition-colors"
                        : "rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-3 text-center text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-amber-400 dark:hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                    }
                  >
                    {option}
                  </Link>
                );
              })}
            </div>
          </section>

          {count === null ? (
            <p className="text-sm text-gray-400 dark:text-slate-500 text-center">
              Pick a number above to choose each person&apos;s service.
            </p>
          ) : (
            <section>
              <h2 className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">
                What is each person having?
              </h2>
              {/* A Server Action, so this submits with or without JavaScript. */}
              <form action={chooseGroupAction}>
                {/* Remounts when the count changes, so the dropdowns reset to a
                    list of exactly `count` rather than keeping stale ones. */}
                <GroupServicePicker
                  key={count}
                  services={services}
                  count={count}
                />
              </form>
            </section>
          )}

          <p className="text-center">
            <Link
              href="/"
              className="text-sm font-medium text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 p-2 -m-2"
            >
              Booking for just yourself? →
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
