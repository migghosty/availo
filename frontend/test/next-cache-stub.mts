/**
 * Stand-in for `next/cache` in the integration tier, wired in by the alias in
 * `vitest.config.mts`.
 *
 * `unstable_cache` needs the incremental cache that only a running Next.js
 * server provides; called from Vitest it throws "Invariant: incrementalCache
 * missing". `getBusinessName()` (lib/settingsData.ts) is wrapped in it, and
 * every booking and cancellation notification calls that — so before this
 * stub, all 14 notification tests failed, and CI had been red since the cache
 * was added.
 *
 * A pass-through is the honest replacement, not a mock that hides behaviour:
 * the tests clear and reseed `Settings` between cases, so an actual cache
 * would only make them read a previous case's business name.
 */

export function unstable_cache<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>
): (...args: Args) => Promise<Result> {
  return fn;
}

export function revalidateTag(): void {}

export function revalidatePath(): void {}
