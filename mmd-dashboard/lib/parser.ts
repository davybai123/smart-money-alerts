// Whitespace tidy-up, document structure analysis, and the top-level
// generateMmd orchestrator tying every module together.
// Port of mmd_generator/parser.py (Sections 21, 27, 38-39, 42).

import { collectKnownConditions, convertBrackets } from "./conditionals";
import { analyseLayout } from "./layoutAnalyser";
import type {
  DocumentSection,
  GenerationResult,
  LetterType,
  SectionKind,
  ValidationIssue,
} from "./models";
import { applyPageBreaks, defaultPageConfig, type PageBreakConfig } from "./pageManager";
import { convertParenPlaceholders } from "./placeholders";
import {
  checkTypeConflict,
  detectLetterType,
  hasGreetingLine,
  hasHeaderBlock,
  RecipientContext,
} from "./recipientContext";
import { TagManager } from "./tagManager";
import { TransformationLog } from "./transformationLog";
import {
  checkCrossContextTags,
  computeGate,
  findLeftoverNamePlaceholders,
  findUnmatchedBrackets,
  validateTagsAndConditionals,
} from "./validator";

// ---------------------------------------------------------------------------
// tidyWhitespace (Section 21, retained/improved)
// ---------------------------------------------------------------------------

export function tidyWhitespace(text: string, maxBlankLines = 1): string {
  const lines = text.split("\n").map((ln) => ln.replace(/\s+$/, ""));
  const out: string[] = [];
  let blankRun = 0;
  for (const ln of lines) {
    if (ln.trim() === "") {
      blankRun += 1;
      if (blankRun <= maxBlankLines) out.push("");
    } else {
      blankRun = 0;
      out.push(ln);
    }
  }
  return out.join("\n").replace(/^\n+|\n+$/g, "") + "\n";
}

// ---------------------------------------------------------------------------
// Document structure analysis (Sections 21, 39)
// ---------------------------------------------------------------------------

