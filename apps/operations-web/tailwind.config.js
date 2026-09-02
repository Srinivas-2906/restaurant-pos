module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
    "../../packages/role-shells/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        kaana: { DEFAULT: "#ea580c", dark: "#c2410c", light: "#fed7aa" },
        sidebar: { DEFAULT: "#1e4038", hover: "#2a5248", active: "#3d6b5e" },
        surface: { DEFAULT: "#f4f6f5", card: "#ffffff" },
      },
      width: { sidebar: "260px" },
      spacing: { sidebar: "260px" },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
        panel: "0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
