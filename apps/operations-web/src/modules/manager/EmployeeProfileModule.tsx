"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { staffName } from "./AddEmployeeWizard";
import { PageContent } from "@/components/shell/PageContent";
import { PageHeader } from "@/components/shell/PageHeader";
import { Panel } from "@/components/ui/Panel";

const PROFILE_TABS = [
  { id: "summary", label: "Summary" },
  { id: "employment", label: "Employment" },
  { id: "attendance", label: "Attendance" },
  { id: "shifts", label: "Shifts" },
  { id: "leave", label: "Leave" },
  { id: "payroll", label: "Payroll" },
  { id: "documents", label: "Documents" },
  { id: "training", label: "Training & Health" },
  { id: "assets", label: "Assets" },
  { id: "disciplinary", label: "Disciplinary" },
  { id: "timeline", label: "Timeline" },
  { id: "access", label: "Access" },
] as const;

interface EmployeeProfile {
  id: string;
  employeeCode: string;
  legalName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  phone?: string | null;
  email?: string | null;
  employmentCategory?: string;
  joinDate?: string;
  hasLoginAccess?: boolean;
  isActive?: boolean;
  wageType?: string;
  monthlySalary?: number | string | null;
  hourlyRate?: number | string | null;
  department?: { name: string } | null;
  designation?: { name: string } | null;
  outlet?: { name: string; city?: string | null; state?: string | null } | null;
  user?: { email: string; roleAssignments?: Array<{ role: string }> } | null;
  timelineEvents?: Array<{ id: string; eventType: string; title: string; description?: string | null; occurredAt: string }>;
}

export function EmployeeProfileModule({ employeeId }: { employeeId: string }) {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [tab, setTab] = useState<(typeof PROFILE_TABS)[number]["id"]>("summary");

  useEffect(() => {
    api<EmployeeProfile>(`/staff/profiles/${employeeId}`).then(setProfile).catch(() => setProfile(null));
  }, [employeeId]);

  if (!profile) {
    return <PageContent><p className="text-gray-400">Loading employee profile...</p></PageContent>;
  }

  const name = staffName(profile as never);

  return (
    <PageContent className="space-y-6">
      <PageHeader
        title={name}
        description={`${profile.employeeCode} · ${profile.designation?.name ?? "—"} · ${profile.outlet?.name ?? "—"}`}
        action={
          <Link href="/staff" className="border border-gray-200 px-4 py-2 rounded-xl text-sm">Back to team</Link>
        }
      />

      <div className="flex gap-2 flex-wrap">
        {PROFILE_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              tab === t.id ? "bg-sidebar text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "summary" && (
        <div className="grid md:grid-cols-2 gap-4">
          <Panel title="Identity">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Legal name</dt><dd>{profile.legalName ?? name}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Mobile</dt><dd>{profile.phone ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Email</dt><dd>{profile.email ?? profile.user?.email ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Login access</dt><dd>{profile.hasLoginAccess ? "Yes" : "No"}</dd></div>
            </dl>
          </Panel>
          <Panel title="Employment">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Category</dt><dd className="capitalize">{(profile.employmentCategory ?? "permanent").replace(/_/g, " ")}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Joined</dt><dd>{profile.joinDate ? new Date(profile.joinDate).toLocaleDateString() : "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Department</dt><dd>{profile.department?.name ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Status</dt><dd>{profile.isActive ? "Active" : "Inactive"}</dd></div>
            </dl>
          </Panel>
        </div>
      )}

      {tab === "timeline" && (
        <Panel title="Timeline">
          {(profile.timelineEvents ?? []).length === 0 ? (
            <p className="text-sm text-gray-500">No timeline events yet.</p>
          ) : (
            <ul className="space-y-3">
              {profile.timelineEvents!.map((ev) => (
                <li key={ev.id} className="border-l-2 border-kaana/30 pl-3">
                  <p className="font-medium text-sm">{ev.title}</p>
                  {ev.description && <p className="text-sm text-gray-600">{ev.description}</p>}
                  <p className="text-xs text-gray-400 mt-1">{new Date(ev.occurredAt).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {tab !== "summary" && tab !== "timeline" && (
        <Panel title={PROFILE_TABS.find((t) => t.id === tab)?.label ?? tab}>
          <p className="text-sm text-gray-600">
            {tab} details will be built in upcoming phases. Employment history is never deleted when login access is removed.
          </p>
        </Panel>
      )}
    </PageContent>
  );
}
