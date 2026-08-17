"""MMD Letter Generator -- converts raw pension merge letters into
MMD-compatible templates (member/dependant aware, conditional-safe,
page-layout-aware).

Typical usage::

    from mmd_generator import generate_mmd, LetterType

    result = generate_mmd(raw_text, LetterType.MEMBER)
    print(result.mmd_text)
"""
from .models import (
    ConditionalRecord,
    DocumentSection,
    GenerationResult,
    LayoutWarning,
    LetterType,
    ReadinessGate,
    Severity,
    TagRecord,
    TagStatus,
    TagType,
    TransformationEntry,
    ValidationIssue,
)
from .page_manager import PageBreakConfig
from .parser import LetterTypeConflictError, generate_mmd
from .recipient_context import RecipientContext, TypeConflict, check_type_conflict, detect_letter_type

__all__ = [
    "generate_mmd",
    "LetterType",
    "LetterTypeConflictError",
    "GenerationResult",
    "TagRecord",
    "TagType",
    "TagStatus",
    "ConditionalRecord",
    "TransformationEntry",
    "ValidationIssue",
    "LayoutWarning",
    "DocumentSection",
    "Severity",
    "ReadinessGate",
    "PageBreakConfig",
    "RecipientContext",
    "TypeConflict",
    "check_type_conflict",
    "detect_letter_type",
]
