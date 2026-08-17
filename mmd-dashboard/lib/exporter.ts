// Export .mmd, tag list (CSV) and review report (Markdown).
// Port of mmd_generator/exporter.py -- returns strings for the browser to
// download rather than writing files to disk.

import type { GenerationResult, ReadinessGate } from "./models";

function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildTagListCsv(result: GenerationResult): string {
  const rows: string[] = [];
  rows.push(["Tag Name", "MMD Syntax", "Type", "Occurrences", "Source Text", "Status", "Notes"].map(csvEscape).join(","));
  for (const tag of result.tags) {
    const source = tag.sourceTexts[0] ?? "";
    rows.push(
      [tag.name, tag.mmdSyntax, tag.tagType, tag.occurrences, source, tag.status, tag.notes]
        .map(csvEscape)
        .join(","),
    );
  }
  rows.push("");
  rows.push(["Conditional", "MMD Open", "MMD Close", "Occurrences", "Scope", "Confirmed", "Status"].map(csvEscape).join(","));
  for (const cond of result.conditionals) {
    rows.push(
      [cond.name, cond.mmdOpen, cond.mmdClose, cond.occurrences, cond.scope, cond.confirmed ? "Yes" : "No", cond.status]
        .map(csvEscape)
        .join(","),
    );
  }
  return rows.join("\n");
}

const GATE_ICON: Record<ReadinessGate, string> = {
  "NOT READY": "\u{1F534} NOT READY",
  "REVIEW REQUIRED": "\u{1F7E0} REVIEW REQUIRED",
  READY: "\u{1F7E2} READY",
};

export function buildReviewReport(result: GenerationResult): string {
  const lines: string[] = [];
  lines.push("# LETTER VALIDATION REPORT", "");
  lines.push(`Letter type: ${result.letterType}`);
  if (result.detectedType) lines.push(`Auto-detected type: ${result.detectedType}`);
  lines.push(`Export status: ${GATE_ICON[result.readiness]}`);
  lines.push(`Page layout confidence: ${result.layoutConfidence.toFixed(0)}%`, "");

  const errors = result.validationIssues.filter((i) => i.severity === "ERROR");
  const warnings = result.validationIssues.filter((i) => i.severity === "WARNING");

  lines.push("## Errors");
  lines.push(...(errors.length ? errors.map((i) => `- [${i.code}] ${i.message}`) : ["(none)"]));

  lines.push("", "## Warnings");
  lines.push(...(warnings.length ? warnings.map((i) => `- [${i.code}] ${i.message}`) : ["(none)"]));

  lines.push("", "## Page Layout Warnings");
  lines.push(...result.layoutWarnings.map((w) => `- [${w.severity === "INFO" ? "OK" : "WARN"}] ${w.message}`));

  const newTags = result.tags.filter((t) => t.status === "Needs Creation");
  const dupTags = result.tags.filter((t) => t.status === "Duplicate");
  const reviewTags = result.tags.filter((t) => t.status === "Review");

  lines.push("", "## New Data Tags");
  lines.push(...(newTags.length ? newTags.map((t) => `- ${t.mmdSyntax} (x${t.occurrences})`) : ["(none)"]));

  lines.push("", "## Potential Duplicate Tags");
  lines.push(...(dupTags.length ? dupTags.map((t) => `- ${t.name}: ${t.notes}`) : ["(none)"]));

  lines.push("", "## Tags Requiring Review");
  lines.push(
    ...(reviewTags.length
      ? reviewTags.map((t) => `- ${t.mmdSyntax || "(unresolved)"} : ${t.notes || "context could not be determined"}`)
      : ["(none)"]),
  );

  const unresolved = result.conditionals.filter((c) => !c.confirmed);
  lines.push("", "## Unresolved Conditions");
  lines.push(
    ...(unresolved.length
      ? unresolved.map((c) => `- ${c.name} (scope: ${c.scope}, occurrences: ${c.occurrences})`)
      : ["(none)"]),
  );

  return lines.join("\n") + "\n";
}

export function downloadTextFile(filename: string, content: string, mime = "text/plain"): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
