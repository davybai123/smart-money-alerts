"use client";

import type { GenerationResult } from "@/lib/models";

export function LayoutPanel({ result }: { result: GenerationResult }) {
  const confidence = Math.round(result.layoutConfidence);
  const barColor = confidence >= 90 ? "bg-emerald-500" : confidence >= 60 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="font-semibold">Page Layout Confidence</span>
          <span className="font-mono">{confidence}%</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-neutral-200 dark:bg-neutral-800">
          <div className={`h-2.5 rounded-full ${barColor}`} style={{ width: `${confidence}%` }} />
        </div>
      </div>

      <ul className="flex flex-col gap-1.5 text-sm">
        {result.layoutWarnings.map((w, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className={w.severity === "INFO" ? "text-emerald-600" : "text-amber-600"}>
              {w.severity === "INFO" ? "✓" : "⚠"}
            </span>
            <span>{w.message}</span>
          </li>
        ))}
      </ul>

      <div className="rounded-lg border border-neutral-200 p-3 text-xs text-neutral-500 dark:border-neutral-800">
        Layout analysis is a heuristic simulation (configurable lines-per-page in Settings) --
        there is no real MMD renderer to consult, so this catches classic bad splits (orphaned
        headings, tables/lists straddling a page boundary, signatures stranded from their
        closing text) rather than pixel-perfect pagination.
      </div>
    </div>
  );
}
