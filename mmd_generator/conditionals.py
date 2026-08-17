"""Conditional-block ([IF ...] / [/IF]) parsing and MMD conversion.

This is the centrepiece of the generator (Sections 10-13). It retains the
original generator's helper names (``_find_matching_close``,
``_split_condition_body``, ``_clean_condition``, ``convert_brackets``) and
extends them with correct nested-conditional handling, bare-marker safety
detection, and full tag/transformation tracking.

Bracket tokens are matched with ``[^\\[\\]]*`` so a single token never spans
more than one bracket pair -- ``[IF ...]`` and ``[/IF]`` are two *separate*
flat tokens that get paired up like open/close tags (not like nested
parentheses), which is what actually allows correct arbitrary-depth nesting.
"""
from __future__ import annotations

import re
from typing import TYPE_CHECKING, List, Optional, Set

from .models import Severity, TagStatus, TagType, ValidationIssue
from .placeholders import convert_generic_placeholder
from .recipient_context import RecipientContext
from .tag_normaliser import is_instruction_only, normalise_tag_name

if TYPE_CHECKING:  # pragma: no cover
    from .tag_manager import TagManager
    from .transformation_log import TransformationLog

_BRACKET_TOKEN_RE = re.compile(r"\[([^\[\]]*)\]")
_IF_OPEN_RE = re.compile(r"(?i)^IF\s+.+")
_IF_CLOSE_RE = re.compile(r"(?i)^/\s*IF\s*$")


# ---------------------------------------------------------------------------
# Retained low-level helpers (Section 38)
# ---------------------------------------------------------------------------


def _find_matching_close(tokens: List["re.Match[str]"], start_index: int) -> Optional[int]:
    """Given the flat list of bracket-token matches and the index of an
    ``[IF ...]`` open token, return the index of its matching ``[/IF]``
    token, correctly skipping over any nested IF/close pairs in between.
    Returns ``None`` if there is no matching close."""
    depth = 0
    for i in range(start_index, len(tokens)):
        inner = tokens[i].group(1).strip()
        if i == start_index:
            depth = 1
            continue
        if _IF_OPEN_RE.match(inner):
            depth += 1
        elif _IF_CLOSE_RE.match(inner):
            depth -= 1
            if depth == 0:
                return i
    return None


def _split_condition_body(text: str, tokens: List["re.Match[str]"], open_idx: int, close_idx: int) -> str:
    """Return the raw text strictly between a matched IF open/close pair."""
    return text[tokens[open_idx].end() : tokens[close_idx].start()]


def _clean_condition(raw: str) -> str:
    """Strip the leading ``IF`` keyword and surrounding whitespace from a
    raw condition token's inner text, e.g. ``' IF JPS 2015 '`` -> ``'JPS 2015'``."""
    stripped = raw.strip()
    stripped = re.sub(r"(?i)^IF\s+", "", stripped)
    return stripped.strip()


# ---------------------------------------------------------------------------
# Bare conditional marker safety net (Section 13)
# ---------------------------------------------------------------------------


def collect_known_conditions(text: str) -> Set[str]:
    """Scan the whole raw letter for every ``[IF ...]`` condition name so
    later bare-marker detection can recognise a standalone ``[JPS 2015]``
    as referencing a condition defined elsewhere in the document."""
    names: Set[str] = set()
    for m in _BRACKET_TOKEN_RE.finditer(text):
        inner = m.group(1).strip()
        if _IF_OPEN_RE.match(inner):
            names.add(normalise_tag_name(_clean_condition(inner)).lower())
    return names


def looks_like_bare_marker(content: str, known_conditions: Set[str]) -> bool:
    """Section 13: decide whether square-bracket content such as
    ``[ALL SCHEMES]`` or ``[JPS 2015]`` is an ambiguous conditional-scope
    marker whose scope cannot safely be inferred -- as opposed to a plain
    data-field label like ``[Date of Birth]`` or ``[Member Pension Amount]``.

    Deliberately conservative: only flags text that either (a) echoes a
    condition name already declared via ``[IF ...]`` elsewhere, or
    (b) reads like a shouty scheme code (every word is ALL-CAPS or numeric).
    Title-Case field labels are never flagged here.
    """
    stripped = content.strip()
    if not stripped:
        return False
    key = normalise_tag_name(stripped).lower()
    if key and key in known_conditions:
        return True
    words = stripped.split()
    if not words or len(words) > 5:
        return False
    if any(not (w.isupper() or w.isdigit()) for w in words):
        return False
    return any(w.isupper() for w in words)


# ---------------------------------------------------------------------------
# Main conversion entry point
# ---------------------------------------------------------------------------


