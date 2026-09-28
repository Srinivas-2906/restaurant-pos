"use client";

import { useRouter } from "next/navigation";
import { StaffLoginForm } from "@kaana/ui";
import { getAppEntryForRole, redirectUrlForRole, resolvePrimaryRole } from "@kaana/role-shells";
import { login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();

  async function handleSubmit(email: string, password: string) {
    const data = await login(email, password);
    const role = resolvePrimaryRole(data.user);
    if (role !== "super_admin") {
      window.location.href = redirectUrlForRole(role);
      return;
    }
    router.push(getAppEntryForRole(role));
  }

  return (
    <StaffLoginForm
      appName="Kaana Kitchens Platform Admin"
      badge="Internal"
      tagline="Platform administration for Kaana staff"
      hint="Restaurant owners and staff should use the Operations app."
      defaultEmail="admin@kaanafoods.in"
      accent="slate"
      onSubmit={handleSubmit}
    />
  );
}
