import { Stack } from "expo-router";
import { ManagementProvider } from "@/src/management/ManagementProvider";

export default function ManagementLayout() {
  return (
    <ManagementProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="orders/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="inventory/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="sales" />
        <Stack.Screen name="reports" />
        <Stack.Screen name="staff/index" />
        <Stack.Screen name="devices" />
        <Stack.Screen name="purchases/index" />
        <Stack.Screen name="purchases/add" />
        <Stack.Screen name="expenses" />
        <Stack.Screen name="money/activity" />
        <Stack.Screen name="money/profit-loss" />
        <Stack.Screen name="money/balance-sheet" />
        <Stack.Screen name="money/supplier-dues" />
        <Stack.Screen name="money/owner" />
        <Stack.Screen name="billing" />
      </Stack>
    </ManagementProvider>
  );
}
