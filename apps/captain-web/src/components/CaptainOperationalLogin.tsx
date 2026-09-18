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
import { CaptainTerminalSetup } from "./CaptainTerminalSetup";

type FlowStep = "loading" | "setup" | "picker" | "pin" | "manager-email";

export function CaptainOperationalLogin() {
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
        if (hasSessionAppAccess(perms, roles, APP_ACCESS.access_captain)) {
          goToFloor();
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

    const perms = getPermissionsFromSession();
    const roles = getRolesFromSession();
    if (!hasSessionAppAccess(perms, roles, APP_ACCESS.access_captain)) {
      throw new Error(`This account is not enabled for Captain (${APP_URLS.captain}).`);
    }

    const outletId =
      data.user.roles?.find((r) => r.outletId)?.outletId ?? data.user.roles?.[0]?.outletId ?? null;
    if (outletId) setSelectedOutletId(outletId);

    goToFloor();
  }

  if (step === "loading") {
    return (
      <PosLoginShell appLabel="Captain · Floor">
        <p className="text-white/60 text-sm">Loading captain…</p>
      </PosLoginShell>
    );
  }

  return (
    <PosLoginShell appLabel="Captain · Floor" terminalName={terminalName || undefined}>
      {step === "setup" && (
        <CaptainTerminalSetup
          onRegistered={() => {
            loadPicker().catch(() => setStep("setup"));
          }}
        />
      )}

      {step === "picker" && (
        <OperationalStaffPicker
          accent="teal"
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
          accent="teal"
          submitLabel="Unlock Captain"
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
            appName="Kaana Kitchens Captain"
            badge="Manager"
            tagline="Email sign-in for managers covering the floor"
            hint={`Back office uses Operations (${APP_URLS.owner}).`}
            defaultEmail="manager@kaanafoods.in"
            accent="teal"
            onSubmit={handleManagerEmail}
          />
          <button
            type="button"
            onClick={() => setStep("picker")}
            className="mt-4 w-full text-sm text-white/50 hover:text-teal-400 transition-colors"
          >
            ← Back to staff picker
          </button>
        </div>
      )}
    </PosLoginShell>
  );
}
