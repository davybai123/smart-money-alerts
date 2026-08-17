"""Core data models shared across the MMD Letter Generator."""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional


class LetterType(str, Enum):
    MEMBER = "MEMBER"
    DEPENDANT = "DEPENDANT"


class TagType(str, Enum):
    SYSTEM = "System"
    DATA = "Data"
    CONDITIONAL = "Conditional"


class TagStatus(str, Enum):
    EXISTING = "Existing"
    NEW = "New"
    NEEDS_CREATION = "Needs Creation"
    DUPLICATE = "Duplicate"
    REVIEW = "Review"
    INVALID = "Invalid"


class Severity(str, Enum):
    ERROR = "ERROR"
    WARNING = "WARNING"
    INFO = "INFO"


class ReadinessGate(str, Enum):
    NOT_READY = "NOT READY"
    REVIEW_REQUIRED = "REVIEW REQUIRED"
    READY = "READY"


@dataclass
class TagRecord:
    name: str
    mmd_syntax: str
    tag_type: TagType
    status: TagStatus
    occurrences: int = 0
    locations: List[str] = field(default_factory=list)
    source_texts: List[str] = field(default_factory=list)
    notes: str = ""


@dataclass
class ConditionalRecord:
    name: str
    mmd_open: str
    mmd_close: str
    occurrences: int = 0
    sections: List[str] = field(default_factory=list)
    needs_creation: bool = True
    confirmed: bool = False
    scope: str = "Unknown"
    status: str = "Review Required"


@dataclass
class TransformationEntry:
    index: int
    rule: str
    raw: str
    became: str
    reason: str = ""


@dataclass
class ValidationIssue:
    severity: Severity
    code: str
    message: str
    location: Optional[str] = None


@dataclass
class LayoutWarning:
    severity: Severity
    message: str
    section: Optional[str] = None


@dataclass
class DocumentSection:
    kind: str  # heading, paragraph, table, list, signature, blank
    text: str
    start_line: int
    end_line: int
    estimated_lines: int = 0


@dataclass
class GenerationResult:
    letter_type: LetterType
    mmd_text: str
    raw_text: str
    tags: List[TagRecord]
    conditionals: List[ConditionalRecord]
    transformation_log: List[TransformationEntry]
    validation_issues: List[ValidationIssue]
    layout_warnings: List[LayoutWarning]
    layout_confidence: float
    readiness: ReadinessGate
    detected_type: Optional[LetterType] = None
    type_conflict: bool = False
    sections: List[DocumentSection] = field(default_factory=list)

    def has_errors(self) -> bool:
        return any(i.severity == Severity.ERROR for i in self.validation_issues)

    def has_warnings(self) -> bool:
        return any(i.severity == Severity.WARNING for i in self.validation_issues) or bool(
            self.layout_warnings
        )
