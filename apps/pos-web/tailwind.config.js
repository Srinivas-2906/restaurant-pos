const { kaanaContent } = require("../../packages/ui/tailwind.content");

module.exports = {
  content: kaanaContent(__dirname),
  presets: [require("../../packages/ui/tailwind.preset")],
  theme: { extend: {} },
  plugins: [],
};
