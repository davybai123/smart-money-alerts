// Structural validation engine and export-readiness gate (Sections 27-28, 43).
// Port of mmd_generator/validator.py.

import type { LetterType, ReadinessGate, ValidationIssue } from "./models";
import type { TagManager } from "./tagManager";

const NAME_REF_LEFTOVERS: Array<{ re: RegExp; label: string }> = [
  { re: /\(\s*Title\s*\)/, label: "(Title)" },
  { re: /\(\s*Forename\s*\)/, label: "(Forename)" },
  { re: /\(\s*Surname\s*\)/, label: "(Surname)" },
];

export function findUnmatchedBrackets(text: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const stack: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "[") {
      stack.push(i);
    } else if (ch === "]") {
      if (stack.length) {
        stack.pop();
      } else {
        issues.push({
          severity: "ERROR",
          code: "UNMATCHED_CLOSE_BRACKET",
          message: `Unmatched ']' at character offset ${i}.`,
        });
      }
    }
  }
  for (const i of stack) {
    issues.push({
      severity: "ERROR",
      code: "UNMATCHED_OPEN_BRACKET",
      message: `Unmatched '[' at character offset ${i}.`,
    });
  }
  return issues;
}

export function findLeftoverNamePlaceholders(body: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const { re, label } of NAME_REF_LEFTOVERS) {
    if (re.test(body)) {
      issues.push({
        severity: "WARNING",
        code: "UNRESOLVED_NAME_PLACEHOLDER",
        message: `Unresolved raw placeholder '${label}' remains in the generated MMD.`,
      });
    }
  }
  return issues;
}

export function checkCrossContextTags(body: string, letterType: LetterType): ValidationIssue[] {
  const otherPrefix = letterType === "MEMBER" ? "dependant" : "member";
  const otherFields = [
    `${otherPrefix}_title_guess`,
    `${otherPrefix}_forename`,
    `${otherPrefix}_surname`,
    `${otherPrefix}_address`,
    `${otherPrefix}_postcode_or_foreign_country`,
  ];
  const issues: ValidationIssue[] = [];
  for (const tag of otherFields) {
    const re = new RegExp(`<%\\s*${tag}\\s*%>`);
    if (re.test(body)) {
      issues.push({
        severity: "ERROR",
        code: "CROSS_CONTEXT_TAG",
        message: `Found '<% ${tag} %>' in a ${letterType} letter -- recipient context mismatch.`,
      });
    }
  }
  return issues;
}

export function validateTagsAndConditionals(tagManager: TagManager): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const tag of tagManager.tags()) {
    if (tag.name && tag.name.includes(" ")) {
      issues.push({
        severity: "ERROR",
        code: "SPACE_IN_TAG_NAME",
        message: `Generated tag '${tag.name}' contains a space -- invalid MMD tag name.`,
      });
    }
    if (tag.status === "Needs Creation") {
      issues.push({
        severity: "WARNING",
        code: "TAG_NEEDS_CREATION",
        message: `Tag '${tag.name}' needs creation (${tag.occurrences} occurrence(s)).`,
      });
    }
    if (tag.status === "Duplicate") {
      issues.push({
        severity: "WARNING",
        code: "DUPLICATE_TAG",
        message: `Tag '${tag.name}' may duplicate another field. ${tag.notes}`,
      });
    }
    if (tag.status === "Review") {
      issues.push({
        severity: "WARNING",
        code: "TAG_REVIEW_REQUIRED",
        message: `Tag '${tag.name || "(unresolved)"}' requires manual review.`,
      });
    }
  }
  for (const cond of tagManager.conditionals()) {
    if (!cond.confirmed) {
      issues.push({
        severity: "WARNING",
        code: "CONDITIONAL_SCOPE_UNCONFIRMED",
        message: `Conditional '${cond.name}' requires scope confirmation before export.`,
      });
    }
  }
  return issues;
}

export function computeGate(issues: ValidationIssue[]): ReadinessGate {
  if (issues.some((i) => i.severity === "ERROR")) return "NOT READY";
  if (issues.some((i) => i.severity === "WARNING")) return "REVIEW REQUIRED";
  return "READY";
}
