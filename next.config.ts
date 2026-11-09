import type { NextConfig } from "next";

const publishingFiles = [
  "./src/**/*.{ts,tsx,css,svg,json,md,txt}",
  "./public/*.{svg,sql,png,jpg,jpeg,webp,ico,txt}",
  "./drizzle/**/*.{sql,json}",
  "./.gitignore", "./.env.example", "./README.md",
  "./package.json", "./package-lock.json", "./next-env.d.ts",
  "./next.config.ts", "./tsconfig.json", "./postcss.config.mjs",
  "./eslint.config.mjs", "./drizzle.config.ts",
];

const nextConfig: NextConfig = {
  // Make only publishable source/assets available to the ZIP endpoint in production.
  outputFileTracingIncludes: { "/api/publicacao": publishingFiles },
  outputFileTracingExcludes: {
    "/api/publicacao": ["./.env", "./.env.local", "./.env.production", "./.env.development", "./public/downloads/**/*"],
  },
};

export default nextConfig;
