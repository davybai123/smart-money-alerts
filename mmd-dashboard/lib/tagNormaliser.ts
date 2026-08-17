// Tag-name normalisation, smart field recognition and duplicate detection.
// Port of mmd_generator/tag_normaliser.py (Sections 7, 9, 18, 19, 20).

const INSTRUCTIONAL_WORDS = new Set([
  "insert",
  "click",
  "to",
  "add",
  "here",
  "enter",
  "please",
  "select",
  "choose",
  "type",
  "your",
]);

const JOINERS = new Set(["of", "the", "and", "or", "for", "a", "an", "to", "in", "on"]);

export const INSTRUCTION_ONLY_MARKERS = new Set([
  "note",
  "notes",
  "instruction",
  "instructions",
  "drafting note",
  "comment",
  "comments",
  "guidance",
  "internal",
  "internal use only",
  "tbc",
  "tbd",
  "placeholder",
  "for review",
  "draft note",
  "author note",
]);

export function stripInstructionalWording(raw: string): string {
  const words = raw
    .split(/\s+/)
    .filter((w) => !INSTRUCTIONAL_WORDS.has(w.toLowerCase().replace(/[.,:;]+$/, "")));
  const cleaned = words.join(" ").trim();
  return cleaned || raw.trim();
}

export function normaliseTagName(raw: string): string {
  const cleaned = stripInstructionalWording(raw);
  const parts = cleaned.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (parts.length === 0) return "";
  const outWords = parts.map((word, i) => {
    const lower = word.toLowerCase();
    if (i !== 0 && JOINERS.has(lower)) return lower;
    return word[0].toUpperCase() + word.slice(1);
  });
  return outWords.join("_");
}

export function isInstructionOnly(raw: string): boolean {
  const key = raw.trim().toLowerCase().split(/\s+/).join(" ");
  return INSTRUCTION_ONLY_MARKERS.has(key);
}

export const SMART_FIELD_MAP: Record<string, string> = {
  "date of birth": "Date_of_Birth",
  "member date of birth": "Member_Date_of_Birth",
  "national insurance number": "National_Insurance_Number",
  "national insurance no": "National_Insurance_Number",
  "ni number": "National_Insurance_Number",
  nino: "National_Insurance_Number",
  "pension amount": "Pension_Amount",
  "pension commencement date": "Pension_Commencement_Date",
  "retirement date": "Retirement_Date",
  "date of retirement": "Retirement_Date",
  "bank account number": "Bank_Account_Number",
  "sort code": "Sort_Code",
  "member number": "Member_Number",
  "gmp amount": "GMP_Amount",
};

export function recogniseConcept(raw: string): string | null {
  const key = raw.trim().toLowerCase().split(/\s+/).join(" ");
  return SMART_FIELD_MAP[key] ?? null;
}

const SYNONYM_CLUSTERS: string[][] = [
  ["date_of_birth", "dob", "birth_date", "d_o_b", "date_of_birth_dob"],
  ["national_insurance_number", "ni_number", "nino"],
  ["pension_amount", "pension_amt"],
  ["member_number", "member_id", "member_reference"],
  ["retirement_date", "date_of_retirement"],
];

function canonicalKey(tagName: string): string {
  return tagName.trim().toLowerCase().replace(/\s+/g, "_");
}

// Plain-JS Levenshtein-ratio approximation of Python's
// difflib.SequenceMatcher.ratio() (2*M / T, M = matching chars via LCS-ish
// longest common subsequence length approximation using edit distance).
function similarityRatio(a: string, b: string): number {
  if (a === b) return 1;
  const la = a.length;
  const lb = b.length;
  if (la === 0 || lb === 0) return 0;
  const dp: number[][] = Array.from({ length: la + 1 }, () => new Array(lb + 1).fill(0));
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const lcs = dp[la][lb];
  return (2 * lcs) / (la + lb);
}

export function findPotentialDuplicates(
  tagNames: string[],
  similarityThreshold = 0.82,
): string[][] {
  const remaining = Array.from(new Set(tagNames));
  const groups: string[][] = [];
  const used = new Set<string>();

  for (const cluster of SYNONYM_CLUSTERS) {
    const hits = remaining.filter((t) => cluster.includes(canonicalKey(t)));
    if (hits.length > 1) {
      groups.push(hits);
      hits.forEach((h) => used.add(h));
    }
  }

  const unclustered = remaining.filter((t) => !used.has(t));
  for (let i = 0; i < unclustered.length; i++) {
    const a = unclustered[i];
    if (used.has(a)) continue;
    const group = [a];
    for (let j = i + 1; j < unclustered.length; j++) {
      const b = unclustered[j];
      if (used.has(b)) continue;
      if (similarityRatio(canonicalKey(a), canonicalKey(b)) >= similarityThreshold) {
        group.push(b);
      }
    }
    if (group.length > 1) {
      groups.push(group);
      group.forEach((g) => used.add(g));
    }
  }

  return groups;
}
