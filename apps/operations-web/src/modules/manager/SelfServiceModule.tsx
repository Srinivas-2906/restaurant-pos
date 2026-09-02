"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageContent } from "@/components/shell/PageContent";
import { PageHeader } from "@/components/shell/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { MetricCard } from "@/components/ui/MetricCard";

interface SelfServiceProfile {
  id: string;
  employeeCode?: string;
  displayName?: string | null;
  legalName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  wageType?: string;
  monthlySalary?: number | string | null;
  department?: { name: string } | null;
  designation?: { name: string } | null;
  outlet?: { name: string; city?: string | null } | null;
  leaveBalances?: Array<{ leaveType: string; balance: number | string; used?: number | string }>;
  documents?: Array<{ id: string; documentType: string; expiryDate?: string | null; verificationStatus: string }>;
}

export function SelfServiceModule() {
  const [profile, setProfile] = useState<SelfServiceProfile | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<SelfServiceProfile>("/hr/self-service/me")
      .then(setProfile)
      .catch((err) => {
        setProfile(null);
        setError(err instanceof Error ? err.message : "Unable to load profile");
      });
  }, []);

  const name =
    profile?.displayName ||
    profile?.legalName ||
    `${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim() ||
    "Employee";

  return (
    <PageContent>
      <PageHeader title="My HR" description="Your profile, leave balances and documents." />

      {error && !profile && (
        <Panel>
          <EmptyState title="Profile unavailable" description={error} />
        </Panel>
      )}

      {profile && (
        <>
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <MetricCard label="Employee" value={name} />
            <MetricCard label="Department" value={profile.department?.name ?? "—"} />
            <MetricCard label="Outlet" value={profile.outlet?.name ?? "—"} />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Panel title="Profile">
              <dl className="text-sm space-y-2">
                {profile.employeeCode && (
                  <div className="flex justify-between"><dt className="text-gray-500">Code</dt><dd>{profile.employeeCode}</dd></div>
                )}
                {profile.designation?.name && (
                  <div className="flex justify-between"><dt className="text-gray-500">Designation</dt><dd>{profile.designation.name}</dd></div>
                )}
                {profile.phone && (
                  <div className="flex justify-between"><dt className="text-gray-500">Phone</dt><dd>{profile.phone}</dd></div>
                )}
                {profile.wageType && (
                  <div className="flex justify-between"><dt className="text-gray-500">Wage type</dt><dd className="capitalize">{profile.wageType}</dd></div>
                )}
                {profile.outlet?.city && (
                  <div className="flex justify-between"><dt className="text-gray-500">Location</dt><dd>{profile.outlet.city}</dd></div>
                )}
              </dl>
            </Panel>

            <Panel title="Leave balances">
              {(profile.leaveBalances?.length ?? 0) === 0 ? (
                <EmptyState title="No leave balances" />
              ) : (
                <ul className="divide-y divide-gray-100 text-sm">
                  {profile.leaveBalances?.map((b, i) => (
                    <li key={i} className="py-2 flex justify-between">
                      <span className="capitalize">{b.leaveType}</span>
                      <span>{Number(b.balance).toFixed(1)} days</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Documents" className="lg:col-span-2">
              {(profile.documents?.length ?? 0) === 0 ? (
                <EmptyState title="No documents on file" />
              ) : (
                <div className="overflow-x-auto -mx-5 -mb-5">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-3">Type</th>
                        <th className="text-left p-3">Expiry</th>
                        <th className="text-left p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.documents?.map((d) => (
                        <tr key={d.id} className="border-t border-gray-100">
                          <td className="p-3">{d.documentType}</td>
                          <td className="p-3">{d.expiryDate ? new Date(d.expiryDate).toLocaleDateString() : "—"}</td>
                          <td className="p-3 capitalize">{d.verificationStatus}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </PageContent>
  );
}
