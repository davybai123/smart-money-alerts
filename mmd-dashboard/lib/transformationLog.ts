// Transformation audit trail (Section 36). Port of transformation_log.py.

import type { TransformationEntry } from "./models";

export class TransformationLog {
  private entriesList: TransformationEntry[] = [];

  record(rule: string, raw: string, became: string, reason = ""): void {
    this.entriesList.push({
      index: this.entriesList.length + 1,
      rule,
      raw,
      became,
      reason: reason || undefined,
    });
  }

  entries(): TransformationEntry[] {
    return [...this.entriesList];
  }

  toText(): string {
    return this.entriesList
      .map((e) => {
        let line = `[${e.index}] (${e.rule}) RAW: ${JSON.stringify(e.raw)} -> BECAME: ${JSON.stringify(e.became)}`;
        if (e.reason) line += `  # ${e.reason}`;
        return line;
      })
      .join("\n");
  }
}
