"""Placeholder and name-reference conversion (Sections 6, 9, 20, 45-48).

Two independent jobs live here, mirroring the original generator's
``convert_paren_placeholders`` / ``_clean_placeholder_field`` functions:

1. ``convert_paren_placeholders`` -- recognise parenthesis/word-style name
   references such as ``Mr(Title)``, ``(Title) (Surname)``,
   ``Mr Title Surname`` or ``Dear Mr Surname`` and rewrite them using the
   correct member/dependant recipient tags.
2. ``convert_generic_placeholder`` -- resolve the contents of a single
   square-bracket placeholder (already extracted by ``conditionals.py``)
   into MMD, following the system-tag-priority order from Section 48.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable, List, Optional, Tuple

from .models import TagStatus, TagType
from .protected_tags import DEFAULT_APPROVED_TAG_DICTIONARY
from .recipient_context import RecipientContext
from .tag_normaliser import (
    INSTRUCTION_ONLY_MARKERS,
    SMART_FIELD_MAP,
    is_instruction_only,
    normalise_tag_name,
    recognise_concept,
    strip_instructional_wording,
)

# ---------------------------------------------------------------------------
# 1. Parenthesis / bare-word name-reference conversion (Section 6)
# ---------------------------------------------------------------------------

_HON = r"(?:Mr|Mrs|Miss|Ms|Dr|Rev)\.?"
_TITLE_P = r"\(\s*Title\s*\)"
_FORE_P = r"\(\s*(?:Forename|Christian\s*Name)\s*\)"
_SUR_P = r"\(\s*Surname\s*\)"

# Ordered most-specific-first so a 3-component match is claimed before a
# 2-component or 1-component pattern can partially match the same text. Each
# parenthesised pattern also consumes (and discards) an optional leading
# honorific example word -- e.g. "Mr(Title) (Surname)" -> title + surname,
# not "Mr" left dangling in front of the converted tags.
_NAME_REF_PATTERNS: List[Tuple[re.Pattern, Tuple[str, ...]]] = [
    # "(Title) (Forename) (Surname)", optionally preceded by "Mr"/"Mrs"/etc.
    (re.compile(rf"(?:{_HON}\s*)?{_TITLE_P}\s*{_FORE_P}\s*{_SUR_P}"), ("title", "forename", "surname")),
    # "(Title) (Surname)", optionally preceded by "Mr"/"Mrs"/etc.
    (re.compile(rf"(?:{_HON}\s*)?{_TITLE_P}\s*{_SUR_P}"), ("title", "surname")),
    # "Mr(Title)" / "Mrs(Title)" -- honorific example text directly before a
    # title placeholder; only the title component is actually present.
    (re.compile(rf"{_HON}\s*{_TITLE_P}"), ("title",)),
    # "Mr Title Surname" -- bare literal placeholder words after an example
    # honorific.
    (re.compile(rf"\b{_HON}\s+Title\s+Surname\b"), ("title", "surname")),
    # "Dear Mr Surname" -- the honorific itself stands in for the title
    # placeholder, paired with a bare Surname placeholder word.
    (re.compile(rf"\b{_HON}\s+Surname\b"), ("title", "surname")),
]


def convert_paren_placeholders(text: str, ctx: RecipientContext, log=None) -> str:
    """Convert parenthesis/word-style recipient-name references to MMD tags.

    Only text that matches one of the well-defined name-reference shapes
    from Section 6 is touched; ordinary prose containing the words "member"
    or "Mr" is left completely alone (Section 45).
    """
    result = text
    for pattern, components in _NAME_REF_PATTERNS:

        def _sub(m: re.Match, components=components) -> str:
            tags = " ".join(f"<% {ctx.fields[c]} %>" for c in components)
            if log is not None:
                log.record("name_reference", m.group(0), tags)
            return tags

        result = pattern.sub(_sub, result)
    return result


def _clean_placeholder_field(raw_inner: str) -> str:
    """Clean the raw text inside a square-bracket placeholder before tag
    generation (Section 9): strip instructional wording and stray
    punctuation left over from a label like ``Insert Date of Birth:``."""
    text = raw_inner.strip()
    text = strip_instructional_wording(text)
    return text.strip(" :-–—")


# ---------------------------------------------------------------------------
# 2. Generic square-bracket data-placeholder resolution (Sections 9, 20, 46-48)
# ---------------------------------------------------------------------------

# Section 47: bracket contents so generic that the surrounding text must be
# consulted to disambiguate them (e.g. "[Date]" could mean the document date
# or a date of birth depending on context).
_AMBIGUOUS_BARE_FIELDS = {"date", "amount", "number", "name"}

# (pattern searched in the ~80 chars preceding the bracket, resolved concept)
# concept "__current_date__" means "use the current_date_l system tag".
_CONTEXT_HINTS: List[Tuple[re.Pattern, str]] = [
    (re.compile(r"(?i)(this )?letter is dated|dated this|date of this letter"), "__current_date__"),
    (re.compile(r"(?i)date of birth"), "date of birth"),
    (re.compile(r"(?i)retirement date|date of retirement"), "retirement date"),
    (re.compile(r"(?i)commencement date|pension commencement"), "pension commencement date"),
    (re.compile(r"(?i)national insurance"), "national insurance number"),
    (re.compile(r"(?i)pension amount|pension of"), "pension amount"),
]


def _resolve_ambiguous_bare_field(cleaned_lower: str, preceding_context: str):
    if cleaned_lower not in _AMBIGUOUS_BARE_FIELDS:
        return None
    for pattern, concept in _CONTEXT_HINTS:
        if pattern.search(preceding_context):
            if concept == "__current_date__":
                return ("current_date_l", TagType.SYSTEM, TagStatus.EXISTING)
            canonical = SMART_FIELD_MAP.get(concept)
            if canonical:
                return (canonical, TagType.DATA, TagStatus.NEEDS_CREATION)
    return None


@dataclass
class PlaceholderResolution:
    mmd: str
    tag_name: str
    tag_type: Optional[TagType]
    status: Optional[TagStatus]
    matched_rule: str


def convert_generic_placeholder(
    inner: str,
    ctx: RecipientContext,
    preceding_context: str = "",
    approved_dictionary=None,
) -> PlaceholderResolution:
    """Resolve a single non-conditional square-bracket placeholder to MMD.

    Priority order (Section 48):
      1. Existing exact MMD system tag / approved dictionary mapping
      2. Recognised smart-field concept
      3. New ``data_l()`` tag
      4. Manual review (uninterpretable or an authoring instruction)
    """
    approved_dictionary = approved_dictionary or DEFAULT_APPROVED_TAG_DICTIONARY
    cleaned = _clean_placeholder_field(inner)
    if not cleaned:
        return PlaceholderResolution(
            mmd=f"<%-- REVIEW REQUIRED: empty placeholder '[{inner}]' --%>",
            tag_name="",
            tag_type=None,
            status=TagStatus.REVIEW,
            matched_rule="empty_placeholder",
        )

    # Section 46: authoring instructions are never data fields.
    if is_instruction_only(cleaned):
        return PlaceholderResolution(
            mmd=f"<%-- REVIEW REQUIRED: authoring note '[{inner}]', not a data field --%>",
            tag_name="",
            tag_type=None,
            status=TagStatus.REVIEW,
            matched_rule="instruction_only",
        )

    key = " ".join(cleaned.lower().split())

    # Priority 1: approved dictionary / existing system tag.
    if key in approved_dictionary:
        target = approved_dictionary[key]
        resolved = target.format(ctx=ctx.prefix) if "{ctx}" in target else target
        return PlaceholderResolution(
            mmd=f"<% {resolved} %>",
            tag_name=resolved,
            tag_type=TagType.SYSTEM,
            status=TagStatus.EXISTING,
            matched_rule="approved_dictionary",
        )

    # Section 47: context-sensitive disambiguation for very generic labels.
    ambiguous = _resolve_ambiguous_bare_field(key, preceding_context)
    if ambiguous:
        tag_name, tag_type, status = ambiguous
        if tag_type == TagType.SYSTEM:
            return PlaceholderResolution(
                mmd=f"<% {tag_name} %>",
                tag_name=tag_name,
                tag_type=tag_type,
                status=status,
                matched_rule="context_resolved_system_tag",
            )
        return PlaceholderResolution(
            mmd=f"<% data_l({tag_name}) %>",
            tag_name=tag_name,
            tag_type=tag_type,
            status=status,
            matched_rule="context_resolved_data_tag",
        )
    if key in _AMBIGUOUS_BARE_FIELDS:
        # Too generic and no surrounding context resolved it -- do not guess.
        return PlaceholderResolution(
            mmd=f"<%-- REVIEW REQUIRED: ambiguous placeholder '[{inner}]' --%>",
            tag_name="",
            tag_type=None,
            status=TagStatus.REVIEW,
            matched_rule="ambiguous_unresolved",
        )

    # Priority 2: recognised smart-field concept.
    concept = recognise_concept(cleaned)
    if concept:
        return PlaceholderResolution(
            mmd=f"<% data_l({concept}) %>",
            tag_name=concept,
            tag_type=TagType.DATA,
            status=TagStatus.NEEDS_CREATION,
            matched_rule="smart_field_recognition",
        )

    # Priority 3: fall back to a freshly normalised data tag.
    tag_name = normalise_tag_name(cleaned)
    if not tag_name:
        return PlaceholderResolution(
            mmd=f"<%-- REVIEW REQUIRED: unable to interpret '[{inner}]' --%>",
            tag_name="",
            tag_type=None,
            status=TagStatus.REVIEW,
            matched_rule="uninterpretable",
        )
    return PlaceholderResolution(
        mmd=f"<% data_l({tag_name}) %>",
        tag_name=tag_name,
        tag_type=TagType.DATA,
        status=TagStatus.NEEDS_CREATION,
        matched_rule="generic_data_tag",
    )
