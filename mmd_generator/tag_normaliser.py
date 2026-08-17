"""Tag-name normalisation, smart field recognition and duplicate detection.

Covers Sections 7, 9, 18, 19 and 20 of the spec: underscore normalisation,
instructional-word stripping, "understands common concepts" field
recognition, and fuzzy/synonym-based duplicate-tag detection.
"""
from __future__ import annotations

import difflib
import re
from typing import Dict, List, Optional

# Section 9: instructional wording that should be dropped from a raw
# placeholder before it becomes a tag name (e.g. "Insert Date of Birth" ->
# "Date of Birth").
_INSTRUCTIONAL_WORDS = {
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
}

_WORD_SPLIT_RE = re.compile(r"[^A-Za-z0-9]+")

# Lower-case joining words that stay lower-case inside a generated tag name,
# e.g. "Date of Birth" -> "Date_of_Birth", not "Date_Of_Birth".
_JOINERS = {"of", "the", "and", "or", "for", "a", "an", "to", "in", "on"}

# Section 46: bracket contents that are clearly authoring instructions
# rather than data fields, and must never become a data_l() tag.
INSTRUCTION_ONLY_MARKERS = {
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
}


def strip_instructional_wording(raw: str) -> str:
    """Remove standalone instructional words (Section 9)."""
    words = [w for w in raw.split() if w.lower().strip(".,:;") not in _INSTRUCTIONAL_WORDS]
    cleaned = " ".join(words).strip()
    return cleaned or raw.strip()


def normalise_tag_name(raw: str) -> str:
    """Turn arbitrary free text into an ``Upper_Case_With_Underscores`` tag
    name (Section 7, 19).

    Examples::

        'date of birth'             -> 'Date_of_Birth'
        'Member Date of Birth'      -> 'Member_Date_of_Birth'
        'Pension Commencement Date' -> 'Pension_Commencement_Date'
        '[Bank Account Number]'     -> 'Bank_Account_Number'
    """
    cleaned = strip_instructional_wording(raw)
    parts = [p for p in _WORD_SPLIT_RE.split(cleaned) if p]
    if not parts:
        return ""
    out_words = []
    for i, word in enumerate(parts):
        lower = word.lower()
        if i != 0 and lower in _JOINERS:
            out_words.append(lower)
        else:
            out_words.append(word[:1].upper() + word[1:])
    return "_".join(out_words)


def is_instruction_only(raw: str) -> bool:
    """Section 46: detect authoring instructions such as ``[NOTE]`` that
    must never be silently converted into a data tag."""
    key = " ".join(raw.strip().lower().split())
    return key in INSTRUCTION_ONLY_MARKERS


# Section 20: smart field recognition. Concept (normalised, lower-case,
# whitespace-collapsed) -> canonical tag name. Only concepts we are
# confident about live here; anything else falls through to generic
# normalisation or manual review.
SMART_FIELD_MAP: Dict[str, str] = {
    "date of birth": "Date_of_Birth",
    "member date of birth": "Member_Date_of_Birth",
    "national insurance number": "National_Insurance_Number",
    "national insurance no": "National_Insurance_Number",
    "ni number": "National_Insurance_Number",
    "nino": "National_Insurance_Number",
    "pension amount": "Pension_Amount",
    "pension commencement date": "Pension_Commencement_Date",
    "retirement date": "Retirement_Date",
    "date of retirement": "Retirement_Date",
    "bank account number": "Bank_Account_Number",
    "sort code": "Sort_Code",
    "member number": "Member_Number",
    "gmp amount": "GMP_Amount",
}


def recognise_concept(raw: str) -> Optional[str]:
    key = " ".join(raw.strip().lower().split())
    return SMART_FIELD_MAP.get(key)


# Section 18: known synonym clusters, so e.g. DOB / Date_of_Birth /
# Birth_Date are recognised as the same logical field even though the raw
# strings differ.
_SYNONYM_CLUSTERS: List[List[str]] = [
    ["date_of_birth", "dob", "birth_date", "d_o_b", "date_of_birth_dob"],
    ["national_insurance_number", "ni_number", "nino"],
    ["pension_amount", "pension_amt"],
    ["member_number", "member_id", "member_reference"],
    ["retirement_date", "date_of_retirement"],
]


def _canonical_key(tag_name: str) -> str:
    return tag_name.strip().lower().replace(" ", "_")


def find_potential_duplicates(
    tag_names: List[str], similarity_threshold: float = 0.82
) -> List[List[str]]:
    """Group tag names that are likely the same logical field (Section 18).

    Returns a list of duplicate groups (each with 2+ members), combining
    known synonym clusters with fuzzy string similarity on the normalised
    name. Never merges the groups automatically -- callers decide the
    canonical field.
    """
    remaining = list(dict.fromkeys(tag_names))  # de-duplicate, preserve order
    groups: List[List[str]] = []
    used = set()

    for cluster in _SYNONYM_CLUSTERS:
        hits = [t for t in remaining if _canonical_key(t) in cluster]
        if len(hits) > 1:
            groups.append(hits)
            used.update(hits)

    unclustered = [t for t in remaining if t not in used]
    for i, a in enumerate(unclustered):
        if a in used:
            continue
        group = [a]
        for b in unclustered[i + 1 :]:
            if b in used:
                continue
            ratio = difflib.SequenceMatcher(None, _canonical_key(a), _canonical_key(b)).ratio()
            if ratio >= similarity_threshold:
                group.append(b)
        if len(group) > 1:
            groups.append(group)
            used.update(group)

    return groups
