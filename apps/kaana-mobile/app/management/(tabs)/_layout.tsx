import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useManagement } from "@/src/management/ManagementProvider";

function TabLabel({ label }: { label: string }) {
  return <Text style={{ fontSize: 11, fontWeight: "600" }}>{label}</Text>;
}

export default function ManagementTabsLayout() {
  const { access } = useManagement();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#9a3412",
        tabBarInactiveTintColor: "#6b7280",
        tabBarStyle: { paddingBottom: 4, height: 58 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarLabel: ({ color }) => <Text style={{ color, fontSize: 11 }}>Home</Text> }} />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          href: access.hasModule("pos") ? undefined : null,
          tabBarLabel: ({ color }) => <Text style={{ color, fontSize: 11 }}>Orders</Text>,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: "Inventory",
          href: access.canManageInventory ? undefined : null,
          tabBarLabel: ({ color }) => <Text style={{ color, fontSize: 11 }}>Inventory</Text>,
        }}
      />
      <Tabs.Screen
        name="money"
        options={{
          title: "Money",
          href: access.canViewFinanceSummary ? undefined : null,
          tabBarLabel: ({ color }) => <Text style={{ color, fontSize: 11 }}>Money</Text>,
        }}
      />
      <Tabs.Screen name="more" options={{ title: "More", tabBarLabel: ({ color }) => <Text style={{ color, fontSize: 11 }}>More</Text> }} />
    </Tabs>
  );
}
