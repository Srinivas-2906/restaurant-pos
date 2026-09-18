import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { moduleLabelForDeviceType } from "@/src/session/bootstrap";
import { useSession } from "@/src/session/SessionProvider";
import type { TerminalDeviceType } from "@/src/session/types";

type Props = {
  deviceType: TerminalDeviceType;
  backgroundColor?: string;
  textColor?: string;
  children?: React.ReactNode;
};

export function OperationalShellFrame({
  deviceType,
  backgroundColor = "#fff",
  textColor = "#111827",
  children,
}: Props) {
  const router = useRouter();
  const { terminal, employee, logoutEmployee, moduleUnavailable } = useSession();

  if (!terminal || !employee) {
    router.replace("/operational/login");
    return null;
  }

  if (employee.terminalId !== terminal.terminalId) {
    logoutEmployee();
    router.replace("/operational/login");
    return null;
  }

  const label = moduleLabelForDeviceType(deviceType);

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.eyebrow, { color: textColor }]}>{label}</Text>
          <Text style={[styles.title, { color: textColor }]}>{terminal.outletName || terminal.deviceName}</Text>
          <Text style={[styles.subtitle, { color: textColor }]}>
            Logged in as {employee.staff.displayName} ({employee.staff.employeeCode})
          </Text>
        </View>
        <Pressable
          style={styles.switch}
          onPress={() => {
            logoutEmployee();
            router.replace("/operational/login");
          }}
        >
          <Text style={styles.switchText}>Switch Employee</Text>
        </Pressable>
      </View>

      {moduleUnavailable ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{moduleUnavailable}</Text>
        </View>
      ) : null}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 56, paddingHorizontal: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 16 },
  eyebrow: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", opacity: 0.8 },
  title: { fontSize: 22, fontWeight: "700", marginTop: 2 },
  subtitle: { fontSize: 14, marginTop: 4, opacity: 0.85 },
  switch: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.06)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  switchText: { fontSize: 13, fontWeight: "600", color: "#9a3412" },
  banner: {
    backgroundColor: "#fffbeb",
    borderColor: "#fcd34d",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  bannerText: { color: "#92400e" },
});
