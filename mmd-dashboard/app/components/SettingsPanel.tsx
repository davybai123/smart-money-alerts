"use client";

import { useState } from "react";
import { PROTECTED_TAGS } from "@/lib/protectedTags";
import type { AppSettings } from "@/lib/settings";

export function SettingsPanel({
  settings,
  onChange,
}: {
  settings: AppSettings;
  onChange: (next: AppSettings) => void;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [newTarget, setNewTarget] = useState("");

  const entries = Object.entries(settings.approvedDictionary);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Protected Tags</h2>
        <p className="mb-2 text-xs text-neutral-500">
          System tags -- never automatically renamed or converted.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {[...PROTECTED_TAGS].sort().map((t) => (
            <span key={t} className="rounded bg-sky-100 px-2 py-0.5 font-mono text-xs text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">
              {t}
            </span>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Approved Tag Dictionary</h2>
        <p className="mb-2 text-xs text-neutral-500">
          Raw-letter label &rarr; MMD tag. Use <code>{"{ctx}"}</code> for member/dependant-aware tags,
          e.g. <code>{"{ctx}_forename"}</code>.
        </p>
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-900 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Raw Label</th>
                <th className="px-3 py-2 font-medium">MMD Tag</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {entries.map(([label, target]) => (
                <tr key={label} className="border-t border-neutral-100 dark:border-neutral-800">
                  <td className="px-3 py-2 font-mono">{label}</td>
                  <td className="px-3 py-2 font-mono text-neutral-500">{target}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => {
                        const next = { ...settings.approvedDictionary };
                        delete next[label];
                        onChange({ ...settings, approvedDictionary: next });
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="px-3 py-2">
                  <input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="e.g. member id"
                    className="w-full rounded border border-neutral-300 bg-transparent px-2 py-1 text-xs dark:border-neutral-700"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={newTarget}
                    onChange={(e) => setNewTarget(e.target.value)}
                    placeholder="e.g. member_id or {ctx}_forename"
                    className="w-full rounded border border-neutral-300 bg-transparent px-2 py-1 text-xs dark:border-neutral-700"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    disabled={!newLabel.trim() || !newTarget.trim()}
                    onClick={() => {
                      const key = newLabel.trim().toLowerCase();
                      onChange({
                        ...settings,
                        approvedDictionary: { ...settings.approvedDictionary, [key]: newTarget.trim() },
                      });
                      setNewLabel("");
                      setNewTarget("");
                    }}
                    className="rounded bg-neutral-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
                  >
                    Add
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Page-Break Configuration</h2>
        <p className="mb-3 text-xs text-neutral-500">
          No MMD page-break syntax is invented. A marker is only inserted if you configure one here
          <em> and</em> turn insertion on.
        </p>
        <div className="flex flex-col gap-3 text-sm">
          <label className="flex items-center justify-between gap-4">
            <span>Lines per page (layout heuristic)</span>
            <input
              type="number"
              min={5}
              value={settings.pageConfig.linesPerPage}
              onChange={(e) =>
                onChange({
                  ...settings,
                  pageConfig: { ...settings.pageConfig, linesPerPage: Number(e.target.value) || 45 },
                })
              }
              className="w-24 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
            />
          </label>
          <label className="flex items-center justify-between gap-4">
            <span>Page-break marker (MMD syntax)</span>
            <input
              value={settings.pageConfig.marker ?? ""}
              onChange={(e) =>
                onChange({
                  ...settings,
                  pageConfig: { ...settings.pageConfig, marker: e.target.value || null },
                })
              }
              placeholder="leave blank if unknown"
              className="w-56 rounded border border-neutral-300 bg-transparent px-2 py-1 font-mono text-xs dark:border-neutral-700"
            />
          </label>
          <label className="flex items-center justify-between gap-4">
            <span>Insert page breaks at recommended points</span>
            <input
              type="checkbox"
              checked={settings.pageConfig.insertBreaks}
              onChange={(e) =>
                onChange({ ...settings, pageConfig: { ...settings.pageConfig, insertBreaks: e.target.checked } })
              }
              className="h-4 w-4"
            />
          </label>
          <label className="flex items-center justify-between gap-4">
            <span>Keep headings/tables/signatures whole</span>
            <input
              type="checkbox"
              checked={settings.pageConfig.keepSectionsTogether}
              onChange={(e) =>
                onChange({
                  ...settings,
                  pageConfig: { ...settings.pageConfig, keepSectionsTogether: e.target.checked },
                })
              }
              className="h-4 w-4"
            />
          </label>
        </div>
      </section>
    </div>
  );
}
