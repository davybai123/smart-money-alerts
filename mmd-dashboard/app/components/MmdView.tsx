"use client";

import { useMemo } from "react";
import { PROTECTED_TAGS } from "@/lib/protectedTags";
import type { TagRecord } from "@/lib/models";

type SpanKind = "system" | "data-new" | "data-existing" | "data-duplicate" | "data-review" | "conditional" | "review" | "plain";

interface Span {
  text: string;
  kind: SpanKind;
  tagName?: string;
}

const MMD_TOKEN_RE = /<%--[\s\S]*?--%>|<%[\s\S]*?%>/g;

function classify(token: string, tags: TagRecord[]): Span {
  if (token.startsWith("<%--")) {
    return { text: token, kind: "review" };
  }
  const inner = token.slice(2, -2).trim();

  const dataMatch = inner.match(/^data_l\(([^)]*)\)$/);
  if (dataMatch) {
    const name = dataMatch[1];
    const tag = tags.find((t) => t.name === name);
    const kind: SpanKind =
      tag?.status === "Duplicate"
        ? "data-duplicate"
        : tag?.status === "Review"
          ? "data-review"
          : tag?.status === "Existing"
            ? "data-existing"
            : "data-new";
    return { text: token, kind, tagName: name };
  }

  if (inner.startsWith("data_insert_true(") || inner.startsWith("/data_insert_true(")) {
    const condMatch = inner.match(/data_insert_true\(([^)]*)\)/);
    return { text: token, kind: "conditional", tagName: condMatch?.[1] };
  }

  if (PROTECTED_TAGS.has(inner)) {
    return { text: token, kind: "system", tagName: inner };
  }

  return { text: token, kind: "plain" };
}

const KIND_CLASSES: Record<SpanKind, string> = {
  system: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
  "data-new": "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  "data-existing": "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
  "data-duplicate": "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200",
  "data-review": "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
  conditional: "bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-200",
  review: "bg-red-200 text-red-950 dark:bg-red-900/60 dark:text-red-100",
  plain: "",
};

export function MmdView({
  mmdText,
  tags,
  onSelectTag,
}: {
  mmdText: string;
  tags: TagRecord[];
  onSelectTag: (name: string, isConditional: boolean) => void;
}) {
  const parts = useMemo(() => {
    const result: Array<{ text: string; span?: Span }> = [];
    let lastIndex = 0;
    for (const m of mmdText.matchAll(MMD_TOKEN_RE)) {
      if (m.index! > lastIndex) result.push({ text: mmdText.slice(lastIndex, m.index) });
      result.push({ text: m[0], span: classify(m[0], tags) });
      lastIndex = m.index! + m[0].length;
    }
    if (lastIndex < mmdText.length) result.push({ text: mmdText.slice(lastIndex) });
    return result;
  }, [mmdText, tags]);

  return (
    <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed">
      {parts.map((p, i) => {
        if (!p.span || p.span.kind === "plain") return <span key={i}>{p.text}</span>;
        const clickable = !!p.span.tagName;
        return (
          <span
            key={i}
            className={`${KIND_CLASSES[p.span.kind]} rounded px-0.5 ${clickable ? "cursor-pointer hover:underline" : ""}`}
            onClick={
              clickable
                ? () => onSelectTag(p.span!.tagName!, p.span!.kind === "conditional")
                : undefined
            }
            title={p.span.kind.replace("-", " ")}
          >
            {p.text}
          </span>
        );
      })}
    </pre>
  );
}
