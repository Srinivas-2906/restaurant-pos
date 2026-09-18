import { Stack } from "expo-router";
import { PosProvider } from "@/src/pos/PosProvider";
import { OfflinePosProvider } from "@/src/offline/OfflinePosProvider";

export default function PosLayout() {
  return (
    <PosProvider>
      <OfflinePosProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="tables" />
          <Stack.Screen name="order" />
          <Stack.Screen name="open-orders" />
          <Stack.Screen name="payment" />
          <Stack.Screen name="receipt" />
          <Stack.Screen name="sync-status" />
        </Stack>
      </OfflinePosProvider>
    </PosProvider>
  );
}