"use client";

import type { TransformationEntry } from "@/lib/models";

export function LogPanel({ log }: { log: TransformationEntry[] }) {
  if (log.length === 0) {
    return <p className="text-sm text-neutral-500">No transformations recorded yet.</p>;
  }
  return (
    <ol className="flex flex-col gap-2 text-sm">
      {log.map((e) => (
        <li key={e.index} className="rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-800">
          <div className="mb-1 font-mono text-xs text-neutral-500">
            #{e.index} &middot; {e.rule}
          </div>
          <div className="font-mono text-xs">
            <span className="text-neutral-500">RAW: </span>
            <span className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">{e.raw}</span>
          </div>
          <div className="font-mono text-xs">
            <span className="text-neutral-500">MMD: </span>
            <span className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">{e.became}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
