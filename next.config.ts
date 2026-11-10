import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/operasional/*': ['./integration/kelompok3/index.html', './integration/kelompok3/app.js', './integration/kelompok3/style.css'],
  },
};

export default nextConfig;
