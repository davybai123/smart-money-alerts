"""Transformation audit trail (Section 36)."""
from __future__ import annotations

from typing import List

from .models import TransformationEntry


class TransformationLog:
    """Records every raw -> MMD transformation the generator makes, in
    order, so the process is fully auditable after the fact."""

    def __init__(self) -> None:
        self._entries: List[TransformationEntry] = []

    def record(self, rule: str, raw: str, became: str, reason: str = "") -> None:
        self._entries.append(
            TransformationEntry(index=len(self._entries) + 1, rule=rule, raw=raw, became=became, reason=reason)
        )

    def entries(self) -> List[TransformationEntry]:
        return list(self._entries)

    def to_text(self) -> str:
        lines = []
        for e in self._entries:
            line = f"[{e.index}] ({e.rule}) RAW: {e.raw!r} -> BECAME: {e.became!r}"
            if e.reason:
                line += f"  # {e.reason}"
            lines.append(line)
        return "\n".join(lines)
