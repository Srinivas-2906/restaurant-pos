import { redirect } from "next/navigation";

export default function LegacyPayrollRedirect() {
  redirect("/payroll/runs");
}
