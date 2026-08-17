"""Page-layout / space-awareness analysis (Sections 21-24).

There is no real MMD renderer available to this tool, so pagination is
*simulated* using a configurable lines-per-page heuristic
(``PageBreakConfig.lines_per_page``). The goal is not pixel-perfect
pagination -- it is catching the classic bad splits the spec calls out:
orphaned headings, tables/lists straddling a page boundary, and signature
blocks separated from their closing text -- and recommending that the whole
section move to the next page rather than splitting badly.
"""
from __future__ import annotations

from typing import List, Tuple

from .models import DocumentSection, LayoutWarning, Severity
from .page_manager import PageBreakConfig

#: Section kinds that should never be allowed to split badly across a page
#: boundary -- if they don't fit, the whole section moves to the next page.
_KEEP_WHOLE_KINDS = {"heading", "table", "list", "signature"}

#: How many lines of "room to breathe" a heading needs after it before it is
#: considered safely anchored to the following content on the same page.
_ORPHAN_HEADING_MARGIN = 2


def analyse_layout(
    sections: List[DocumentSection], config: PageBreakConfig
) -> Tuple[List[LayoutWarning], float, List[str]]:
    """Simulate pagination and flag likely bad splits.

    Returns ``(warnings, confidence_percent, recommended_break_before)``
    where the last element is the list of section text snippets that
    should start on a fresh page if page breaks are ever inserted.
    """
    warnings: List[LayoutWarning] = []
    recommend_break_before: List[str] = []
    lpp = max(1, config.lines_per_page)

    page_pos = 0  # lines used on the current simulated page
    prev_kind = None

    for idx, sec in enumerate(sections):
        length = max(1, sec.estimated_lines)
        remaining = lpp - page_pos

        if sec.kind in _KEEP_WHOLE_KINDS and config.keep_sections_together:
            if length > lpp:
                # Doesn't fit on any single page no matter what -- always warn.
                warnings.append(
                    LayoutWarning(
                        severity=Severity.WARNING,
                        message=f"{sec.kind.capitalize()} is longer than a full page and will span multiple pages.",
                        section=_snippet(sec.text),
                    )
                )
                page_pos = length % lpp
            elif length > remaining:
                # Would split badly here -- move the whole section to the
                # next page instead of letting it straddle the boundary.
                if remaining <= _ORPHAN_HEADING_MARGIN and sec.kind == "heading":
                    warnings.append(
                        LayoutWarning(
                            severity=Severity.WARNING,
                            message=f"Heading may be orphaned near a page boundary: '{_snippet(sec.text)}'.",
                            section=_snippet(sec.text),
                        )
                    )
                elif sec.kind == "table":
                    warnings.append(
                        LayoutWarning(
                            severity=Severity.WARNING,
                            message=f"Table may split across pages: '{_snippet(sec.text)}'.",
                            section=_snippet(sec.text),
                        )
                    )
                elif sec.kind == "signature" and prev_kind == "paragraph":
                    warnings.append(
                        LayoutWarning(
                            severity=Severity.WARNING,
                            message="Signature block may move to next page, separated from the closing text.",
                            section=_snippet(sec.text),
                        )
                    )
                elif sec.kind == "list":
                    warnings.append(
                        LayoutWarning(
                            severity=Severity.WARNING,
                            message=f"List may split across pages: '{_snippet(sec.text)}'.",
                            section=_snippet(sec.text),
                        )
                    )
                recommend_break_before.append(sec.text)
                page_pos = length
            else:
                page_pos += length
        else:
            # Plain paragraphs / conditional prose are allowed to flow.
            if sec.kind == "conditional" and length > lpp:
                warnings.append(
                    LayoutWarning(
                        severity=Severity.WARNING,
                        message="Conditional section may cause unexpected page overflow due to its length.",
                        section=_snippet(sec.text),
                    )
                )
            page_pos = (page_pos + length) % lpp

        prev_kind = sec.kind

    if not warnings:
        warnings.append(
            LayoutWarning(severity=Severity.INFO, message="Page structure looks safe.", section=None)
        )

    penalised = sum(1 for w in warnings if w.severity == Severity.WARNING)
    confidence = max(0.0, 100.0 - 8.0 * penalised)
    return warnings, confidence, recommend_break_before


def _snippet(text: str, limit: int = 60) -> str:
    flat = " ".join(text.split())
    return flat[:limit] + ("..." if len(flat) > limit else "")
