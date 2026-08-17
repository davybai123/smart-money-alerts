"""Tag & conditional-item registry (Sections 15-19)."""
from __future__ import annotations

from typing import Dict, List

from .models import ConditionalRecord, TagRecord, TagStatus, TagType
from .tag_normaliser import find_potential_duplicates, normalise_tag_name


class TagManager:
    """Collects every data tag and conditional encountered while generating
    the MMD, powering the TAGS & ITEMS and CONDITIONAL REVIEW panels."""

    def __init__(self) -> None:
        self._tags: Dict[str, TagRecord] = {}
        self._conditionals: Dict[str, ConditionalRecord] = {}

    # -- data tags ---------------------------------------------------------

    def register_tag(
        self,
        name: str,
        mmd_syntax: str,
        tag_type: TagType,
        status: TagStatus,
        location: str,
        source_text: str,
    ) -> TagRecord:
        rec = self._tags.get(name)
        if rec is None:
            rec = TagRecord(name=name, mmd_syntax=mmd_syntax, tag_type=tag_type, status=status)
            self._tags[name] = rec
        rec.occurrences += 1
        rec.locations.append(location)
        rec.source_texts.append(source_text)
        return rec

    def tags(self) -> List[TagRecord]:
        return sorted(self._tags.values(), key=lambda t: t.name)

    def deduplicate(self) -> List[List[str]]:
        """Section 18: flag potential duplicate fields. Never merges them
        automatically -- marks each member of a group as DUPLICATE with a
        note pointing at the others, leaving the canonical choice to a
        human reviewer."""
        names = [n for n in self._tags.keys()]
        groups = find_potential_duplicates(names)
        for group in groups:
            for n in group:
                others = ", ".join(g for g in group if g != n)
                rec = self._tags[n]
                if rec.status != TagStatus.DUPLICATE:
                    rec.status = TagStatus.DUPLICATE
                rec.notes = f"Potential duplicate of: {others}"
        return groups

    # -- conditionals --------------------------------------------------

    def register_conditional(
        self, name: str, mmd_open: str, mmd_close: str, section: str, needs_creation: bool = True
    ) -> ConditionalRecord:
        rec = self._conditionals.get(name)
        if rec is None:
            rec = ConditionalRecord(
                name=name,
                mmd_open=mmd_open,
                mmd_close=mmd_close,
                needs_creation=needs_creation,
                scope=section,
                status="Needs Creation" if needs_creation else "Existing",
            )
            self._conditionals[name] = rec
        rec.occurrences += 1
        if section not in rec.sections:
            rec.sections.append(section)
        return rec

    def flag_review(self, raw_marker: str, section: str) -> ConditionalRecord:
        """Section 13: register an ambiguous bare marker awaiting manual
        scope confirmation."""
        name = normalise_tag_name(raw_marker) or raw_marker.strip()
        rec = self._conditionals.get(name)
        if rec is None:
            rec = ConditionalRecord(
                name=name,
                mmd_open="",
                mmd_close="",
                scope="Unknown",
                status="Review Required",
                confirmed=False,
            )
            self._conditionals[name] = rec
        rec.occurrences += 1
        if section not in rec.sections:
            rec.sections.append(section)
        return rec

    def confirm_scope(self, name: str, scope: str) -> bool:
        """Section 14: user manually assigns / confirms the scope of an
        ambiguous condition."""
        rec = self._conditionals.get(name)
        if rec is None:
            return False
        rec.scope = scope
        rec.confirmed = True
        rec.status = "Confirmed"
        return True

    def conditionals(self) -> List[ConditionalRecord]:
        return sorted(self._conditionals.values(), key=lambda c: c.name)
