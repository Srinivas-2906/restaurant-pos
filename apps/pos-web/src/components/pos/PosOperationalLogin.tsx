"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KaanaBrand, StaffLoginForm } from "@kaana/ui";
import {
  APP_URLS,
  getAppEntryForRole,
  HQ_ADMIN_URL,
  resolvePrimaryRole,
  usesPosApp,
} from "@kaana/role-shells";
import {
  fetchEligibleStaff,
  fetchTerminalMe,
  getTerminalCredential,
  hasValidSession,
  isEmailSession,
  login,
  operationalPinLogin,
  setSelectedOutletId,
} from "@/lib/api";
import { PosTerminalSetup } from "./PosTerminalSetup";
import { PosStaffPicker, type EligibleStaffMember } from "./PosStaffPicker";
import { PosPinPad } from "./PosPinPad";

type FlowStep = "loading" | "setup" | "picker" | "pin" | "manager-email";

function wrongAppMessage(role: string): string {
  switch (role) {
    case "owner":
    case "manager":
    case "accountant":
      return `Back-office staff should sign in at Operations (${APP_URLS.owner}).`;
    case "chef":
      return `Kitchen staff should sign in at the KDS app (${APP_URLS.chef}).`;
    case "captain":
      return `Floor staff should sign in at the Captain app (${APP_URLS.captain}).`;
    default:
      return "This account is not enabled for POS.";
  }
}

export function PosOperationalLogin() {
  const router = useRouter();
  const [step, setStep] = useState<FlowStep>("loading");
  const [terminalName, setTerminalName] = useState("");
  const [staff, setStaff] = useState<EligibleStaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<EligibleStaffMember | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [submittingPin, setSubmittingPin] = useState(false);

  const goToFloor = useCallback(() => {
    router.replace("/floor");
  }, [router]);

  const loadPicker = useCallback(async () => {
    const [terminal, eligible] = await Promise.all([
      fetchTerminalMe(),
      fetchEligibleStaff(),
    ]);
    setTerminalName(terminal.name);
    setStaff(eligible);
    setStep("picker");
  }, []);

  useEffect(() => {
    async function bootstrap() {
      if (hasValidSession()) {
        goToFloor();
        return;
      }

      const credential = getTerminalCredential();
      if (!credential) {
        setStep("setup");
        return;
      }

      try {
        await loadPicker();
      } catch {
        setStep("setup");
      }
    }
    bootstrap();
  }, [goToFloor, loadPicker]);

  async function handlePinSubmit(pin: string) {
    if (!selectedStaff) return;
    setSubmittingPin(true);
    setPinError(null);
    try {
      await operationalPinLogin(selectedStaff.id, pin);
      goToFloor();
    } catch (err) {
      setPinError(err instanceof Error ? err.message : "PIN login failed");
    } finally {
      setSubmittingPin(false);
    }
  }

  async function handleManagerEmail(email: string, password: string) {
    const data = await login(email, password);
    const role = resolvePrimaryRole(data.user);

    if (role === "super_admin") {
      window.location.href = `${HQ_ADMIN_URL}${getAppEntryForRole(role)}`;
      return;
    }

    const canUsePos = usesPosApp(role) || role === "owner" || role === "manager";
    if (!canUsePos) {
      throw new Error(wrongAppMessage(role));
    }

    const outletId =
      data.user.roles?.find((r) => r.outletId)?.outletId ?? data.user.roles?.[0]?.outletId ?? null;
    if (outletId) setSelectedOutletId(outletId);

    goToFloor();
  }

  if (step === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-gray-300">
        Loading POS…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <header className="px-4 sm:px-6 py-4 flex items-center gap-3 border-b border-gray-800 min-w-0">
        <KaanaBrand size="sm" appLabel="POS · Counter" />
        <p className="text-xs text-gray-400 truncate ml-auto hidden sm:block">
          {terminalName ? `Terminal · ${terminalName}` : "Counter terminal"}
        </p>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        {step === "setup" && (
          <PosTerminalSetup
            onRegistered={() => {
              loadPicker().catch(() => setStep("setup"));
            }}
          />
        )}

        {step === "picker" && (
          <PosStaffPicker
            staff={staff}
            onSelect={(member) => {
              setSelectedStaff(member);
              setPinError(null);
              setStep("pin");
            }}
            onManagerSignIn={() => setStep("manager-email")}
          />
        )}

        {step === "pin" && selectedStaff && (
          <PosPinPad
            staffName={selectedStaff.displayName}
            error={pinError}
            submitting={submittingPin}
            onBack={() => {
              setSelectedStaff(null);
              setStep("picker");
            }}
            onSubmit={handlePinSubmit}
          />
        )}

        {step === "manager-email" && (
          <div className="w-full max-w-md">
            <StaffLoginForm
              appName="Kaana Kitchens POS"
              badge="Manager"
              tagline="Email sign-in for managers covering the counter"
              hint="Hub SSO and inventory managers use this path."
              defaultEmail="manager@kaanafoods.in"
              accent="orange"
              onSubmit={handleManagerEmail}
            />
            <button
              type="button"
              onClick={() => setStep("picker")}
              className="mt-4 w-full text-sm text-gray-400 hover:text-orange-400"
            >
              ← Back to staff picker
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
