import { PayslipModule } from "@/modules/finance/PayrollModules";

export default async function PayslipPage({
  params,
}: {
  params: Promise<{ runId: string; id: string }>;
}) {
  const { runId, id } = await params;
  return <PayslipModule runId={runId} payslipId={id} />;
}
