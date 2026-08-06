import { PayrollRunDetailModule } from "@/modules/finance/PayrollModules";

export default async function PayrollRunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  return <PayrollRunDetailModule runId={runId} />;
}
