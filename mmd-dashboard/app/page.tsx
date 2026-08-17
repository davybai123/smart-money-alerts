"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MmdView } from "./components/MmdView";
import { TagsPanel } from "./components/TagsPanel";
import { ValidationPanel } from "./components/ValidationPanel";
import { LayoutPanel } from "./components/LayoutPanel";
import { LogPanel } from "./components/LogPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import type { GenerationResult, LetterType } from "@/lib/models";
import { LetterTypeConflictError, generateMmd } from "@/lib/parser";
import { detectLetterType } from "@/lib/recipientContext";
import { computeGate } from "@/lib/validator";
import { buildReviewReport, buildTagListCsv, downloadTextFile } from "@/lib/exporter";
import { defaultSettings, loadSettings, saveSettings, type AppSettings } from "@/lib/settings";
import { SAMPLE_LETTERS } from "@/lib/samples";

type TabKey = "generator" | "tags" | "validation" | "layout" | "log" | "settings";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "generator", label: "Generator" },
  { key: "tags", label: "Tags & Items" },
  { key: "validation", label: "Validation" },
  { key: "layout", label: "Page Layout" },
  { key: "log", label: "Transformation Log" },
  { key: "settings", label: "Settings" },
];

const GATE_STYLES: Record<string, string> = {
  "NOT READY": "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  "REVIEW REQUIRED": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  READY: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
};

function applyConfirmedScopes(result: GenerationResult, confirmedScopes: Record<string, string>): GenerationResult {
  const conditionals = result.conditionals.map((c) => {
    const scope = confirmedScopes[c.name];
    if (scope === undefined) return c;
    return { ...c, confirmed: true, scope, status: "Confirmed" };
  });
  const confirmedNames = new Set(conditionals.filter((c) => c.confirmed).map((c) => c.name));
  const validationIssues = result.validationIssues.filter((i) => {
    if (i.code !== "CONDITIONAL_SCOPE_UNCONFIRMED") return true;
    return ![...confirmedNames].some((name) => i.message.includes(`'${name}'`));
  });
  return { ...result, conditionals, validationIssues, readiness: computeGate(validationIssues) };
}

