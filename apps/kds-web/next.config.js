const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@kaana/ui", "@kaana/role-shells"],
  eslint: { ignoreDuringBuilds: true },
  async redirects() {
    return [
      { source: "/station", destination: "/board", permanent: false },
      { source: "/aggregate", destination: "/board", permanent: false },
      { source: "/eighty-six", destination: "/board", permanent: false },
    ];
  },
};
module.exports = nextConfig;
