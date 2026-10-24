import type { MetadataRoute } from "next";

// Keeps crawlers (and Google's index) off the booking flow, per-slot
// /book/* pages, admin and API routes. / and /about stay open.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/about"],
      disallow: [
        "/book/",
        "/admin",
        "/api/",
        "/cancel/",
        "/my-booking",
        "/slots",
      ],
    },
  };
}
