/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@kaana/ui", "@kaana/role-shells"],
  eslint: { ignoreDuringBuilds: true },
};
module.exports = nextConfig;
