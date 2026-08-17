// Page-break configuration and (optional) marker insertion (Section 22-23).
// Port of mmd_generator/page_manager.py.
//
// Never invents MMD page-break syntax: by default nothing is inserted; a
// marker is only stamped in if the user explicitly configures one and
// opts in via `insertBreaks`.

import type { ValidationIssue } from "./models";

export interface PageBreakConfig {
  marker: string | null;
  insertBreaks: boolean;
  linesPerPage: number;
  keepSectionsTogether: boolean;
}

export function defaultPageConfig(): PageBreakConfig {
  return { marker: null, insertBreaks: false, linesPerPage: 45, keepSectionsTogether: true };
}

export function applyPageBreaks(
  body: string,
  recommendedBreakBefore: string[],
  config: PageBreakConfig,
): { body: string; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];

  if (!config.insertBreaks) return { body, issues };

  if (!config.marker) {
    issues.push({
      severity: "WARNING",
      code: "PAGE_BREAK_NOT_CONFIGURED",
      message:
        "Page-break syntax has not been configured; no page breaks were inserted even though layout analysis recommended some. Set a marker in Settings first.",
    });
    return { body, issues };
  }

  let result = body;
  for (const snippet of recommendedBreakBefore) {
    if (snippet && result.includes(snippet)) {
      result = result.replace(snippet, `${config.marker}\n${snippet}`);
    }
  }
  return { body: result, issues };
}
