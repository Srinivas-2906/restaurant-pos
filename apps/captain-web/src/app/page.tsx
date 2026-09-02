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
    case "chef":
      return `Kitchen staff should sign in at the KDS app (${APP_URLS.chef}).`;
    case "owner":
    case "manager":
    case "accountant":
      return `Back-office staff should sign in at Operations (${APP_URLS.owner}).`;
    default:
      return "This account is not enabled for floor service.";
  }
}

export default function CaptainLoginPage() {
  const router = useRouter();

  async function handleSubmit(email: string, password: string) {
    const data = await login(email, password);
    const role = resolvePrimaryRole(data.user);

    if (role === "super_admin") {
      window.location.href = `${HQ_ADMIN_URL}/dashboard`;
      return;
    }

    if (role !== "captain") {
      throw new Error(wrongAppMessage(role));
    }

    const outletId = getOutletIdFromUser(data.user);
    if (outletId) {
      setSelectedOutletId(outletId);
      localStorage.setItem("captainOutletId", outletId);
    }

    router.replace("/floor");
  }

  return (
    <StaffLoginForm
      appName="Kaana Kitchens Captain"
      badge="Floor"
      tagline="Table service and ready-to-serve tickets"
      hint="Captains sign in here on the floor tablet."
      defaultEmail="captain@kaanafoods.in"
      accent="teal"
      onSubmit={handleSubmit}
    />
  );
}
