"use client";

import { useState } from "react";
import type { ConditionalRecord, TagRecord } from "@/lib/models";

const STATUS_STYLES: Record<string, string> = {
  Existing: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  New: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  "Needs Creation": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  Duplicate: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  Review: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  Invalid: "bg-red-200 text-red-900 dark:bg-red-900/60 dark:text-red-100",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? "bg-neutral-200 text-neutral-800"}`}>
      {status}
    </span>
  );
}

export function TagsPanel({
  tags,
  conditionals,
  onConfirmScope,
}: {
  tags: TagRecord[];
  conditionals: ConditionalRecord[];
  onConfirmScope: (name: string, scope: string) => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Data Tags</h2>
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-900 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Tag</th>
                <th className="px-3 py-2 font-medium">MMD Tag</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium text-right">Occurrences</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {tags.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-neutral-500">
                    No data tags detected yet.
                  </td>
                </tr>
              )}
              {tags.map((t) => (
                <tr key={t.name} className="border-t border-neutral-100 dark:border-neutral-800">
                  <td className="px-3 py-2 font-mono">{t.name}</td>
                  <td className="px-3 py-2 font-mono text-neutral-500">{t.mmdSyntax}</td>
                  <td className="px-3 py-2">{t.tagType}</td>
                  <td className="px-3 py-2 text-right">{t.occurrences}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={t.status} />
                    {t.notes && <div className="mt-1 text-xs text-neutral-500">{t.notes}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Conditional Items &amp; Review
        </h2>
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-900 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Condition</th>
                <th className="px-3 py-2 font-medium text-right">Occurrences</th>
                <th className="px-3 py-2 font-medium">Used In</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Scope</th>
                <th className="px-3 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {conditionals.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-neutral-500">
                    No conditionals detected yet.
                  </td>
                </tr>
              )}
              {conditionals.map((c) => (
                <ConditionalRow key={c.name} cond={c} onConfirmScope={onConfirmScope} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ConditionalRow({
  cond,
  onConfirmScope,
}: {
  cond: ConditionalRecord;
  onConfirmScope: (name: string, scope: string) => void;
}) {
  const [scopeInput, setScopeInput] = useState(cond.confirmed ? cond.scope : "");

  return (
    <tr className="border-t border-neutral-100 dark:border-neutral-800 align-top">
      <td className="px-3 py-2 font-mono">{cond.name}</td>
      <td className="px-3 py-2 text-right">{cond.occurrences}</td>
      <td className="px-3 py-2 text-neutral-500">{cond.sections.join(", ") || "-"}</td>
      <td className="px-3 py-2">
        {cond.confirmed ? (
          <span className="inline-block rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
            ✓ Confirmed
          </span>
        ) : (
          <span className="inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            ⚠ Review Required
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-neutral-500">{cond.scope}</td>
      <td className="px-3 py-2">
        <div className="flex gap-2">
          <input
            value={scopeInput}
            onChange={(e) => setScopeInput(e.target.value)}
            placeholder="e.g. Paragraph 4"
            className="w-32 rounded border border-neutral-300 bg-transparent px-2 py-1 text-xs dark:border-neutral-700"
          />
          <button
            onClick={() => scopeInput.trim() && onConfirmScope(cond.name, scopeInput.trim())}
            disabled={!scopeInput.trim()}
            className="rounded bg-neutral-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
          >
            Confirm
          </button>
        </div>
      </td>
    </tr>
  );
}
