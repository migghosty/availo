import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Lets a phone on the same Wi-Fi load the dev server by IP.
   *
   * Next blocks cross-origin requests to dev-only endpoints by default, which
   * stops a malicious page from reading your source. The block is silent in the
   * browser — the HMR request to `/_next/webpack-hmr` is refused, the dev
   * runtime never finishes booting, and **React never hydrates**: pages render
   * and links work, but no button responds. It looks exactly like a broken app,
   * and only the terminal says otherwise.
   *
   * Given ~90% of this app's traffic is mobile, testing on a real phone against
   * `npm run dev` is routine, so the subnet is allowed here. This is
   * development-only — it has no effect on `next build` or production — and it
   * is scoped to a private range rather than opened to everything.
   *
   * If the machine moves to a network with a different subnet (e.g. 192.168.0.x
   * or 10.0.0.x), add that pattern here too.
   */
  allowedDevOrigins: ["192.168.1.*"],

  async headers() {
    return [
      {
        /**
         * The service worker must never be cached.
         *
         * A browser holding a stale `/sw.js` is close to impossible to fix
         * remotely — the old worker keeps claiming the scope, and the admin has
         * no devtools on a phone to unregister it. Push would simply stop
         * working with nothing to show why. `no-store` costs one tiny request
         * per app launch.
         */
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          /**
           * Lets the worker control the whole origin even though nothing
           * currently registers it from a subpath. Harmless here, and it means
           * a future registration from /admin doesn't silently get a narrower
           * scope than the manifest claims.
           */
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
