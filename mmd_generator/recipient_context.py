"""Letter-type detection and recipient context resolution (Sections 2-5, 31-32)."""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Optional, Tuple

from .models import LetterType
from .protected_tags import fields_for

_DEPENDANT_MARKERS = ("dependant_title_guess", "dependant_forename", "dependant_surname")
_MEMBER_MARKERS = ("member_title_guess", "member_forename", "member_surname")

_TAG_RE = re.compile(r"<%\s*([a-zA-Z0-9_]+)\s*%>")

#: How far into the raw letter we look when auto-detecting the recipient type.
DETECTION_WINDOW_CHARS = 1500

#: Regex used elsewhere to decide whether an MMD envelope header already exists.
HEADER_PRESENT_RE = re.compile(r"(?im)^\s*Recipient\s*:")

#: Regex used to detect whether the raw letter already supplies its own
#: "Dear ..." greeting line, so an auto-inserted header doesn't duplicate it.
GREETING_PRESENT_RE = re.compile(r"(?im)^\s*Dear\s")


def _find_markers(text: str, markers: Tuple[str, ...]) -> List[str]:
    return [tag for tag in _TAG_RE.findall(text) if tag in markers]


def detect_letter_type(
    raw_text: str, scan_chars: int = DETECTION_WINDOW_CHARS
) -> Tuple[Optional[LetterType], List[str]]:
    """Scan the start of the letter for recipient-field tags (Section 2).

    Returns ``(detected_type_or_None, matched_tag_names)``. If both member
    and dependant markers are present near the top of the document we
    deliberately refuse to guess and return ``None`` so the caller can raise
    a conflict/ambiguity warning instead of silently picking one.
    """
    head = raw_text[:scan_chars]
    dependant_hits = _find_markers(head, _DEPENDANT_MARKERS)
    member_hits = _find_markers(head, _MEMBER_MARKERS)

    if dependant_hits and member_hits:
        return None, dependant_hits + member_hits
    if dependant_hits:
        return LetterType.DEPENDANT, dependant_hits
    if member_hits:
        return LetterType.MEMBER, member_hits
    return None, []


def has_header_block(raw_text: str, scan_chars: int = 600) -> bool:
    """Whether the raw letter already contains an MMD envelope header
    (``Recipient:`` / ``Recipient Address:`` / ``Header Text:`` lines)."""
    return bool(HEADER_PRESENT_RE.search(raw_text[:scan_chars]))


def has_greeting_line(raw_text: str, scan_chars: int = 2000) -> bool:
    """Whether the raw letter already supplies its own "Dear ..." greeting
    somewhere near the top (Section 32: only auto-insert what's missing)."""
    return bool(GREETING_PRESENT_RE.search(raw_text[:scan_chars]))


@dataclass
class RecipientContext:
    letter_type: LetterType

    @property
    def prefix(self) -> str:
        return "member" if self.letter_type == LetterType.MEMBER else "dependant"

    @property
    def fields(self):
        return fields_for(self.letter_type)

    @property
    def title_tag(self) -> str:
        return self.fields["title"]

    @property
    def forename_tag(self) -> str:
        return self.fields["forename"]

    @property
    def surname_tag(self) -> str:
        return self.fields["surname"]

    @property
    def address_tag(self) -> str:
        return self.fields["address"]

    @property
    def postcode_tag(self) -> str:
        return self.fields["postcode"]

    @property
    def id_tag(self) -> str:
        return self.fields["id"]

    def envelope_block(self) -> str:
        """Section 3 / 4 / 32: the MMD envelope metadata lines (recipient,
        address, postcode, document date, header text) -- everything
        *before* the greeting."""
        return "\n".join(
            [
                f"Recipient:                      <% {self.title_tag} %> <% {self.forename_tag} %> <% {self.surname_tag} %>",
                f"Recipient Address:              <% {self.address_tag} %>",
                f"Recipient Postcode:             <% {self.postcode_tag} %>",
                "Document Date:                  <% current_date_l %>",
                f"Header Text:                    <% scheme_name_quick %> - <% {self.id_tag} %>",
            ]
        )

    def greeting_block(self) -> str:
        """The "Dear ..." greeting + vspace (+ scheme-name intro for member
        letters) that normally follows the envelope block."""
        lines = [
            f"Dear <% {self.title_tag} %> <% {self.surname_tag} %>,",
            "<% vspace %>",
        ]
        if self.letter_type == LetterType.MEMBER:
            lines.append('**<% scheme_name %> (\'\'the Scheme")')
        return "\n".join(lines)

    def header_block(self) -> str:
        """Section 3 / 4 / 32: the full standard MMD envelope header block
        (envelope + greeting), used when the raw letter has neither."""
        return self.envelope_block() + "\n" + self.greeting_block()


@dataclass
class TypeConflict:
    selected: LetterType
    detected: Optional[LetterType]
    matched_tags: List[str]

    @property
    def message(self) -> str:
        return "The selected letter type appears to conflict with the detected recipient fields."


def check_type_conflict(selected: LetterType, raw_text: str) -> Optional[TypeConflict]:
    """Section 2: compare the manually selected letter type against
    auto-detection. Returns a TypeConflict only when detection produced a
    confident, differing answer (never on an ambiguous/ no-match scan)."""
    detected, matches = detect_letter_type(raw_text)
    if detected is not None and detected != selected:
        return TypeConflict(selected=selected, detected=detected, matched_tags=matches)
    return None
