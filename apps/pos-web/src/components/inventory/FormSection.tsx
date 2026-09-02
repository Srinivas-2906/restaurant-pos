"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface FormSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function FormSection({ title, defaultOpen = false, children }: FormSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 text-sm font-medium text-gray-800 hover:bg-gray-100"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {title}
      </button>
      {open && <div className="p-4 space-y-4 border-t border-gray-200">{children}</div>}
    </div>
  );
}

export function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {children}{required && " *"}
    </label>
  );
}

export const inputClass = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm";
export const selectClass = inputClass;
