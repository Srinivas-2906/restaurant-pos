"use client";

import { useRouter } from "next/navigation";
import { StaffLoginForm } from "@kaana/ui";
import {
  APP_URLS,
  getAppEntryForRole,
  HQ_ADMIN_URL,
  resolvePrimaryRole,
} from "@kaana/role-shells";
import { ensureOutletSelected, login, setSelectedOutletId } from "@/lib/api";

const ALLOWED_ROLES = new Set(["owner", "manager", "accountant"]);

function getOutletIdFromUser(user: { roles?: Array<{ outletId?: string | null }> }) {
  return user.roles?.find((r) => r.outletId)?.outletId ?? user.roles?.[0]?.outletId ?? null;
}

function wrongAppMessage(role: string): string {
  switch (role) {
    case "biller":
    case "inventory_manager":
      return `Counter staff should sign in at the POS app (${APP_URLS.biller}).`;
    case "chef":
      return `Kitchen staff should sign in at the KDS app (${APP_URLS.chef}).`;
    case "captain":
      return `Floor staff should sign in at the Captain app (${APP_URLS.captain}).`;
    default:
      return "This account is not enabled for the owner console.";
  }
}

export default function LoginPage() {
  const router = useRouter();

  async function handleSubmit(email: string, password: string) {
    const data = await login(email, password);
    const role = resolvePrimaryRole(data.user);

    if (role === "super_admin") {
      window.location.href = `${HQ_ADMIN_URL}${getAppEntryForRole(role)}`;
      return;
    }

    if (!ALLOWED_ROLES.has(role)) {
      throw new Error(wrongAppMessage(role));
    }

    const outletId = getOutletIdFromUser(data.user);
    if (outletId) setSelectedOutletId(outletId);
    else await ensureOutletSelected();

    router.push(getAppEntryForRole(role));
  }

  return (
    <StaffLoginForm
      appName="Kaana Kitchens Operations"
      badge="Owner console"
      tagline="Payroll, staff, reports, and back office"
      hint="Owners and managers sign in here. Counter, kitchen, and floor staff use their own apps."
      defaultEmail="owner@kaanafoods.in"
      accent="slate"
      onSubmit={handleSubmit}
    />
  );
}
