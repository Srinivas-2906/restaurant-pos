import { Stack } from "expo-router";
import { KdsProvider } from "@/src/kds/KdsProvider";

export default function KdsLayout() {
  return (
    <KdsProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
      </Stack>
    </KdsProvider>
  );
}
