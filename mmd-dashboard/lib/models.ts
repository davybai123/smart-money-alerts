// Core data model shared across the MMD Letter Generator engine.
// TypeScript port of mmd_generator/models.py (kept in behavioural parity).

export type LetterType = "MEMBER" | "DEPENDANT";

export type TagType = "System" | "Data" | "Conditional";

export type TagStatus =
  | "Existing"
  | "New"
  | "Needs Creation"
  | "Duplicate"
  | "Review"
  | "Invalid";

export type Severity = "ERROR" | "WARNING" | "INFO";

export type ReadinessGate = "NOT READY" | "REVIEW REQUIRED" | "READY";

export interface TagRecord {
  name: string;
  mmdSyntax: string;
  tagType: TagType;
  status: TagStatus;
  occurrences: number;
  locations: string[];
  sourceTexts: string[];
  notes: string;
}

export interface ConditionalRecord {
  name: string;
  mmdOpen: string;
  mmdClose: string;
  occurrences: number;
  sections: string[];
  needsCreation: boolean;
  confirmed: boolean;
  scope: string;
  status: string;
}

export interface TransformationEntry {
  index: number;
  rule: string;
  raw: string;
  became: string;
  reason?: string;
}

export interface ValidationIssue {
  severity: Severity;
  code: string;
  message: string;
  location?: string;
}

export interface LayoutWarning {
  severity: Severity;
  message: string;
  section?: string;
}

export type SectionKind =
  | "heading"
  | "paragraph"
  | "table"
  | "list"
  | "signature"
  | "conditional"
  | "blank";

export interface DocumentSection {
  kind: SectionKind;
  text: string;
  startLine: number;
  endLine: number;
  estimatedLines: number;
}

export interface GenerationResult {
  letterType: LetterType;
  mmdText: string;
  rawText: string;
  tags: TagRecord[];
  conditionals: ConditionalRecord[];
  transformationLog: TransformationEntry[];
  validationIssues: ValidationIssue[];
  layoutWarnings: LayoutWarning[];
  layoutConfidence: number;
  readiness: ReadinessGate;
  detectedType: LetterType | null;
  typeConflict: boolean;
  sections: DocumentSection[];
}

export function hasErrors(result: GenerationResult): boolean {
  return result.validationIssues.some((i) => i.severity === "ERROR");
}

export function hasWarnings(result: GenerationResult): boolean {
  return (
    result.validationIssues.some((i) => i.severity === "WARNING") ||
    result.layoutWarnings.some((w) => w.severity === "WARNING")
  );
}
