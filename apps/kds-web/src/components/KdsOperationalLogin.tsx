"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  OperationalPinPad,
  OperationalStaffPicker,
  PosLoginShell,
  StaffLoginForm,
  type EligibleStaffMember,
} from "@kaana/ui";
import {
  APP_URLS,
  getAppEntryForRole,
  HQ_ADMIN_URL,
  resolvePrimaryRole,
} from "@kaana/role-shells";
import { APP_ACCESS, hasSessionAppAccess } from "@kaana/shared-types";
import {
  fetchEligibleStaff,
  fetchTerminalMe,
  getPermissionsFromSession,
  getRolesFromSession,
  getTerminalCredential,
  hasValidSession,
  login,
  operationalPinLogin,
  setSelectedOutletId,
} from "@/lib/api";
import { KdsTerminalSetup } from "./KdsTerminalSetup";

type FlowStep = "loading" | "setup" | "picker" | "pin" | "manager-email";

export function KdsOperationalLogin() {
  const router = useRouter();
  const [step, setStep] = useState<FlowStep>("loading");
  const [terminalName, setTerminalName] = useState("");
  const [staff, setStaff] = useState<EligibleStaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<EligibleStaffMember | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [submittingPin, setSubmittingPin] = useState(false);

  const goToBoard = useCallback(() => {
    router.replace("/board");
  }, [router]);

  const loadPicker = useCallback(async () => {
    const [terminal, eligible] = await Promise.all([fetchTerminalMe(), fetchEligibleStaff()]);
    setTerminalName(terminal.name);
    setStaff(eligible);
    setStep("picker");
  }, []);

  useEffect(() => {
    async function bootstrap() {
      if (hasValidSession()) {
        const perms = getPermissionsFromSession();
        const roles = getRolesFromSession();
        if (hasSessionAppAccess(perms, roles, APP_ACCESS.access_kds)) {
          goToBoard();
          return;
        }
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
  }, [goToBoard, loadPicker]);

  async function handlePinSubmit(pin: string) {
    if (!selectedStaff) return;
    setSubmittingPin(true);
    setPinError(null);
    try {
      await operationalPinLogin(selectedStaff.id, pin);
      goToBoard();
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

    const perms = getPermissionsFromSession();
    const roles = getRolesFromSession();
    if (!hasSessionAppAccess(perms, roles, APP_ACCESS.access_kds)) {
      throw new Error(`This account is not enabled for KDS (${APP_URLS.chef}).`);
    }

    const outletId =
      data.user.roles?.find((r) => r.outletId)?.outletId ?? data.user.roles?.[0]?.outletId ?? null;
    if (outletId) setSelectedOutletId(outletId);

    goToBoard();
  }

  if (step === "loading") {
    return (
      <PosLoginShell appLabel="KDS · Kitchen">
        <p className="text-white/60 text-sm">Loading kitchen…</p>
      </PosLoginShell>
    );
  }

  return (
    <PosLoginShell appLabel="KDS · Kitchen" terminalName={terminalName || undefined}>
      {step === "setup" && (
        <KdsTerminalSetup
          onRegistered={() => {
            loadPicker().catch(() => setStep("setup"));
          }}
        />
      )}

      {step === "picker" && (
        <OperationalStaffPicker
          accent="amber"
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
        <OperationalPinPad
          accent="amber"
          submitLabel="Unlock KDS"
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
            layout="card"
            appName="Kaana Kitchens KDS"
            badge="Manager"
            tagline="Email sign-in for managers covering the kitchen line"
            hint={`Back office uses Operations (${APP_URLS.owner}).`}
            defaultEmail="manager@kaanafoods.in"
            accent="amber"
            onSubmit={handleManagerEmail}
          />
          <button
            type="button"
            onClick={() => setStep("picker")}
            className="mt-4 w-full text-sm text-white/50 hover:text-amber-400 transition-colors"
          >
            ← Back to staff picker
          </button>
        </div>
      )}
    </PosLoginShell>
  );
}
