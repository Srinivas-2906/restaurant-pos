import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { AppErrorBoundary, BootstrapError } from "@/src/components/AppErrorBoundary";
import { BootstrapRedirect } from "@/src/components/BootstrapRedirect";
import { SessionProvider, useSession } from "@/src/session/SessionProvider";

function RootNavigator() {
  const { bootstrapping, bootstrapError, retryBootstrap } = useSession();

  if (bootstrapping) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#9a3412" />
      </View>
    );
  }

  if (bootstrapError) {
    return <BootstrapError message={bootstrapError} onRetry={retryBootstrap} />;
  }

  return (
    <>
      <BootstrapRedirect />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="entry" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="activate/index" />
        <Stack.Screen name="operational/login" />
        <Stack.Screen name="management" />
        <Stack.Screen name="pos" />
        <Stack.Screen name="captain" />
        <Stack.Screen name="kds" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <SessionProvider>
        <RootNavigator />
      </SessionProvider>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff7ed" },
});