const TABLE_ROW_RE = /\|.*\|/;
const LIST_ITEM_RE = /^\s*(?:[-*•]|\d+[.)])\s+/;
const SIGNATURE_TRIGGER_RE = /^(yours (sincerely|faithfully)|kind regards|regards),?\s*$/i;
const CONDITIONAL_MARK_RE = /<%\s*data_insert_true\(/;

const CHARS_PER_LINE = 95;

function estimateLines(blockText: string): number {
  const rawLines = blockText.split("\n");
  const lines = rawLines.length ? rawLines : [blockText];
  let total = 0;
  for (const ln of lines) {
    total += Math.max(1, Math.ceil(Math.max(ln.length, 1) / CHARS_PER_LINE));
  }
  return total;
}

function classifyBlock(lines: string[]): SectionKind {
  const nonEmpty = lines.filter((l) => l.trim() !== "");
  if (nonEmpty.length === 0) return "blank";
  const joined = nonEmpty.join("\n");
  if (CONDITIONAL_MARK_RE.test(joined)) return "conditional";
  if (nonEmpty.length >= 2 && nonEmpty.every((l) => TABLE_ROW_RE.test(l))) return "table";
  if (nonEmpty.every((l) => LIST_ITEM_RE.test(l))) return "list";
  if (SIGNATURE_TRIGGER_RE.test(nonEmpty[0].trim())) return "signature";
  if (
    nonEmpty.length === 1 &&
    nonEmpty[0].length <= 90 &&
    !/[.,;:]\s*$/.test(nonEmpty[0])
  ) {
    return "heading";
  }
  return "paragraph";
}

export function analyseStructure(text: string): DocumentSection[] {
  const blocks = text.split(/\n\s*\n/);
  const sections: DocumentSection[] = [];
  let lineCursor = 1;
  for (const block of blocks) {
    const blockStripped = block.replace(/^\n+|\n+$/g, "");
    if (!blockStripped.trim()) {
      lineCursor += (block.match(/\n/g)?.length ?? 0) + 1;
      continue;
    }
    const lines = blockStripped.split("\n");
    const kind = classifyBlock(lines);
    sections.push({
      kind,
      text: blockStripped,
      startLine: lineCursor,
      endLine: lineCursor + lines.length,
      estimatedLines: estimateLines(blockStripped),
    });
    lineCursor += lines.length + 1;
  }
  return sections;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export class LetterTypeConflictError extends Error {
  selected: LetterType;
  detected: LetterType | null;
  matchedTags: string[];

  constructor(selected: LetterType, detected: LetterType | null, matchedTags: string[]) {
    super("The selected letter type appears to conflict with the detected recipient fields.");
    this.name = "LetterTypeConflictError";
    this.selected = selected;
    this.detected = detected;
    this.matchedTags = matchedTags;
  }
}

export interface GenerateOptions {
  allowConflict?: boolean;
  pageConfig?: PageBreakConfig;
  approvedDictionary?: Record<string, string>;
}

export function generateMmd(
  rawText: string,
  selectedType: LetterType,
  options: GenerateOptions = {},
): GenerationResult {
  const { allowConflict = false, pageConfig = defaultPageConfig(), approvedDictionary } = options;

  const conflict = checkTypeConflict(selectedType, rawText);
  if (conflict && !allowConflict) {
    throw new LetterTypeConflictError(conflict.selected, conflict.detected, conflict.matchedTags);
  }
  const { detected: detectedType } = detectLetterType(rawText);

  const ctx = new RecipientContext(selectedType);
  const tagManager = new TagManager();
  const log = new TransformationLog();
  const issues: ValidationIssue[] = [];

  const knownConditions = collectKnownConditions(rawText);

  // 1. Convert [IF ...]/[/IF] conditionals + square-bracket placeholders +
  //    flag bare conditional markers.
  let body = convertBrackets(rawText, ctx, tagManager, log, issues, knownConditions, "body", approvedDictionary);

  // 2. Convert parenthesis/word-style recipient name references.
  body = convertParenPlaceholders(body, ctx, log);

  // 3. Auto-insert the standard MMD header if missing; skip the greeting
  //    half if the letter already supplies its own "Dear ..." line, so it
  //    is not duplicated.
  if (!hasHeaderBlock(rawText)) {
    if (hasGreetingLine(rawText)) {
      body = ctx.envelopeBlock() + "\n\n" + body;
      log.record(
        "auto_header",
        "(no Recipient: header found; existing greeting kept)",
        "auto-generated recipient envelope block",
      );
    } else {
      body = ctx.headerBlock() + "\n\n" + body;
      log.record("auto_header", "(no Recipient: header found)", "auto-generated recipient header block");
    }
  }

  // 4. Whitespace tidy-up.
  body = tidyWhitespace(body);

  // 5. Document structure + page-layout analysis.
  const sections = analyseStructure(body);
  const { warnings: layoutWarnings, confidence, recommendBreakBefore } = analyseLayout(sections, pageConfig);

  // 6. Optional page-break marker insertion.
  const pbResult = applyPageBreaks(body, recommendBreakBefore, pageConfig);
  body = pbResult.body;
  issues.push(...pbResult.issues);

  // 7. Tag deduplication.
  tagManager.deduplicate();

  // 8. Full structural validation.
  issues.push(...findUnmatchedBrackets(rawText));
  issues.push(...findLeftoverNamePlaceholders(body));
  issues.push(...checkCrossContextTags(body, selectedType));
  issues.push(...validateTagsAndConditionals(tagManager));

  const gate = computeGate(issues);

  return {
    letterType: selectedType,
    mmdText: body,
    rawText,
    tags: tagManager.tags(),
    conditionals: tagManager.conditionals(),
    transformationLog: log.entries(),
    validationIssues: issues,
    layoutWarnings,
    layoutConfidence: confidence,
    readiness: gate,
    detectedType,
    typeConflict: conflict !== null,
    sections,
  };
}
