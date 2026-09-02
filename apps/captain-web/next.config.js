const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@kaana/ui", "@kaana/role-shells"],
  eslint: { ignoreDuringBuilds: true },
};
module.exports = nextConfig;
