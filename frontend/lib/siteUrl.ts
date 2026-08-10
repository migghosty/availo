import { headers } from "next/headers";

/**
 * The absolute origin this request arrived on, e.g. `https://availo.vercel.app`.
 *
 * Needed because a calendar event outlives the page that produced it — a
 * relative `/cancel/xyz` is meaningless once the event is sitting on someone's
 * phone, so links baked into an .ics have to be absolute.
 *
 * Derived from the request rather than an environment variable so preview
 * deployments and localhost each produce links that point back at themselves.
 * Vercel terminates TLS at the edge, so `host` alone would lose the scheme;
 * `x-forwarded-proto` is what carries it.
 *
 * Works in both Server Components and Route Handlers. Callers become dynamic by
 * using it, which is already true of every page that shows a booking.
 */
export async function getOrigin(): Promise<string> {
  const headerList = await headers();

  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) {
    throw new Error("Cannot determine request origin: no Host header.");
  }

  // `next dev` sits behind no proxy, so nothing sets x-forwarded-proto there and
  // assuming https would produce dead links throughout local development.
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host);
  const proto = headerList.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");

  return `${proto}://${host}`;
}
