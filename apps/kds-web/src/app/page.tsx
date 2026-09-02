"use client";

import { useRouter } from "next/navigation";
import { StaffLoginForm } from "@kaana/ui";
import {
  APP_URLS,
  HQ_ADMIN_URL,
  resolvePrimaryRole,
} from "@kaana/role-shells";
import { login, setSelectedOutletId } from "@/lib/api";

function getOutletIdFromUser(user: { roles?: Array<{ outletId?: string | null }> }) {
  return user.roles?.find((r) => r.outletId)?.outletId ?? user.roles?.[0]?.outletId ?? null;
}

function wrongAppMessage(role: string): string {
  switch (role) {
    case "biller":
    case "inventory_manager":
      return `Counter staff should sign in at the POS app (${APP_URLS.biller}).`;
    case "captain":
      return `Floor staff should sign in at the Captain app (${APP_URLS.captain}).`;
    case "owner":
    case "manager":
    case "accountant":
      return `Back-office staff should sign in at Operations (${APP_URLS.owner}).`;
    default:
      return "This account is not enabled for the kitchen display.";
  }
}

export default function KdsLoginPage() {
  const router = useRouter();

  async function handleSubmit(email: string, password: string) {
    const data = await login(email, password);
    const role = resolvePrimaryRole(data.user);

    if (role === "super_admin") {
      window.location.href = `${HQ_ADMIN_URL}/dashboard`;
      return;
    }

    if (role !== "chef") {
      throw new Error(wrongAppMessage(role));
    }

    const outletId = getOutletIdFromUser(data.user);
    if (outletId) {
      setSelectedOutletId(outletId);
      localStorage.setItem("kdsOutletId", outletId);
    }

    router.replace("/board");
  }

  return (
    <StaffLoginForm
      appName="Kaana Kitchens KDS"
      badge="Kitchen"
      tagline="Ticket board and bump bar for the line"
      hint="Chefs sign in here on the kitchen tablet or display."
      defaultEmail="chef@kaanafoods.in"
      accent="amber"
      onSubmit={handleSubmit}
    />
  );
}
