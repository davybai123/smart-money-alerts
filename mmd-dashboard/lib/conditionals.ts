// Conditional-block ([IF ...] / [/IF]) parsing and MMD conversion.
// Port of mmd_generator/conditionals.py -- the centrepiece of the engine.
//
// Bracket tokens are matched with [^\[\]]* so a single token never spans
// more than one bracket pair -- [IF ...] and [/IF] are two *separate* flat
// tokens paired up like open/close tags (not like nested parentheses),
// which is what allows correct arbitrary-depth nesting.

import type { Severity, TagStatus, TagType, ValidationIssue } from "./models";
import { convertGenericPlaceholder } from "./placeholders";
import type { RecipientContext } from "./recipientContext";
import { isInstructionOnly, normaliseTagName } from "./tagNormaliser";
import type { TagManager } from "./tagManager";
import type { TransformationLog } from "./transformationLog";

const BRACKET_TOKEN_RE = /\[([^[\]]*)\]/g;
const IF_OPEN_RE = /^IF\s+.+/i;
const IF_CLOSE_RE = /^\/\s*IF\s*$/i;

interface BracketToken {
  index: number; // start offset of the full "[...]" match
  end: number; // end offset (exclusive)
  full: string; // "[...]"
  inner: string; // content between brackets
}

function tokenize(text: string): BracketToken[] {
  const tokens: BracketToken[] = [];
  for (const m of text.matchAll(BRACKET_TOKEN_RE)) {
    tokens.push({ index: m.index!, end: m.index! + m[0].length, full: m[0], inner: m[1] });
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Retained low-level helpers (mirrors _find_matching_close / _split_condition_body / _clean_condition)
// ---------------------------------------------------------------------------

export function findMatchingClose(tokens: BracketToken[], startIndex: number): number | null {
  let depth = 0;
  for (let i = startIndex; i < tokens.length; i++) {
    const inner = tokens[i].inner.trim();
    if (i === startIndex) {
      depth = 1;
      continue;
    }
    if (IF_OPEN_RE.test(inner)) {
      depth += 1;
    } else if (IF_CLOSE_RE.test(inner)) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return null;
}

export function splitConditionBody(text: string, tokens: BracketToken[], openIdx: number, closeIdx: number): string {
  return text.slice(tokens[openIdx].end, tokens[closeIdx].index);
}

export function cleanCondition(raw: string): string {
  return raw.trim().replace(/^IF\s+/i, "").trim();
}

// ---------------------------------------------------------------------------
// Bare conditional marker safety net (Section 13)
// ---------------------------------------------------------------------------

export function collectKnownConditions(text: string): Set<string> {
  const names = new Set<string>();
  for (const m of text.matchAll(BRACKET_TOKEN_RE)) {
    const inner = m[1].trim();
    if (IF_OPEN_RE.test(inner)) {
      names.add(normaliseTagName(cleanCondition(inner)).toLowerCase());
    }
  }
  return names;
}

export function looksLikeBareMarker(content: string, knownConditions: Set<string>): boolean {
  const stripped = content.trim();
  if (!stripped) return false;
  const key = normaliseTagName(stripped).toLowerCase();
  if (key && knownConditions.has(key)) return true;
  const words = stripped.split(/\s+/);
  if (words.length === 0 || words.length > 5) return false;
  const isUpperWord = (w: string) => w === w.toUpperCase() && w !== w.toLowerCase();
  const isDigitWord = (w: string) => /^[0-9]+$/.test(w);
  if (words.some((w) => !(isUpperWord(w) || isDigitWord(w)))) return false;
  return words.some((w) => isUpperWord(w));
}

// ---------------------------------------------------------------------------
// Main conversion entry point
// ---------------------------------------------------------------------------

export function convertBrackets(
  text: string,
  ctx: RecipientContext,
  tagManager: TagManager,
  log: TransformationLog,
  issues: ValidationIssue[],
  knownConditions: Set<string>,
  sectionLabel = "body",
  approvedDictionary?: Record<string, string>,
): string {
  const tokens = tokenize(text);
  const out: string[] = [];
  let cursor = 0;
  let i = 0;

  while (i < tokens.length) {
    const tok = tokens[i];
    const inner = tok.inner;
    const stripped = inner.trim();

    if (tok.index > cursor) {
      out.push(text.slice(cursor, tok.index));
    }

    if (IF_OPEN_RE.test(stripped)) {
      const closeIdx = findMatchingClose(tokens, i);
      const conditionDisplay = cleanCondition(inner);
      const condName = normaliseTagName(conditionDisplay);

      if (closeIdx === null) {
        issues.push({
          severity: "ERROR" as Severity,
          code: "UNMATCHED_CONDITIONAL",
          message: `'[IF ${conditionDisplay}]' has no matching '[/IF]'.`,
          location: sectionLabel,
        });
        tagManager.flagReview(conditionDisplay, sectionLabel);
        out.push(tok.full);
        cursor = tok.end;
        i += 1;
        continue;
      }

      const bodyRaw = splitConditionBody(text, tokens, i, closeIdx);
      const bodyConverted = convertBrackets(
        bodyRaw,
        ctx,
        tagManager,
        log,
        issues,
        knownConditions,
        sectionLabel,
        approvedDictionary,
      );
      const openTag = `<% data_insert_true(${condName}) %>`;
      const closeTag = "<% /data_insert_true() %>";
      out.push(openTag, bodyConverted, closeTag);
      tagManager.registerConditional(condName, openTag, closeTag, sectionLabel);
      log.record("conditional", `[IF ${conditionDisplay}] ... [/IF]`, `${openTag} ... ${closeTag}`);
      cursor = tokens[closeIdx].end;
      i = closeIdx + 1;
      continue;
    }

    if (IF_CLOSE_RE.test(stripped)) {
      issues.push({
        severity: "ERROR" as Severity,
        code: "UNMATCHED_CLOSE",
        message: "Found '[/IF]' with no matching '[IF ...]'.",
        location: sectionLabel,
      });
      out.push(tok.full);
      cursor = tok.end;
      i += 1;
      continue;
    }

    const precedingContext = text.slice(Math.max(0, tok.index - 80), tok.index);

    if (isInstructionOnly(inner)) {
      const resolution = convertGenericPlaceholder(inner, ctx, precedingContext, approvedDictionary);
      out.push(resolution.mmd);
      log.record(resolution.matchedRule, tok.full, resolution.mmd);
    } else if (looksLikeBareMarker(inner, knownConditions)) {
      issues.push({
        severity: "WARNING" as Severity,
        code: "AMBIGUOUS_CONDITION_SCOPE",
        message: `Ambiguous marker '${tok.full}' -- scope could not be determined automatically and requires manual confirmation.`,
        location: sectionLabel,
      });
      tagManager.flagReview(inner, sectionLabel);
      const reviewComment = `<%-- REVIEW REQUIRED: ambiguous marker ${tok.full} --%>`;
      out.push(reviewComment);
      log.record("bare_marker_review", tok.full, reviewComment);
    } else {
      const resolution = convertGenericPlaceholder(inner, ctx, precedingContext, approvedDictionary);
      out.push(resolution.mmd);
      if (resolution.tagName) {
        tagManager.registerTag(
          resolution.tagName,
          resolution.mmd,
          (resolution.tagType ?? "Data") as TagType,
          (resolution.status ?? "Review") as TagStatus,
          sectionLabel,
          tok.full,
        );
      }
      log.record(resolution.matchedRule, tok.full, resolution.mmd);
    }

    cursor = tok.end;
    i += 1;
  }

  if (cursor < text.length) out.push(text.slice(cursor));

  return out.join("");
}
