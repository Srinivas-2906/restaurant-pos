const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@kaana/ui"],
  eslint: { ignoreDuringBuilds: true },
};
module.exports = nextConfig;