def convert_brackets(
    text: str,
    ctx: RecipientContext,
    tag_manager: "TagManager",
    log: "TransformationLog",
    issues: List[ValidationIssue],
    known_conditions: Set[str],
    section_label: str = "body",
    approved_dictionary: Optional[dict] = None,
) -> str:
    """Walk every ``[...]`` token in ``text`` and convert it to MMD.

    * ``[IF <condition>] ... [/IF]`` -> ``<% data_insert_true(NAME) %> ... <% /data_insert_true() %>``,
      recursing into the body so nested conditionals are never flattened.
    * Ambiguous bare markers (Section 13) are flagged for manual review and
      left untouched in the output rather than guessed.
    * Everything else is resolved as a generic data placeholder
      (``placeholders.convert_generic_placeholder``).
    * Unmatched ``[IF ...]`` / stray ``[/IF]`` tokens are never silently
      "closed" -- they are left as raw text and reported as validation
      errors so a broken document can never look valid (Section 12, 27).
    """
    tokens = list(_BRACKET_TOKEN_RE.finditer(text))
    out: List[str] = []
    cursor = 0
    i = 0
    while i < len(tokens):
        m = tokens[i]
        inner = m.group(1)
        stripped = inner.strip()

        if m.start() > cursor:
            out.append(text[cursor : m.start()])

        if _IF_OPEN_RE.match(stripped):
            close_idx = _find_matching_close(tokens, i)
            condition_display = _clean_condition(inner)
            cond_name = normalise_tag_name(condition_display)

            if close_idx is None:
                issues.append(
                    ValidationIssue(
                        severity=Severity.ERROR,
                        code="UNMATCHED_CONDITIONAL",
                        message=f"'[IF {condition_display}]' has no matching '[/IF]'.",
                        location=section_label,
                    )
                )
                tag_manager.flag_review(condition_display, section_label)
                out.append(m.group(0))
                cursor = m.end()
                i += 1
                continue

            body_raw = _split_condition_body(text, tokens, i, close_idx)
            body_converted = convert_brackets(
                body_raw, ctx, tag_manager, log, issues, known_conditions, section_label, approved_dictionary
            )
            open_tag = f"<% data_insert_true({cond_name}) %>"
            close_tag = "<% /data_insert_true() %>"
            out.append(open_tag)
            out.append(body_converted)
            out.append(close_tag)
            tag_manager.register_conditional(cond_name, open_tag, close_tag, section_label)
            log.record(
                "conditional",
                f"[IF {condition_display}] ... [/IF]",
                f"{open_tag} ... {close_tag}",
            )
            cursor = tokens[close_idx].end()
            i = close_idx + 1
            continue

        if _IF_CLOSE_RE.match(stripped):
            issues.append(
                ValidationIssue(
                    severity=Severity.ERROR,
                    code="UNMATCHED_CLOSE",
                    message="Found '[/IF]' with no matching '[IF ...]'.",
                    location=section_label,
                )
            )
            out.append(m.group(0))
            cursor = m.end()
            i += 1
            continue

        preceding_context = text[max(0, m.start() - 80) : m.start()]

        # Section 46: authoring instructions (e.g. "[NOTE]") are never
        # conditional-scope markers, even if they happen to be ALL CAPS --
        # check this before the bare-marker heuristic so they are resolved
        # as "not a data field" review items, not phantom conditionals.
        if is_instruction_only(inner):
            resolution = convert_generic_placeholder(inner, ctx, preceding_context, approved_dictionary)
            out.append(resolution.mmd)
            log.record(resolution.matched_rule, m.group(0), resolution.mmd)
        elif looks_like_bare_marker(inner, known_conditions):
            issues.append(
                ValidationIssue(
                    severity=Severity.WARNING,
                    code="AMBIGUOUS_CONDITION_SCOPE",
                    message=(
                        f"Ambiguous marker '{m.group(0)}' -- scope could not be "
                        "determined automatically and requires manual confirmation."
                    ),
                    location=section_label,
                )
            )
            tag_manager.flag_review(inner, section_label)
            review_comment = f"<%-- REVIEW REQUIRED: ambiguous marker {m.group(0)} --%>"
            out.append(review_comment)
            log.record("bare_marker_review", m.group(0), review_comment)
        else:
            resolution = convert_generic_placeholder(inner, ctx, preceding_context, approved_dictionary)
            out.append(resolution.mmd)
            if resolution.tag_name:
                tag_manager.register_tag(
                    resolution.tag_name,
                    resolution.mmd,
                    resolution.tag_type or TagType.DATA,
                    resolution.status or TagStatus.REVIEW,
                    section_label,
                    m.group(0),
                )
            log.record(resolution.matched_rule, m.group(0), resolution.mmd)

        cursor = m.end()
        i += 1

    if cursor < len(text):
        out.append(text[cursor:])

    return "".join(out)
