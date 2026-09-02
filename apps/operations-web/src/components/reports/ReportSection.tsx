"use client";

import { Download } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { downloadCsv } from "@/lib/reportExport";

export interface ReportColumn {
  key: string;
  label: string;
  align?: "left" | "right";
  render?: (row: Record<string, unknown>) => React.ReactNode;
}

interface ReportSectionProps {
  id?: string;
  title: string;
  subtitle?: string;
  filename: string;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  summary?: React.ReactNode;
}

function defaultRender(value: unknown) {
  if (value == null || value === "") return "—";
  return String(value);
}

export function ReportSection({
  id,
  title,
  subtitle,
  filename,
  columns,
  rows,
  loading,
  emptyTitle = "No data",
  emptyDescription,
  summary,
}: ReportSectionProps) {
  function handleDownload() {
    downloadCsv(
      filename,
      columns.map((c) => c.label),
      rows.map((row) => columns.map((c) => row[c.key] ?? "")),
    );
  }

  return (
    <Panel
      id={id}
      title={title}
      subtitle={subtitle}
      action={
        rows.length > 0 ? (
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-kaana hover:underline"
          >
            <Download className="w-4 h-4" />
            Download CSV
          </button>
        ) : undefined
      }
    >
      {summary && <div className="mb-4">{summary}</div>}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <>
          <div className="overflow-x-auto -mx-1 table-scroll">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={`py-2 px-2 font-medium ${col.align === "right" ? "text-right" : "text-left"}`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row, i) => (
                  <tr key={String(row.id ?? row.key ?? i)} className="hover:bg-gray-50/80">
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`py-2.5 px-2 ${col.align === "right" ? "text-right tabular-nums" : "text-left"}`}
                      >
                        {col.render ? col.render(row) : defaultRender(row[col.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-3">{rows.length} row{rows.length === 1 ? "" : "s"}</p>
        </>
      )}
    </Panel>
  );
}

export function ReportDownloadButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 bg-kaana hover:bg-kaana-dark disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium"
    >
      <Download className="w-4 h-4" />
      {label}
    </button>
  );
}
