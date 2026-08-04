/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@kaana/ui", "@kaana/sync-engine", "@kaana/role-shells"],
  eslint: { ignoreDuringBuilds: true },
};
module.exports = nextConfig;