export default function Page() {
  const [rawText, setRawText] = useState<string>(SAMPLE_LETTERS["Member -- JPS 2015 (nested conditionals)"]);
  const [letterTypeChoice, setLetterTypeChoice] = useState<"AUTO" | LetterType>("AUTO");
  // Derived (not a separate reset-effect): a conflict is only "acknowledged"
  // for the exact raw text + letter-type choice it was acknowledged under,
  // so editing either automatically re-surfaces the warning.
  const [acknowledgedFor, setAcknowledgedFor] = useState<{ rawText: string; letterTypeChoice: string } | null>(null);
  const acknowledgedConflict = acknowledgedFor?.rawText === rawText && acknowledgedFor?.letterTypeChoice === letterTypeChoice;
  const [confirmedScopes, setConfirmedScopes] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<TabKey>("generator");
  const [settings, setSettingsState] = useState<AppSettings>(defaultSettings());
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [selectedTag, setSelectedTag] = useState<{ name: string; isConditional: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Settings live in localStorage, which only exists client-side -- this is
  // a genuine "sync with an external system" effect (not derivable state),
  // so the one extra render on mount to hydrate it is expected.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettingsState(loadSettings());
    setSettingsLoaded(true);
  }, []);

  useEffect(() => {
    if (settingsLoaded) saveSettings(settings);
  }, [settings, settingsLoaded]);

  const autoDetected = useMemo(() => detectLetterType(rawText).detected, [rawText]);
  const requestedType: LetterType = letterTypeChoice === "AUTO" ? autoDetected ?? "MEMBER" : letterTypeChoice;

  const generation = useMemo(() => {
    try {
      const result = generateMmd(rawText, requestedType, {
        allowConflict: acknowledgedConflict,
        pageConfig: settings.pageConfig,
        approvedDictionary: settings.approvedDictionary,
      });
      return { result: applyConfirmedScopes(result, confirmedScopes), conflict: null as LetterTypeConflictError | null };
    } catch (e) {
      if (e instanceof LetterTypeConflictError) {
        return { result: null, conflict: e };
      }
      throw e;
    }
  }, [rawText, requestedType, acknowledgedConflict, settings, confirmedScopes]);

  const result = generation.result;
  const conflict = generation.conflict;

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setRawText(String(reader.result ?? ""));
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleConfirmScope(name: string, scope: string) {
    setConfirmedScopes((prev) => ({ ...prev, [name]: scope }));
  }

  function handleSelectTag(name: string, isConditional: boolean) {
    setSelectedTag({ name, isConditional });
    setActiveTab("tags");
  }

  const canExport = result && result.readiness !== "NOT READY";

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-4 dark:border-neutral-800">
        <div>
          <h1 className="text-xl font-bold">MMD Letter Generator</h1>
          <p className="text-sm text-neutral-500">Convert raw pension merge letters into MMD-compatible templates.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-white dark:bg-white dark:text-neutral-900">
            {requestedType} LETTER
          </span>
          {result && (
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${GATE_STYLES[result.readiness]}`}>
              {result.readiness}
            </span>
          )}
        </div>
      </header>

      <section className="flex flex-wrap items-center gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Letter type</span>
          {(["AUTO", "MEMBER", "DEPENDANT"] as const).map((opt) => (
            <label key={opt} className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="letterType"
                checked={letterTypeChoice === opt}
                onChange={() => setLetterTypeChoice(opt)}
              />
              {opt === "AUTO" ? "Auto-detect" : `${opt.charAt(0)}${opt.slice(1).toLowerCase()} letter`}
            </label>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select
            className="rounded border border-neutral-300 bg-transparent px-2 py-1 text-sm dark:border-neutral-700"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) setRawText(SAMPLE_LETTERS[e.target.value]);
              e.target.value = "";
            }}
          >
            <option value="" disabled>
              Load sample letter&hellip;
            </option>
            {Object.keys(SAMPLE_LETTERS).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded border border-neutral-300 px-3 py-1 text-sm dark:border-neutral-700"
          >
            Upload .txt
          </button>
          <input ref={fileInputRef} type="file" accept=".txt" className="hidden" onChange={handleFileUpload} />
        </div>
      </section>

      {!conflict && letterTypeChoice === "AUTO" && autoDetected === null && (
        <section className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/40">
          <span>
            &#9888; Auto-detect could not find existing recipient tags in this letter, so it cannot
            determine MEMBER vs DEPENDANT. Currently defaulting to <strong>MEMBER</strong> -- please
            select the correct type manually.
          </span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setLetterTypeChoice("MEMBER")}
              className="rounded bg-neutral-900 px-3 py-1 text-xs font-medium text-white dark:bg-white dark:text-neutral-900"
            >
              Member letter
            </button>
            <button
              onClick={() => setLetterTypeChoice("DEPENDANT")}
              className="rounded border border-neutral-400 px-3 py-1 text-xs font-medium"
            >
              Dependant letter
            </button>
          </div>
        </section>
      )}

      {conflict && (
        <section className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/40">
          <span>
            &#9888; {conflict.message} Selected: <strong>{conflict.selected}</strong>. Detected:{" "}
            <strong>{conflict.detected ?? "Unknown"}</strong> (matched: {conflict.matchedTags.join(", ")}).
          </span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setAcknowledgedFor({ rawText, letterTypeChoice })}
              className="rounded bg-neutral-900 px-3 py-1 text-xs font-medium text-white dark:bg-white dark:text-neutral-900"
            >
              Keep {conflict.selected}
            </button>
            {conflict.detected && (
              <button
                onClick={() => setLetterTypeChoice(conflict.detected as LetterType)}
                className="rounded border border-neutral-400 px-3 py-1 text-xs font-medium"
              >
                Switch to {conflict.detected}
              </button>
            )}
          </div>
        </section>
      )}

      <nav className="flex flex-wrap gap-1 border-b border-neutral-200 dark:border-neutral-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
              activeTab === t.key
                ? "border-b-2 border-neutral-900 text-neutral-900 dark:border-white dark:text-white"
                : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 py-1.5">
          <button
            disabled={!canExport}
            onClick={() => result && downloadTextFile("letter.mmd", result.mmdText)}
            className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
          >
            Export .mmd
          </button>
          <button
            disabled={!canExport}
            onClick={() => result && downloadTextFile("letter_tags.csv", buildTagListCsv(result), "text/csv")}
            className="rounded border border-neutral-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-40 dark:border-neutral-700"
          >
            Export Tag List
          </button>
          <button
            disabled={!canExport}
            onClick={() => result && downloadTextFile("letter_review_report.md", buildReviewReport(result), "text/markdown")}
            className="rounded border border-neutral-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-40 dark:border-neutral-700"
          >
            Export Review Report
          </button>
        </div>
      </nav>

      <main className="flex-1">
        {activeTab === "generator" && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500"># Raw Letter</h2>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                spellCheck={false}
                className="h-[70vh] w-full resize-none rounded-lg border border-neutral-300 bg-white p-3 font-mono text-[13px] leading-relaxed dark:border-neutral-700 dark:bg-neutral-950"
              />
            </div>
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500"># Generated MMD</h2>
              <div className="h-[70vh] overflow-auto rounded-lg border border-neutral-300 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-950">
                {result ? (
                  <MmdView mmdText={result.mmdText} tags={result.tags} onSelectTag={handleSelectTag} />
                ) : (
                  <p className="text-sm text-neutral-500">Resolve the letter-type conflict above to see the generated MMD.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "tags" && result && (
          <TagsPanel tags={result.tags} conditionals={result.conditionals} onConfirmScope={handleConfirmScope} />
        )}

        {activeTab === "validation" && result && <ValidationPanel result={result} />}

        {activeTab === "layout" && result && <LayoutPanel result={result} />}

        {activeTab === "log" && result && <LogPanel log={result.transformationLog} />}

        {activeTab === "settings" && <SettingsPanel settings={settings} onChange={setSettingsState} />}

        {!result && activeTab !== "settings" && (
          <p className="text-sm text-neutral-500">Resolve the letter-type conflict above first.</p>
        )}
      </main>

      {selectedTag && result && (
        <TagInspector
          name={selectedTag.name}
          isConditional={selectedTag.isConditional}
          result={result}
          onClose={() => setSelectedTag(null)}
        />
      )}
    </div>
  );
}

function TagInspector({
  name,
  isConditional,
  result,
  onClose,
}: {
  name: string;
  isConditional: boolean;
  result: GenerationResult;
  onClose: () => void;
}) {
  const tag = !isConditional ? result.tags.find((t) => t.name === name) : undefined;
  const cond = isConditional ? result.conditionals.find((c) => c.name === name) : undefined;

  return (
    <div className="fixed bottom-4 right-4 w-80 rounded-lg border border-neutral-300 bg-white p-4 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">{isConditional ? "Conditional" : "Tag"}</span>
        <button onClick={onClose} className="text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
          &times;
        </button>
      </div>
      <dl className="flex flex-col gap-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-neutral-500">Name</dt>
          <dd className="font-mono">{name}</dd>
        </div>
        {tag && (
          <>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Type</dt>
              <dd>{tag.tagType}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Occurrences</dt>
              <dd>{tag.occurrences}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Status</dt>
              <dd>{tag.status}</dd>
            </div>
            {tag.notes && <p className="mt-1 text-xs text-neutral-500">{tag.notes}</p>}
          </>
        )}
        {cond && (
          <>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Occurrences</dt>
              <dd>{cond.occurrences}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Confirmed</dt>
              <dd>{cond.confirmed ? "Yes" : "No"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Scope</dt>
              <dd>{cond.scope}</dd>
            </div>
          </>
        )}
      </dl>
    </div>
  );
}
