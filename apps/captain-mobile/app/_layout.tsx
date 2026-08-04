import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerStyle: { backgroundColor: "#ea580c" }, headerTintColor: "#fff" }}>
        <Stack.Screen name="index" options={{ title: "Kaana Captain" }} />
        <Stack.Screen name="tables" options={{ title: "Tables" }} />
        <Stack.Screen name="order" options={{ title: "Take Order" }} />
      </Stack>
    </>
  );
}
