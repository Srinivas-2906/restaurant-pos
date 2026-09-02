import { EmployeeProfileModule } from "@/modules/manager/EmployeeProfileModule";

export default async function EmployeeProfilePage({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params;
  return <EmployeeProfileModule employeeId={employeeId} />;
}
