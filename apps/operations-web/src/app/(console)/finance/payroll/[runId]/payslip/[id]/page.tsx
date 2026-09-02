import { redirect } from "next/navigation";

export default async function LegacyPayslipRedirect({
  params,
}: {
  params: Promise<{ runId: string; id: string }>;
}) {
  const { runId, id } = await params;
  redirect(`/payroll/runs/${runId}/payslip/${id}`);
}
