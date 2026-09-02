"use client";

import { useState } from "react";
import { api, getOutletId } from "@/lib/api";

export const EMPLOYMENT_CATEGORIES = [
  { value: "permanent", label: "Permanent" },
  { value: "fixed_term", label: "Fixed-term" },
  { value: "probationer", label: "Probationer" },
  { value: "part_time", label: "Part-time" },
  { value: "daily_wage", label: "Daily wage" },
  { value: "hourly_wage", label: "Hourly wage" },
  { value: "seasonal", label: "Seasonal" },
  { value: "trainee", label: "Trainee" },
  { value: "apprentice", label: "Apprentice" },
  { value: "consultant", label: "Consultant" },
  { value: "contract_labor", label: "Contract-labour employee" },
  { value: "inter_state_migrant", label: "Inter-state migrant worker" },
  { value: "temporary_replacement", label: "Temporary replacement" },
] as const;

export const WIZARD_STEPS = [
  { id: "identity", label: "Basic identity" },
  { id: "employment", label: "Employment" },
  { id: "statutory", label: "Statutory" },
  { id: "bank", label: "Bank & payment" },
  { id: "salary", label: "Salary" },
  { id: "foodsafety", label: "Food-safety" },
  { id: "documents", label: "Documents" },
  { id: "access", label: "Access" },
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];

export interface EmployeeWizardForm {
  legalName: string;
  displayName: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup: string;
  maritalStatus: string;
  currentAddress: string;
  permanentAddress: string;
  sameAsCurrentAddress: boolean;
  emergencyContactName: string;
  emergencyContactRelation: string;
  emergencyContactPhone: string;
  employeeCode: string;
  employmentCategory: string;
  departmentId: string;
  designationId: string;
  joinDate: string;
  probationEndDate: string;
  contractEndDate: string;
  pan: string;
  aadhaarLast4: string;
  uan: string;
  pfAccount: string;
  esicNumber: string;
  bankName: string;
  bankAccount: string;
  ifsc: string;
  bankAccountType: string;
  salaryPaymentMode: string;
  wageType: string;
  monthlySalary: string;
  hourlyRate: string;
  isFoodHandler: boolean;
  medicalExamDate: string;
  fostacStatus: string;
  hasLoginAccess: boolean;
  accessRole: string;
}

export const emptyWizardForm: EmployeeWizardForm = {
  legalName: "",
  displayName: "",
  phone: "",
  email: "",
  dateOfBirth: "",
  gender: "",
  bloodGroup: "",
  maritalStatus: "",
  currentAddress: "",
  permanentAddress: "",
  sameAsCurrentAddress: true,
  emergencyContactName: "",
  emergencyContactRelation: "",
  emergencyContactPhone: "",
  employeeCode: "",
  employmentCategory: "permanent",
  departmentId: "",
  designationId: "",
  joinDate: new Date().toISOString().slice(0, 10),
  probationEndDate: "",
  contractEndDate: "",
  pan: "",
  aadhaarLast4: "",
  uan: "",
  pfAccount: "",
  esicNumber: "",
  bankName: "",
  bankAccount: "",
  ifsc: "",
  bankAccountType: "savings",
  salaryPaymentMode: "bank_transfer",
  wageType: "monthly",
  monthlySalary: "",
  hourlyRate: "",
  isFoodHandler: false,
  medicalExamDate: "",
  fostacStatus: "",
  hasLoginAccess: false,
  accessRole: "",
};

const inputClass = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm";

interface AddEmployeeWizardProps {
  employeeCodeSuggestion: string;
  onComplete: () => void;
  onCancel: () => void;
}

