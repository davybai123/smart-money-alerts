// Placeholder and name-reference conversion (Sections 6, 9, 20, 45-48).
// Port of mmd_generator/placeholders.py.

import type { TagStatus, TagType } from "./models";
import { DEFAULT_APPROVED_TAG_DICTIONARY } from "./protectedTags";
import type { RecipientContext } from "./recipientContext";
import {
  isInstructionOnly,
  normaliseTagName,
  recogniseConcept,
  SMART_FIELD_MAP,
  stripInstructionalWording,
} from "./tagNormaliser";
import type { TransformationLog } from "./transformationLog";

// ---------------------------------------------------------------------------
// 1. Parenthesis / bare-word name-reference conversion (Section 6)
// ---------------------------------------------------------------------------

const HON = String.raw`(?:Mr|Mrs|Miss|Ms|Dr|Rev)\.?`;
const TITLE_P = String.raw`\(\s*Title\s*\)`;
const FORE_P = String.raw`\(\s*(?:Forename|Christian\s*Name)\s*\)`;
const SUR_P = String.raw`\(\s*Surname\s*\)`;

type NameComponent = "title" | "forename" | "surname";

// Ordered most-specific-first, mirroring conditionals.py's priority list.
// Each parenthesised pattern also consumes (and discards) an optional
// leading honorific example word.
const NAME_REF_PATTERNS: Array<{ re: RegExp; components: NameComponent[] }> = [
  { re: new RegExp(`(?:${HON}\\s*)?${TITLE_P}\\s*${FORE_P}\\s*${SUR_P}`, "g"), components: ["title", "forename", "surname"] },
  { re: new RegExp(`(?:${HON}\\s*)?${TITLE_P}\\s*${SUR_P}`, "g"), components: ["title", "surname"] },
  { re: new RegExp(`${HON}\\s*${TITLE_P}`, "g"), components: ["title"] },
  { re: new RegExp(String.raw`\b${HON}\s+Title\s+Surname\b`, "g"), components: ["title", "surname"] },
  { re: new RegExp(String.raw`\b${HON}\s+Surname\b`, "g"), components: ["title", "surname"] },
];

export function convertParenPlaceholders(
  text: string,
  ctx: RecipientContext,
  log?: TransformationLog,
): string {
  let result = text;
  for (const { re, components } of NAME_REF_PATTERNS) {
    result = result.replace(re, (match) => {
      const tags = components.map((c) => `<% ${ctx.fields[c]} %>`).join(" ");
      log?.record("name_reference", match, tags);
      return tags;
    });
  }
  return result;
}

function cleanPlaceholderField(rawInner: string): string {
  let text = rawInner.trim();
  text = stripInstructionalWording(text);
  return text.replace(/^[\s:\-\u2013\u2014]+|[\s:\-\u2013\u2014]+$/g, "");
}

// ---------------------------------------------------------------------------
// 2. Generic square-bracket data-placeholder resolution (Sections 9, 20, 46-48)
// ---------------------------------------------------------------------------

const AMBIGUOUS_BARE_FIELDS = new Set(["date", "amount", "number", "name"]);

const CONTEXT_HINTS: Array<{ re: RegExp; concept: string }> = [
  { re: /(this )?letter is dated|dated this|date of this letter/i, concept: "__current_date__" },
  { re: /date of birth/i, concept: "date of birth" },
  { re: /retirement date|date of retirement/i, concept: "retirement date" },
  { re: /commencement date|pension commencement/i, concept: "pension commencement date" },
  { re: /national insurance/i, concept: "national insurance number" },
  { re: /pension amount|pension of/i, concept: "pension amount" },
];

function resolveAmbiguousBareField(
  cleanedLower: string,
  precedingContext: string,
): { tagName: string; tagType: TagType; status: TagStatus } | null {
  if (!AMBIGUOUS_BARE_FIELDS.has(cleanedLower)) return null;
  for (const { re, concept } of CONTEXT_HINTS) {
    if (re.test(precedingContext)) {
      if (concept === "__current_date__") {
        return { tagName: "current_date_l", tagType: "System", status: "Existing" };
      }
      const canonical = SMART_FIELD_MAP[concept];
      if (canonical) return { tagName: canonical, tagType: "Data", status: "Needs Creation" };
    }
  }
  return null;
}

export interface PlaceholderResolution {
  mmd: string;
  tagName: string;
  tagType: TagType | null;
  status: TagStatus | null;
  matchedRule: string;
}

export function convertGenericPlaceholder(
  inner: string,
  ctx: RecipientContext,
  precedingContext = "",
  approvedDictionary: Record<string, string> = DEFAULT_APPROVED_TAG_DICTIONARY,
): PlaceholderResolution {
  const cleaned = cleanPlaceholderField(inner);
  if (!cleaned) {
    return {
      mmd: `<%-- REVIEW REQUIRED: empty placeholder '[${inner}]' --%>`,
      tagName: "",
      tagType: null,
      status: "Review",
      matchedRule: "empty_placeholder",
    };
  }

  if (isInstructionOnly(cleaned)) {
    return {
      mmd: `<%-- REVIEW REQUIRED: authoring note '[${inner}]', not a data field --%>`,
      tagName: "",
      tagType: null,
      status: "Review",
      matchedRule: "instruction_only",
    };
  }

  const key = cleaned.toLowerCase().trim().split(/\s+/).join(" ");

  if (key in approvedDictionary) {
    const target = approvedDictionary[key];
    const resolved = target.includes("{ctx}") ? target.replace("{ctx}", ctx.prefix) : target;
    return {
      mmd: `<% ${resolved} %>`,
      tagName: resolved,
      tagType: "System",
      status: "Existing",
      matchedRule: "approved_dictionary",
    };
  }

  const ambiguous = resolveAmbiguousBareField(key, precedingContext);
  if (ambiguous) {
    const { tagName, tagType, status } = ambiguous;
    if (tagType === "System") {
      return { mmd: `<% ${tagName} %>`, tagName, tagType, status, matchedRule: "context_resolved_system_tag" };
    }
    return {
      mmd: `<% data_l(${tagName}) %>`,
      tagName,
      tagType,
      status,
      matchedRule: "context_resolved_data_tag",
    };
  }
  if (AMBIGUOUS_BARE_FIELDS.has(key)) {
    return {
      mmd: `<%-- REVIEW REQUIRED: ambiguous placeholder '[${inner}]' --%>`,
      tagName: "",
      tagType: null,
      status: "Review",
      matchedRule: "ambiguous_unresolved",
    };
  }

  const concept = recogniseConcept(cleaned);
  if (concept) {
    return {
      mmd: `<% data_l(${concept}) %>`,
      tagName: concept,
      tagType: "Data",
      status: "Needs Creation",
      matchedRule: "smart_field_recognition",
    };
  }

  const tagName = normaliseTagName(cleaned);
  if (!tagName) {
    return {
      mmd: `<%-- REVIEW REQUIRED: unable to interpret '[${inner}]' --%>`,
      tagName: "",
      tagType: null,
      status: "Review",
      matchedRule: "uninterpretable",
    };
  }
  return {
    mmd: `<% data_l(${tagName}) %>`,
    tagName,
    tagType: "Data",
    status: "Needs Creation",
    matchedRule: "generic_data_tag",
  };
}
