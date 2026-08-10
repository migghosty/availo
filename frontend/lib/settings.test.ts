/**
 * Address normalization.
 *
 * The admin types this into a textarea and often pastes it from a maps app,
 * which brings along trailing spaces and blank lines. Whatever survives here
 * ends up as the LOCATION of every calendar event, so it is worth tidying.
 */

import { describe, expect, it } from "vitest";

import { MAX_ADDRESS_LENGTH, normalizeAddress } from "./settings";

describe("normalizeAddress", () => {
  it("leaves a tidy address alone", () => {
    expect(normalizeAddress("123 Main St\nSpringfield, CA 90210")).toBe(
      "123 Main St\nSpringfield, CA 90210"
    );
  });

  it("keeps interior line breaks — an address reads better over two lines", () => {
    expect(normalizeAddress("A\nB\nC")).toBe("A\nB\nC");
  });

  it("trims surrounding whitespace and blank lines", () => {
    expect(normalizeAddress("\n\n  123 Main St  \n\n")).toBe("123 Main St");
  });

  it("trims each line, not just the ends", () => {
    expect(normalizeAddress("  123 Main St  \n   Springfield  ")).toBe(
      "123 Main St\nSpringfield"
    );
  });

  it("collapses blank-line runs left behind by a paste", () => {
    expect(normalizeAddress("123 Main St\n\n\nSpringfield, CA")).toBe(
      "123 Main St\nSpringfield, CA"
    );
  });

  it("normalizes CRLF and lone CR to LF", () => {
    // A Windows paste would otherwise put a stray \r inside the .ics TEXT value.
    expect(normalizeAddress("123 Main St\r\nSpringfield")).toBe(
      "123 Main St\nSpringfield"
    );
    expect(normalizeAddress("123 Main St\rSpringfield")).toBe(
      "123 Main St\nSpringfield"
    );
  });

  it("maps a whitespace-only address to empty, meaning 'not set'", () => {
    expect(normalizeAddress("   \n\n  ")).toBe("");
    expect(normalizeAddress("")).toBe("");
  });

  it("is idempotent", () => {
    const once = normalizeAddress("  123 Main St \n\n Springfield, CA  ");
    expect(normalizeAddress(once)).toBe(once);
  });

  it("allows a realistic address well within the length cap", () => {
    const address = "1600 Amphitheatre Parkway, Building 42, Suite 100\nMountain View, CA 94043";
    expect(normalizeAddress(address).length).toBeLessThan(MAX_ADDRESS_LENGTH);
  });
});
