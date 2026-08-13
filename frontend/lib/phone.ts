/**
 * Phone number normalization, validation and formatting.
 *
 * People write the same number half a dozen ways — `(619) 123-4567`,
 * `6191234567`, `619-123-4567`, `+1 619 123 4567` — and all of them have to
 * find the same booking. That works by collapsing every spelling to one
 * canonical stored form on the way in, never by trying to match on what was
 * typed. `normalizePhone` is that collapse, and it is the *only* one: both the
 * booking path and the `/my-booking` lookup call it, so a number can't be
 * stored under one spelling and searched for under another.
 *
 * Pure — no database import, because both phone inputs are client components
 * and would otherwise pull Prisma into the browser bundle. Mirrors the
 * `settings.ts` / `settingsData.ts` and `service.ts` / `serviceData.ts` split.
 *
 * Scope is the North American Numbering Plan (US, Canada and the Caribbean
 * countries sharing +1). Anything else is rejected rather than mangled.
 */

/**
 * A NANP national number: ten digits whose area code starts 2–9. No area code
 * begins with 0 or 1, so this catches the leading-digit slip that would
 * otherwise be stored and simply never ring.
 *
 * Strict NANP also forbids an exchange code starting with 0 or 1 — which would
 * reject `(619) 123-4567`, the number everyone reaches for when testing. That
 * rule is deliberately *not* enforced: a false reject means a real client
 * cannot book at all, while a false accept only means the admin dials a number
 * that doesn't connect. The asymmetry is not close, so validation stops at the
 * digit count and the area code.
 */
const NANP_NATIONAL = /^[2-9]\d{9}$/;

/**
 * Any accepted spelling → `+16191234567`, or null if it isn't a dialable NANP
 * number. Returning null rather than throwing matches `parsePriceCents` and
 * `timeInputToMinutes`; callers turn it into their own error message.
 */
export function normalizePhone(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;

  const raw = String(value).trim();
  if (!raw) return null;

  // A leading + means the caller is declaring a country code, so it has to be
  // +1. Without it, a bare 11-digit number starting with 1 is the familiar
  // long-distance spelling and the 1 is dropped.
  const declaresCountryCode = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");

  let national: string;
  if (declaresCountryCode) {
    if (digits.length !== 11 || !digits.startsWith("1")) return null;
    national = digits.slice(1);
  } else if (digits.length === 11 && digits.startsWith("1")) {
    national = digits.slice(1);
  } else if (digits.length === 10) {
    national = digits;
  } else {
    return null;
  }

  if (!NANP_NATIONAL.test(national)) return null;

  return `+1${national}`;
}

/**
 * Stored form → `(619) 123-4567`, for display. Anything it can't read is
 * returned untouched: showing a client a number verbatim beats showing them
 * an empty cell where their number should be.
 */
export function formatPhone(stored: string): string {
  const digits = String(stored ?? "").replace(/\D/g, "");
  const national =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;

  if (national.length !== 10) return stored;

  return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
}

/**
 * Progressive formatting for a partially-typed value, so the field reads as a
 * phone number while it's being filled in.
 *
 * Re-derived from the digits alone, which is what makes backspace behave —
 * deleting a `)` just removes a digit's worth of formatting rather than being
 * instantly re-added.
 */
export function formatPhoneInput(partial: string): string {
  const raw = String(partial ?? "");
  let digits = raw.replace(/\D/g, "");

  // A NANP area code never starts with 1, so a leading 1 can only ever be the
  // country code. Dropped as soon as there's a digit behind it.
  if (digits.length > 1 && digits.startsWith("1")) digits = digits.slice(1);

  // More digits than a NANP number holds — almost certainly an international
  // number pasted in. Hand back exactly what was typed rather than truncating
  // it: "+52 55 1234 5678" clipped to ten digits would silently become
  // "(525) 512-3456", a different and perfectly valid US number. Better to
  // leave it visibly foreign and let normalizePhone reject it by name.
  if (digits.length > 10) return raw;

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
