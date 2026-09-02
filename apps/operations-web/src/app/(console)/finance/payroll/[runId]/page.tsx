import { redirect } from "next/navigation";

export default async function LegacyPayrollRunRedirect({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  redirect(`/payroll/runs/${runId}`);
}
