export function escapeCsvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ];
  return lines.join("\n");
}

export function downloadTextFile(filename: string, content: string, mime = "text/csv;charset=utf-8;") {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  downloadTextFile(filename.endsWith(".csv") ? filename : `${filename}.csv`, buildCsv(headers, rows));
}

export function downloadJson(filename: string, data: unknown) {
  downloadTextFile(
    filename.endsWith(".json") ? filename : `${filename}.json`,
    JSON.stringify(data, null, 2),
    "application/json;charset=utf-8;",
  );
}

export interface CsvSection {
  title: string;
  headers: string[];
  rows: unknown[][];
}

export function downloadCombinedCsv(filename: string, sections: CsvSection[]) {
  const parts = sections.flatMap((section) => {
    if (section.rows.length === 0) return [];
    return [
      `# ${section.title}`,
      buildCsv(section.headers, section.rows),
      "",
    ];
  });
  downloadTextFile(filename.endsWith(".csv") ? filename : `${filename}.csv`, parts.join("\n"));
}

export function formatReportDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
