import { Stack } from "expo-router";
import { CaptainProvider } from "@/src/captain/CaptainProvider";

export default function CaptainLayout() {
  return (
    <CaptainProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="order" />
        <Stack.Screen name="ready" />
      </Stack>
    </CaptainProvider>
  );
}