export function AddEmployeeWizard({ employeeCodeSuggestion, onComplete, onCancel }: AddEmployeeWizardProps) {
  const outletId = getOutletId();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ ...emptyWizardForm, employeeCode: employeeCodeSuggestion });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function update<K extends keyof EmployeeWizardForm>(key: K, value: EmployeeWizardForm[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "sameAsCurrentAddress" && value === true) {
        next.permanentAddress = next.currentAddress;
      }
      if (key === "currentAddress" && prev.sameAsCurrentAddress) {
        next.permanentAddress = String(value);
      }
      return next;
    });
  }

  function validateStep(index: number): string | null {
    if (index === 0) {
      if (!form.legalName.trim()) return "Legal name is required";
      if (!form.phone.trim()) return "Mobile number is required";
      if (!form.dateOfBirth) return "Date of birth is required";
      if (!form.gender) return "Gender is required";
      if (!form.currentAddress.trim()) return "Current address is required";
      if (!form.permanentAddress.trim()) return "Permanent address is required";
      if (!form.emergencyContactName.trim()) return "Emergency contact name is required";
      if (!form.emergencyContactRelation.trim()) return "Emergency contact relationship is required";
    }
    if (index === 1) {
      if (!form.employeeCode.trim()) return "Employee code is required";
      if (!form.joinDate) return "Joining date is required";
    }
    return null;
  }

  function nextStep() {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError("");
    setStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1));
  }

  async function submit() {
    for (let i = 0; i <= 1; i++) {
      const err = validateStep(i);
      if (err) {
        setError(err);
        setStep(i);
        return;
      }
    }
    if (!outletId) {
      setError("Select an outlet first");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const created = await api<{ id: string }>("/staff/employees", {
        method: "POST",
        body: JSON.stringify({
          outletId,
          legalName: form.legalName.trim(),
          displayName: form.displayName.trim() || undefined,
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          dateOfBirth: form.dateOfBirth,
          gender: form.gender,
          bloodGroup: form.bloodGroup || undefined,
          maritalStatus: form.maritalStatus || undefined,
          currentAddress: form.currentAddress.trim(),
          permanentAddress: form.permanentAddress.trim(),
          emergencyContactName: form.emergencyContactName.trim(),
          emergencyContactRelation: form.emergencyContactRelation.trim(),
          emergencyContactPhone: form.emergencyContactPhone.trim() || form.phone.trim(),
          employeeCode: form.employeeCode.trim(),
          employmentCategory: form.employmentCategory,
          departmentId: form.departmentId || undefined,
          designationId: form.designationId || undefined,
          joinDate: form.joinDate,
          probationEndDate: form.probationEndDate || undefined,
          contractEndDate: form.contractEndDate || undefined,
          pan: form.pan || undefined,
          aadhaarLast4: form.aadhaarLast4 || undefined,
          uan: form.uan || undefined,
          pfAccount: form.pfAccount || undefined,
          esicNumber: form.esicNumber || undefined,
          bankName: form.bankName || undefined,
          bankAccount: form.bankAccount || undefined,
          ifsc: form.ifsc || undefined,
          bankAccountType: form.bankAccountType || undefined,
          salaryPaymentMode: form.salaryPaymentMode || undefined,
          wageType: form.wageType,
          monthlySalary: form.wageType === "monthly" && form.monthlySalary ? Number(form.monthlySalary) : undefined,
          hourlyRate: form.wageType === "hourly" && form.hourlyRate ? Number(form.hourlyRate) : undefined,
          hasLoginAccess: form.hasLoginAccess,
          isFoodHandler: form.isFoodHandler,
          medicalExamDate: form.medicalExamDate || undefined,
          fostacStatus: form.fostacStatus || undefined,
        }),
      });
      if (form.hasLoginAccess && form.accessRole) {
        await api(`/hr/employees/${created.id}/access`, {
          method: "POST",
          body: JSON.stringify({ accessRole: form.accessRole }),
        });
      }
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create employee");
    } finally {
      setSaving(false);
    }
  }

  const current = WIZARD_STEPS[step];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto pb-1">
        {WIZARD_STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => i <= step && setStep(i)}
            className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium ${
              i === step ? "bg-sidebar text-white" : i < step ? "bg-kaana/10 text-kaana" : "bg-gray-100 text-gray-500"
            }`}
          >
            {i + 1}. {s.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {current.id === "identity" && (
        <div className="space-y-3">
          <input required value={form.legalName} onChange={(e) => update("legalName", e.target.value)} placeholder="Full legal name *" className={inputClass} />
          <input value={form.displayName} onChange={(e) => update("displayName", e.target.value)} placeholder="Preferred / display name" className={inputClass} />
          <input required value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="Mobile number *" className={inputClass} />
          <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="Email (optional)" className={inputClass} />
          <input required type="date" value={form.dateOfBirth} onChange={(e) => update("dateOfBirth", e.target.value)} className={inputClass} />
          <select required value={form.gender} onChange={(e) => update("gender", e.target.value)} className={inputClass}>
            <option value="">Gender *</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
          <select value={form.bloodGroup} onChange={(e) => update("bloodGroup", e.target.value)} className={inputClass}>
            <option value="">Blood group (optional)</option>
            {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
              <option key={bg} value={bg}>{bg}</option>
            ))}
          </select>
          <select value={form.maritalStatus} onChange={(e) => update("maritalStatus", e.target.value)} className={inputClass}>
            <option value="">Marital status (optional)</option>
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="divorced">Divorced</option>
            <option value="widowed">Widowed</option>
          </select>
          <textarea required value={form.currentAddress} onChange={(e) => update("currentAddress", e.target.value)} placeholder="Current address *" rows={2} className={inputClass} />
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={form.sameAsCurrentAddress} onChange={(e) => update("sameAsCurrentAddress", e.target.checked)} />
            Permanent address same as current
          </label>
          {!form.sameAsCurrentAddress && (
            <textarea required value={form.permanentAddress} onChange={(e) => update("permanentAddress", e.target.value)} placeholder="Permanent address *" rows={2} className={inputClass} />
          )}
          <input required value={form.emergencyContactName} onChange={(e) => update("emergencyContactName", e.target.value)} placeholder="Emergency contact name *" className={inputClass} />
          <input required value={form.emergencyContactRelation} onChange={(e) => update("emergencyContactRelation", e.target.value)} placeholder="Relationship *" className={inputClass} />
          <input value={form.emergencyContactPhone} onChange={(e) => update("emergencyContactPhone", e.target.value)} placeholder="Emergency contact phone (defaults to employee mobile)" className={inputClass} />
        </div>
      )}

      {current.id === "employment" && (
        <div className="space-y-3">
          <input required value={form.employeeCode} onChange={(e) => update("employeeCode", e.target.value)} placeholder="Employee ID / code *" className={inputClass} />
          <select value={form.employmentCategory} onChange={(e) => update("employmentCategory", e.target.value)} className={inputClass}>
            {EMPLOYMENT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <input required type="date" value={form.joinDate} onChange={(e) => update("joinDate", e.target.value)} className={inputClass} />
          <input type="date" value={form.probationEndDate} onChange={(e) => update("probationEndDate", e.target.value)} className={inputClass} />
          <input type="date" value={form.contractEndDate} onChange={(e) => update("contractEndDate", e.target.value)} className={inputClass} />
          <p className="text-xs text-gray-500">Department, designation, reporting manager and outlet assignments can be configured after creation from the employee profile.</p>
        </div>
      )}

      {current.id === "statutory" && (
        <div className="space-y-3">
          <input value={form.pan} onChange={(e) => update("pan", e.target.value.toUpperCase())} placeholder="PAN" className={inputClass} />
          <input value={form.aadhaarLast4} onChange={(e) => update("aadhaarLast4", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="Aadhaar last 4 digits (full number stored encrypted later)" className={inputClass} />
          <input value={form.uan} onChange={(e) => update("uan", e.target.value)} placeholder="UAN (PF)" className={inputClass} />
          <input value={form.pfAccount} onChange={(e) => update("pfAccount", e.target.value)} placeholder="PF account number" className={inputClass} />
          <input value={form.esicNumber} onChange={(e) => update("esicNumber", e.target.value)} placeholder="ESIC insurance number" className={inputClass} />
          <p className="text-xs text-gray-500">PF/ESI eligibility will be calculated from employment category and wage record by the compliance engine.</p>
        </div>
      )}

      {current.id === "bank" && (
        <div className="space-y-3">
          <input value={form.bankName} onChange={(e) => update("bankName", e.target.value)} placeholder="Bank name" className={inputClass} />
          <input value={form.bankAccount} onChange={(e) => update("bankAccount", e.target.value)} placeholder="Account number" className={inputClass} />
          <input value={form.ifsc} onChange={(e) => update("ifsc", e.target.value.toUpperCase())} placeholder="IFSC" className={inputClass} />
          <select value={form.bankAccountType} onChange={(e) => update("bankAccountType", e.target.value)} className={inputClass}>
            <option value="savings">Savings</option>
            <option value="current">Current</option>
          </select>
          <select value={form.salaryPaymentMode} onChange={(e) => update("salaryPaymentMode", e.target.value)} className={inputClass}>
            <option value="bank_transfer">Bank transfer</option>
            <option value="cash">Cash</option>
            <option value="cheque">Cheque</option>
            <option value="upi">UPI</option>
            <option value="mixed">Mixed</option>
            <option value="hold">Hold payment</option>
          </select>
          <p className="text-xs text-gray-500">Bank detail changes before payroll require approval workflow (Phase 2).</p>
        </div>
      )}

      {current.id === "salary" && (
        <div className="space-y-3">
          <select value={form.wageType} onChange={(e) => update("wageType", e.target.value)} className={inputClass}>
            <option value="monthly">Monthly salary</option>
            <option value="hourly">Hourly wage</option>
          </select>
          {form.wageType === "monthly" ? (
            <input type="number" value={form.monthlySalary} onChange={(e) => update("monthlySalary", e.target.value)} placeholder="Gross monthly salary (₹)" className={inputClass} />
          ) : (
            <input type="number" value={form.hourlyRate} onChange={(e) => update("hourlyRate", e.target.value)} placeholder="Hourly rate (₹)" className={inputClass} />
          )}
          <p className="text-xs text-gray-500">Detailed CTC and component breakdown will use versioned salary structures (Phase 2).</p>
        </div>
      )}

      {current.id === "foodsafety" && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isFoodHandler} onChange={(e) => update("isFoodHandler", e.target.checked)} />
            Food handler
          </label>
          {form.isFoodHandler && (
            <>
              <input type="date" value={form.medicalExamDate} onChange={(e) => update("medicalExamDate", e.target.value)} className={inputClass} />
              <input value={form.fostacStatus} onChange={(e) => update("fostacStatus", e.target.value)} placeholder="FoSTaC training status" className={inputClass} />
            </>
          )}
          <p className="text-xs text-gray-500">Medical fitness, vaccination and FoSTaC certificate uploads are managed under Documents (Phase 4).</p>
        </div>
      )}

      {current.id === "documents" && (
        <p className="text-sm text-gray-600">
          Document uploads (identity, statutory, employment and restaurant-specific) can be added from the employee profile after creation. Categories include PAN, medical fitness, FoSTaC, and more — not a generic labour certificate.
        </p>
      )}

      {current.id === "access" && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.hasLoginAccess} onChange={(e) => update("hasLoginAccess", e.target.checked)} />
            Grant application login now (optional)
          </label>
          {form.hasLoginAccess && (
            <select value={form.accessRole} onChange={(e) => update("accessRole", e.target.value)} className={inputClass}>
              <option value="">Select access role...</option>
              <option value="employee_self_service">Employee self-service</option>
              <option value="captain">Captain app</option>
              <option value="chef">KDS</option>
              <option value="biller">POS cashier</option>
              <option value="manager">POS manager</option>
              <option value="inventory_manager">Inventory</option>
            </select>
          )}
          <p className="text-xs text-gray-500">
            Login is optional. Removing login access later will not delete employment or payroll history. Invitations can also be sent after the employee record is created.
          </p>
        </div>
      )}

      <div className="flex justify-between pt-2 border-t border-gray-100">
        <button type="button" onClick={step === 0 ? onCancel : () => setStep((s) => s - 1)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm">
          {step === 0 ? "Cancel" : "Back"}
        </button>
        {step < WIZARD_STEPS.length - 1 ? (
          <button type="button" onClick={nextStep} className="px-4 py-2 rounded-xl bg-kaana text-white text-sm font-medium">
            Continue
          </button>
        ) : (
          <button type="button" onClick={submit} disabled={saving} className="px-4 py-2 rounded-xl bg-kaana text-white text-sm font-medium disabled:opacity-50">
            {saving ? "Creating..." : "Create employee"}
          </button>
        )}
      </div>
    </div>
  );
}

function staffName(s: StaffRow): string {
  if (s.displayName?.trim()) return s.displayName.trim();
  if (s.legalName?.trim()) return s.legalName.trim();
  if (s.firstName?.trim()) return `${s.firstName} ${s.lastName ?? ""}`.trim();
  if (s.user) return `${s.user.firstName} ${s.user.lastName ?? ""}`.trim();
  return s.employeeCode;
}

interface StaffRow {
  id: string;
  employeeCode: string;
  displayName?: string | null;
  legalName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  employmentCategory?: string;
  hasLoginAccess?: boolean;
  wageType: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string;
    roleAssignments?: Array<{ role: string }>;
  } | null;
  department?: { name: string } | null;
  designation?: { name: string } | null;
}

export { staffName };
