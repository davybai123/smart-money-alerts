"""Whitespace tidy-up, document structure analysis and the top-level
``generate_mmd`` orchestrator that ties every module together (Sections
21, 27, 38-39, 42).
"""
from __future__ import annotations

import re
from typing import List, Optional

from .conditionals import collect_known_conditions, convert_brackets
from .layout_analyser import analyse_layout
from .models import (
    DocumentSection,
    GenerationResult,
    LetterType,
    ValidationIssue,
)
from .page_manager import PageBreakConfig, apply_page_breaks
from .placeholders import convert_paren_placeholders
from .recipient_context import (
    RecipientContext,
    check_type_conflict,
    detect_letter_type,
    has_greeting_line,
    has_header_block,
)
from .tag_manager import TagManager
from .transformation_log import TransformationLog
from .validator import (
    check_cross_context_tags,
    compute_gate,
    find_leftover_name_placeholders,
    find_unmatched_brackets,
    validate_tags_and_conditionals,
)

# ---------------------------------------------------------------------------
# tidy_whitespace (Section 21, retained/improved)
# ---------------------------------------------------------------------------


def tidy_whitespace(text: str, max_blank_lines: int = 1) -> str:
    """Collapse runs of blank lines and strip trailing whitespace per line,
    without disturbing intentional single blank lines (Section 26)."""
    lines = [ln.rstrip() for ln in text.splitlines()]
    out: List[str] = []
    blank_run = 0
    for ln in lines:
        if ln.strip() == "":
            blank_run += 1
            if blank_run <= max_blank_lines:
                out.append("")
        else:
            blank_run = 0
            out.append(ln)
    return "\n".join(out).strip("\n") + "\n"


# ---------------------------------------------------------------------------
# Document structure analysis (Sections 21, 39)
# ---------------------------------------------------------------------------

_TABLE_ROW_RE = re.compile(r"\|.*\|")
_LIST_ITEM_RE = re.compile(r"^\s*(?:[-*•]|\d+[.)])\s+")
_SIGNATURE_TRIGGER_RE = re.compile(r"(?i)^(yours (sincerely|faithfully)|kind regards|regards),?\s*$")
_CONDITIONAL_MARK_RE = re.compile(r"<%\s*data_insert_true\(")

_CHARS_PER_LINE = 95


