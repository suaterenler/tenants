import type { NextConfig } from "next";

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const LIVE_FRAME_ORIGINS = ["https://erenleryazilim.com", "https://*.erenleryazilim.com", ...(process.env.NODE_ENV === "production" ? [] : ["http://localhost:*"])].join(" ");

const LIVE_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), display-capture=(self), geolocation=()" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/admin",
  async headers() {
    return [
      { source: "/:path((?!live(?:/|$)).*)", headers: SECURITY_HEADERS },
      { source: "/live/:path*", headers: LIVE_HEADERS },
      { source: "/live/join/:code", headers: [{ key: "Content-Security-Policy", value: `frame-ancestors 'self' ${LIVE_FRAME_ORIGINS}` }] },
      { source: "/live", headers: [{ key: "X-Frame-Options", value: "DENY" }] },
      { source: "/live/room/:code", headers: [{ key: "X-Frame-Options", value: "DENY" }] },
    ];
  },
};

export default nextConfig;
