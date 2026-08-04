import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";

export default function MenuPage() {
  return (
    <PageContent>
      <PageHeader title="Menu" description="Manage menu categories and items." />
      <Panel>
        <EmptyState title="Coming soon" description="Menu management will be available here. Use API or POS to edit items for now." />
      </Panel>
    </PageContent>
  );
}
