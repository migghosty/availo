/**
 * The photos shown on `/about`.
 *
 * Deliberately a checked-in constant rather than a database table. The app has
 * no image infrastructure at all — no blob store, no upload route, no file
 * input, no `images` config — and standing all of that up so one person can add
 * a handful of photos a few times a year costs far more than it returns.
 *
 * This module is the seam that keeps that decision cheap to reverse. Swapping to
 * admin-uploaded photos means replacing `GALLERY` with a Prisma loader (and
 * adding the blob host to `images.remotePatterns` in `next.config.ts`); the page
 * that renders them does not change, because it only ever sees `GalleryPhoto[]`.
 *
 * Pure — no database import — matching the `lib/service.ts` / `lib/serviceData.ts`
 * split used elsewhere.
 */

export type GalleryPhoto = {
  /** Path under `public/`, e.g. `/gallery/cut-01.jpg`. */
  src: string;
  /**
   * Required, not optional. These are the only images in the app, and a grid of
   * `alt=""` tiles is unusable to anyone on a screen reader. Describe the cut,
   * not the file: "Skin fade with a hard part", never "photo 1".
   */
  alt: string;
};

/**
 * To add a photo:
 *   1. Drop the file in `frontend/public/gallery/`
 *   2. Add one entry below
 *   3. Commit — it deploys itself
 *
 * Order here is display order. An empty array hides the gallery section on
 * `/about` entirely, so the page reads as finished before any photos exist.
 */
export const GALLERY: GalleryPhoto[] = [
  // { src: "/gallery/cut-01.jpg", alt: "Skin fade with a hard part" },
  // { src: "/gallery/cut-02.jpg", alt: "Textured crop with a taper" },
  // { src: "/gallery/cut-03.jpg", alt: "Beard line-up and shape-up" },
];
