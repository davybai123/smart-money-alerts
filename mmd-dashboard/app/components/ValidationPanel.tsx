"use client";

import type { GenerationResult } from "@/lib/models";

const GATE_STYLES: Record<string, string> = {
  "NOT READY": "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  "REVIEW REQUIRED": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  READY: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
};

const GATE_ICON: Record<string, string> = {
  "NOT READY": "\u{1F534}",
  "REVIEW REQUIRED": "\u{1F7E0}",
  READY: "\u{1F7E2}",
};

export function ValidationPanel({ result }: { result: GenerationResult }) {
  const errors = result.validationIssues.filter((i) => i.severity === "ERROR");
  const warnings = result.validationIssues.filter((i) => i.severity === "WARNING");
  const needsCreation = result.tags.filter((t) => t.status === "Needs Creation");
  const unconfirmed = result.conditionals.filter((c) => !c.confirmed);
  const layoutBad = result.layoutWarnings.filter((w) => w.severity !== "INFO");

  const checklist: Array<{ ok: boolean; text: string }> = [
    { ok: !result.typeConflict, text: `Recipient type identified: ${result.letterType}` },
    { ok: true, text: "Header valid" },
    { ok: true, text: `${result.tags.length} data tag(s) detected` },
    { ok: true, text: `${result.conditionals.length} conditional tag(s) detected` },
    { ok: errors.length === 0, text: errors.length === 0 ? "No structural errors" : `${errors.length} structural error(s)` },
    { ok: needsCreation.length === 0, text: needsCreation.length === 0 ? "No tags need creation" : `${needsCreation.length} tag(s) need creation` },
    {
      ok: unconfirmed.length === 0,
      text: unconfirmed.length === 0 ? "All conditionals confirmed" : `${unconfirmed.length} conditional(s) require scope confirmation`,
    },
    { ok: layoutBad.length === 0, text: layoutBad.length === 0 ? "Page layout appears safe" : `${layoutBad.length} page layout warning(s)` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold ${GATE_STYLES[result.readiness]}`}>
        <span>{GATE_ICON[result.readiness]}</span>
        <span>{result.readiness}</span>
      </div>

      <ul className="flex flex-col gap-1.5 text-sm">
        {checklist.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className={item.ok ? "text-emerald-600" : "text-amber-600"}>{item.ok ? "✓" : "⚠"}</span>
            <span>{item.text}</span>
          </li>
        ))}
      </ul>

      {errors.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-red-700 dark:text-red-300">Errors</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {errors.map((i, idx) => (
              <li key={idx} className="rounded bg-red-50 px-3 py-2 dark:bg-red-950/40">
                <span className="font-mono text-xs text-red-500">[{i.code}]</span> {i.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-amber-700 dark:text-amber-300">Warnings</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {warnings.map((i, idx) => (
              <li key={idx} className="rounded bg-amber-50 px-3 py-2 dark:bg-amber-950/40">
                <span className="font-mono text-xs text-amber-600">[{i.code}]</span> {i.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
