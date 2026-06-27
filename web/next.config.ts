import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app has its own lockfile; the repo root also has one (the engine API).
  // Pin Turbopack's root to web/ so it doesn't infer the parent as the workspace.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
