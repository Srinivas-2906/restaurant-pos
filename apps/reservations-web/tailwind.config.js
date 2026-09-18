const { kaanaContent } = require("../../packages/ui/tailwind.content");

module.exports = {
  content: kaanaContent(__dirname),
  presets: [require("../../packages/ui/tailwind.preset")],
  theme: {
    extend: {
      colors: {
        kaana: { DEFAULT: "#7c3aed", dark: "#6d28d9", light: "#ede9fe" },
      },
    },
  },
  plugins: [],
};
