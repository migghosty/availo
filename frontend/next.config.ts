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
};

export default nextConfig;
