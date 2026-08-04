import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";

export default function CustomersPage() {
  return (
    <PageContent>
      <PageHeader title="Customers" description="CRM and loyalty management." />
      <Panel>
        <EmptyState title="Coming soon" description="Customer profiles and loyalty programs will be available here." />
      </Panel>
    </PageContent>
  );
}
