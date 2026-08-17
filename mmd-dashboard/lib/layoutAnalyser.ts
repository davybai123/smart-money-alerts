// Page-layout / space-awareness analysis (Sections 21-24).
// Port of mmd_generator/layout_analyser.py.

import type { DocumentSection, LayoutWarning } from "./models";
import type { PageBreakConfig } from "./pageManager";

const KEEP_WHOLE_KINDS = new Set(["heading", "table", "list", "signature"]);
const ORPHAN_HEADING_MARGIN = 2;

function snippet(text: string, limit = 60): string {
  const flat = text.split(/\s+/).join(" ");
  return flat.length > limit ? flat.slice(0, limit) + "..." : flat;
}

export interface LayoutAnalysis {
  warnings: LayoutWarning[];
  confidence: number;
  recommendBreakBefore: string[];
}

export function analyseLayout(sections: DocumentSection[], config: PageBreakConfig): LayoutAnalysis {
  const warnings: LayoutWarning[] = [];
  const recommendBreakBefore: string[] = [];
  const lpp = Math.max(1, config.linesPerPage);

  let pagePos = 0;
  let prevKind: string | null = null;

  for (const sec of sections) {
    const length = Math.max(1, sec.estimatedLines);
    const remaining = lpp - pagePos;

    if (KEEP_WHOLE_KINDS.has(sec.kind) && config.keepSectionsTogether) {
      if (length > lpp) {
        warnings.push({
          severity: "WARNING",
          message: `${sec.kind[0].toUpperCase()}${sec.kind.slice(1)} is longer than a full page and will span multiple pages.`,
          section: snippet(sec.text),
        });
        pagePos = length % lpp;
      } else if (length > remaining) {
        if (remaining <= ORPHAN_HEADING_MARGIN && sec.kind === "heading") {
          warnings.push({
            severity: "WARNING",
            message: `Heading may be orphaned near a page boundary: '${snippet(sec.text)}'.`,
            section: snippet(sec.text),
          });
        } else if (sec.kind === "table") {
          warnings.push({
            severity: "WARNING",
            message: `Table may split across pages: '${snippet(sec.text)}'.`,
            section: snippet(sec.text),
          });
        } else if (sec.kind === "signature" && prevKind === "paragraph") {
          warnings.push({
            severity: "WARNING",
            message: "Signature block may move to next page, separated from the closing text.",
            section: snippet(sec.text),
          });
        } else if (sec.kind === "list") {
          warnings.push({
            severity: "WARNING",
            message: `List may split across pages: '${snippet(sec.text)}'.`,
            section: snippet(sec.text),
          });
        }
        recommendBreakBefore.push(sec.text);
        pagePos = length;
      } else {
        pagePos += length;
      }
    } else {
      if (sec.kind === "conditional" && length > lpp) {
        warnings.push({
          severity: "WARNING",
          message: "Conditional section may cause unexpected page overflow due to its length.",
          section: snippet(sec.text),
        });
      }
      pagePos = (pagePos + length) % lpp;
    }

    prevKind = sec.kind;
  }

  if (warnings.length === 0) {
    warnings.push({ severity: "INFO", message: "Page structure looks safe." });
  }

  const penalised = warnings.filter((w) => w.severity === "WARNING").length;
  const confidence = Math.max(0, 100 - 8 * penalised);

  return { warnings, confidence, recommendBreakBefore };
}
