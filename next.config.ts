import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "standalone",
  serverExternalPackages: ["@napi-rs/canvas"],
  typedRoutes: true,
};

export default nextConfig;
