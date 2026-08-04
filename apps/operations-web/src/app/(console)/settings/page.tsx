import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";

export default function SettingsPage() {
  return (
    <PageContent>
      <PageHeader title="Settings" description="Outlet and organization configuration." />
      <Panel>
        <EmptyState title="Coming soon" description="Organization and outlet settings will be available here." />
      </Panel>
    </PageContent>
  );
}
