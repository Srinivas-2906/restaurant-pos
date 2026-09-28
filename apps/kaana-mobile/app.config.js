const pkg = require("./package.json");

/** @type {import("@expo/config").ExpoConfig} */
module.exports = ({ config }) => ({
  ...config,
  name: "Kaana Mobile",
  slug: "kaana-mobile",
  version: pkg.version,
  orientation: "default",
  scheme: "kaana",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  plugins: ["expo-router", "expo-secure-store", "expo-dev-client"],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:4000/api",
    wsUrl: process.env.EXPO_PUBLIC_WS_URL,
  },
  android: {
    package: "in.kaanafoods.mobile",
  },
});
