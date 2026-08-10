/**
 * Business-details vocabulary and validation.
 *
 * Pure — no database import, because the admin form is a client component and
 * would otherwise pull Prisma into the browser bundle. The server-side loader
 * lives in `settingsData.ts`, mirroring the `schedule.ts` / `scheduleData.ts`
 * split.
 */

/**
 * Long enough for a multi-line street address with a suite number and a
 * landmark, short enough that a stray paste can't fill the column.
 */
export const MAX_ADDRESS_LENGTH = 500;

/**
 * Trims the address and collapses the blank-line runs a copy-paste from a maps
 * app tends to leave behind. Interior newlines are kept: an address reads
 * better over two or three lines, and iCalendar escapes them fine.
 */
export function normalizeAddress(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
