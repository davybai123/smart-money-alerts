"""Structural validation engine and export-readiness gate (Sections 27-28, 43)."""
from __future__ import annotations

import re
from typing import List

from .models import (
    LetterType,
    ReadinessGate,
    Severity,
    TagStatus,
    ValidationIssue,
)
from .tag_manager import TagManager

_NAME_REF_LEFTOVERS = [
    (re.compile(r"\(\s*Title\s*\)"), "(Title)"),
    (re.compile(r"\(\s*Forename\s*\)"), "(Forename)"),
    (re.compile(r"\(\s*Surname\s*\)"), "(Surname)"),
]


def find_unmatched_brackets(text: str) -> List[ValidationIssue]:
    """Raw character-level ``[``/``]`` balance check -- a low-level safety
    net independent of the token-based conditional parser, catching
    malformed brackets that don't even form a valid ``[...]`` token."""
    issues: List[ValidationIssue] = []
    stack: List[int] = []
    for i, ch in enumerate(text):
        if ch == "[":
            stack.append(i)
        elif ch == "]":
            if stack:
                stack.pop()
            else:
                issues.append(
                    ValidationIssue(
                        severity=Severity.ERROR,
                        code="UNMATCHED_CLOSE_BRACKET",
                        message=f"Unmatched ']' at character offset {i}.",
                    )
                )
    for i in stack:
        issues.append(
            ValidationIssue(
                severity=Severity.ERROR,
                code="UNMATCHED_OPEN_BRACKET",
                message=f"Unmatched '[' at character offset {i}.",
            )
        )
    return issues


def find_leftover_name_placeholders(body: str) -> List[ValidationIssue]:
    issues = []
    for pattern, label in _NAME_REF_LEFTOVERS:
        if pattern.search(body):
            issues.append(
                ValidationIssue(
                    severity=Severity.WARNING,
                    code="UNRESOLVED_NAME_PLACEHOLDER",
                    message=f"Unresolved raw placeholder '{label}' remains in the generated MMD.",
                )
            )
    return issues


def check_cross_context_tags(body: str, letter_type: LetterType) -> List[ValidationIssue]:
    """Section 27: 'incorrect member/dependant references' -- flag protected
    recipient tags belonging to the *other* recipient type appearing in the
    generated MMD (member_id is shared and intentionally excluded)."""
    other_prefix = "dependant" if letter_type == LetterType.MEMBER else "member"
    other_fields = [
        f"{other_prefix}_title_guess",
        f"{other_prefix}_forename",
        f"{other_prefix}_surname",
        f"{other_prefix}_address",
        f"{other_prefix}_postcode_or_foreign_country",
    ]
    issues = []
    for tag in other_fields:
        if re.search(rf"<%\s*{re.escape(tag)}\s*%>", body):
            issues.append(
                ValidationIssue(
                    severity=Severity.ERROR,
                    code="CROSS_CONTEXT_TAG",
                    message=(
                        f"Found '<% {tag} %>' in a {letter_type.value} letter -- "
                        "recipient context mismatch."
                    ),
                )
            )
    return issues


def validate_tags_and_conditionals(tag_manager: TagManager) -> List[ValidationIssue]:
    issues: List[ValidationIssue] = []
    for tag in tag_manager.tags():
        if tag.name and " " in tag.name:
            issues.append(
                ValidationIssue(
                    severity=Severity.ERROR,
                    code="SPACE_IN_TAG_NAME",
                    message=f"Generated tag '{tag.name}' contains a space -- invalid MMD tag name.",
                )
            )
        if tag.status == TagStatus.NEEDS_CREATION:
            issues.append(
                ValidationIssue(
                    severity=Severity.WARNING,
                    code="TAG_NEEDS_CREATION",
                    message=f"Tag '{tag.name}' needs creation ({tag.occurrences} occurrence(s)).",
                )
            )
        if tag.status == TagStatus.DUPLICATE:
            issues.append(
                ValidationIssue(
                    severity=Severity.WARNING,
                    code="DUPLICATE_TAG",
                    message=f"Tag '{tag.name}' may duplicate another field. {tag.notes}",
                )
            )
        if tag.status == TagStatus.REVIEW:
            issues.append(
                ValidationIssue(
                    severity=Severity.WARNING,
                    code="TAG_REVIEW_REQUIRED",
                    message=f"Tag '{tag.name or '(unresolved)'}' requires manual review.",
                )
            )
    for cond in tag_manager.conditionals():
        if not cond.confirmed:
            issues.append(
                ValidationIssue(
                    severity=Severity.WARNING,
                    code="CONDITIONAL_SCOPE_UNCONFIRMED",
                    message=f"Conditional '{cond.name}' requires scope confirmation before export.",
                )
            )
    return issues


def compute_gate(issues: List[ValidationIssue]) -> ReadinessGate:
    if any(i.severity == Severity.ERROR for i in issues):
        return ReadinessGate.NOT_READY
    if any(i.severity == Severity.WARNING for i in issues):
        return ReadinessGate.REVIEW_REQUIRED
    return ReadinessGate.READY
