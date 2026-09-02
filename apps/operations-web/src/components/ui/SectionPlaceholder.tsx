"use client";

import { PageContent } from "@/components/shell/PageContent";
import { PageHeader } from "@/components/shell/PageHeader";
import { Panel } from "@/components/ui/Panel";

interface SectionPlaceholderProps {
  title: string;
  description: string;
  phase?: string;
  features?: string[];
}

export function SectionPlaceholder({ title, description, phase, features }: SectionPlaceholderProps) {
  return (
    <PageContent>
      <PageHeader title={title} description={description} />
      <Panel>
        {phase && (
          <p className="text-xs font-medium uppercase tracking-wide text-kaana mb-3">{phase}</p>
        )}
        <p className="text-sm text-gray-600">
          This section is wired into navigation and will be built out as part of the staff, payroll and compliance rollout.
        </p>
        {features && features.length > 0 && (
          <ul className="mt-4 space-y-2 text-sm text-gray-700 list-disc list-inside">
            {features.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        )}
      </Panel>
    </PageContent>
  );
}