def _estimate_lines(block_text: str) -> int:
    raw_lines = block_text.splitlines() or [block_text]
    total = 0
    for ln in raw_lines:
        total += max(1, -(-max(len(ln), 1) // _CHARS_PER_LINE))
    return total


def _classify_block(lines: List[str]) -> str:
    non_empty = [l for l in lines if l.strip()]
    if not non_empty:
        return "blank"
    joined = "\n".join(non_empty)
    if _CONDITIONAL_MARK_RE.search(joined):
        return "conditional"
    if len(non_empty) >= 2 and all(_TABLE_ROW_RE.search(l) for l in non_empty):
        return "table"
    if all(_LIST_ITEM_RE.match(l) for l in non_empty):
        return "list"
    if _SIGNATURE_TRIGGER_RE.match(non_empty[0].strip()):
        return "signature"
    if len(non_empty) == 1 and len(non_empty[0]) <= 90 and not non_empty[0].rstrip().endswith((".", ",", ";", ":")):
        return "heading"
    return "paragraph"


def analyse_structure(text: str) -> List[DocumentSection]:
    """Split the (already-converted) MMD body into logical sections --
    headings, paragraphs, tables, lists, signature blocks, conditional
    sections -- for use by the layout analyser."""
    blocks = re.split(r"\n\s*\n", text)
    sections: List[DocumentSection] = []
    line_cursor = 1
    for block in blocks:
        block_stripped = block.strip("\n")
        if not block_stripped.strip():
            line_cursor += block.count("\n") + 1
            continue
        lines = block_stripped.splitlines()
        kind = _classify_block(lines)
        sections.append(
            DocumentSection(
                kind=kind,
                text=block_stripped,
                start_line=line_cursor,
                end_line=line_cursor + len(lines),
                estimated_lines=_estimate_lines(block_stripped),
            )
        )
        line_cursor += len(lines) + 1
    return sections


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------


class LetterTypeConflictError(Exception):
    """Raised when the manually selected letter type conflicts with what
    was auto-detected from the raw letter, and the caller has not
    explicitly opted to proceed anyway (Section 2)."""

    def __init__(self, selected: LetterType, detected: Optional[LetterType], matched_tags: List[str]):
        self.selected = selected
        self.detected = detected
        self.matched_tags = matched_tags
        super().__init__(
            "The selected letter type appears to conflict with the detected recipient fields."
        )


def generate_mmd(
    raw_text: str,
    selected_type: LetterType,
    allow_conflict: bool = False,
    page_config: Optional[PageBreakConfig] = None,
    approved_dictionary: Optional[dict] = None,
) -> GenerationResult:
    """Steps 3-9 of the Section 42 workflow: analyse, convert, validate."""
    page_config = page_config or PageBreakConfig()

    conflict = check_type_conflict(selected_type, raw_text)
    if conflict is not None and not allow_conflict:
        raise LetterTypeConflictError(conflict.selected, conflict.detected, conflict.matched_tags)
    detected_type, _ = detect_letter_type(raw_text)

    ctx = RecipientContext(selected_type)
    tag_manager = TagManager()
    log = TransformationLog()
    issues: List[ValidationIssue] = []

    known_conditions = collect_known_conditions(raw_text)

    # 1. Convert [IF ...]/[/IF] conditionals + square-bracket placeholders +
    #    flag bare conditional markers.
    body = convert_brackets(
        raw_text,
        ctx,
        tag_manager,
        log,
        issues,
        known_conditions,
        section_label="body",
        approved_dictionary=approved_dictionary,
    )

    # 2. Convert parenthesis/word-style recipient name references.
    body = convert_paren_placeholders(body, ctx, log)

    # 3. Auto-insert the standard MMD header if the raw letter didn't have
    #    one. If the letter already supplies its own "Dear ..." greeting
    #    (now converted in-place by convert_paren_placeholders above), only
    #    the missing envelope metadata is prepended -- inserting the full
    #    header would otherwise duplicate that greeting line.
    if not has_header_block(raw_text):
        if has_greeting_line(raw_text):
            body = ctx.envelope_block() + "\n\n" + body
            log.record(
                "auto_header",
                "(no Recipient: header found; existing greeting kept)",
                "auto-generated recipient envelope block",
            )
        else:
            body = ctx.header_block() + "\n\n" + body
            log.record("auto_header", "(no Recipient: header found)", "auto-generated recipient header block")

    # 4. Whitespace tidy-up (preserve intentional formatting, Section 26).
    body = tidy_whitespace(body)

    # 5. Document structure + page-layout analysis (Sections 21-24).
    sections = analyse_structure(body)
    layout_warnings, confidence, recommend_breaks = analyse_layout(sections, page_config)

    # 6. Optional page-break marker insertion (never invents syntax, Section 22).
    body, pb_issues = apply_page_breaks(body, recommend_breaks, page_config)
    issues += pb_issues

    # 7. Tag deduplication (Section 18).
    tag_manager.deduplicate()

    # 8. Full structural validation (Section 27).
    issues += find_unmatched_brackets(raw_text)
    issues += find_leftover_name_placeholders(body)
    issues += check_cross_context_tags(body, selected_type)
    issues += validate_tags_and_conditionals(tag_manager)

    gate = compute_gate(issues)

    return GenerationResult(
        letter_type=selected_type,
        mmd_text=body,
        raw_text=raw_text,
        tags=tag_manager.tags(),
        conditionals=tag_manager.conditionals(),
        transformation_log=log.entries(),
        validation_issues=issues,
        layout_warnings=layout_warnings,
        layout_confidence=confidence,
        readiness=gate,
        detected_type=detected_type,
        type_conflict=conflict is not None,
        sections=sections,
    )
