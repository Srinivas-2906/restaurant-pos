const path = require("path");

/** Tailwind content globs for Kaana web apps (local src + shared packages). */
function kaanaContent(appDir) {
  const root = path.join(appDir, "../..");
  return [
    path.join(appDir, "src/**/*.{js,ts,jsx,tsx}"),
    path.join(root, "packages/ui/src/**/*.{js,ts,jsx,tsx}"),
    path.join(root, "packages/role-shells/src/**/*.{js,ts,jsx,tsx}"),
  ];
}

module.exports = { kaanaContent };
