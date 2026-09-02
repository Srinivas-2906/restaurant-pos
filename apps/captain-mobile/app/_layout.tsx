import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ToastProvider } from "../lib/toast";

export default function RootLayout() {
  return (
    <ToastProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerStyle: { backgroundColor: "#ea580c" }, headerTintColor: "#fff" }}>
        <Stack.Screen name="index" options={{ title: "Kaana Kitchens Captain" }} />
        <Stack.Screen name="tables" options={{ title: "Tables" }} />
        <Stack.Screen name="serve" options={{ title: "Serve Table" }} />
        <Stack.Screen name="order" options={{ title: "Take Order" }} />
      </Stack>
    </ToastProvider>
  );
}
