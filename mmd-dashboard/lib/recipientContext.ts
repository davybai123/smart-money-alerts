// Letter-type detection and recipient context resolution.
// Port of mmd_generator/recipient_context.py (Sections 2-5, 31-32).

import type { LetterType } from "./models";
import { fieldsFor, type FieldMap } from "./protectedTags";

const DEPENDANT_MARKERS = ["dependant_title_guess", "dependant_forename", "dependant_surname"];
const MEMBER_MARKERS = ["member_title_guess", "member_forename", "member_surname"];

const TAG_RE = /<%\s*([a-zA-Z0-9_]+)\s*%>/g;

export const DETECTION_WINDOW_CHARS = 1500;

export const HEADER_PRESENT_RE = /^\s*Recipient\s*:/im;
export const GREETING_PRESENT_RE = /^\s*Dear\s/im;

function findMarkers(text: string, markers: string[]): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(TAG_RE)) {
    if (markers.includes(m[1])) found.push(m[1]);
  }
  return found;
}

export interface DetectionResult {
  detected: LetterType | null;
  matches: string[];
}

export function detectLetterType(
  rawText: string,
  scanChars: number = DETECTION_WINDOW_CHARS,
): DetectionResult {
  const head = rawText.slice(0, scanChars);
  const dependantHits = findMarkers(head, DEPENDANT_MARKERS);
  const memberHits = findMarkers(head, MEMBER_MARKERS);

  if (dependantHits.length && memberHits.length) {
    return { detected: null, matches: [...dependantHits, ...memberHits] };
  }
  if (dependantHits.length) return { detected: "DEPENDANT", matches: dependantHits };
  if (memberHits.length) return { detected: "MEMBER", matches: memberHits };
  return { detected: null, matches: [] };
}

export function hasHeaderBlock(rawText: string, scanChars = 600): boolean {
  return HEADER_PRESENT_RE.test(rawText.slice(0, scanChars));
}

export function hasGreetingLine(rawText: string, scanChars = 2000): boolean {
  return GREETING_PRESENT_RE.test(rawText.slice(0, scanChars));
}

export class RecipientContext {
  letterType: LetterType;

  constructor(letterType: LetterType) {
    this.letterType = letterType;
  }

  get prefix(): string {
    return this.letterType === "MEMBER" ? "member" : "dependant";
  }

  get fields(): FieldMap {
    return fieldsFor(this.letterType);
  }

  get titleTag() {
    return this.fields.title;
  }
  get forenameTag() {
    return this.fields.forename;
  }
  get surnameTag() {
    return this.fields.surname;
  }
  get addressTag() {
    return this.fields.address;
  }
  get postcodeTag() {
    return this.fields.postcode;
  }
  get idTag() {
    return this.fields.id;
  }

  envelopeBlock(): string {
    return [
      `Recipient:                      <% ${this.titleTag} %> <% ${this.forenameTag} %> <% ${this.surnameTag} %>`,
      `Recipient Address:              <% ${this.addressTag} %>`,
      `Recipient Postcode:             <% ${this.postcodeTag} %>`,
      "Document Date:                  <% current_date_l %>",
      `Header Text:                    <% scheme_name_quick %> - <% ${this.idTag} %>`,
    ].join("\n");
  }

  greetingBlock(): string {
    const lines = [`Dear <% ${this.titleTag} %> <% ${this.surnameTag} %>,`, "<% vspace %>"];
    if (this.letterType === "MEMBER") {
      lines.push("**<% scheme_name %> (''the Scheme\")");
    }
    return lines.join("\n");
  }

  headerBlock(): string {
    return this.envelopeBlock() + "\n" + this.greetingBlock();
  }
}

export interface TypeConflict {
  selected: LetterType;
  detected: LetterType | null;
  matchedTags: string[];
  message: string;
}

export function checkTypeConflict(selected: LetterType, rawText: string): TypeConflict | null {
  const { detected, matches } = detectLetterType(rawText);
  if (detected !== null && detected !== selected) {
    return {
      selected,
      detected,
      matchedTags: matches,
      message:
        "The selected letter type appears to conflict with the detected recipient fields.",
    };
  }
  return null;
}
