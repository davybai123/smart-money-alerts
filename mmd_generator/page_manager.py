"""Page-break configuration and (optional) marker insertion (Section 22-23).

The spec is explicit: *never invent MMD page-break syntax*. By default this
module inserts nothing at all -- it only records where layout_analyser.py
recommends a break, and only stamps an actual marker into the document if a
user has explicitly configured one via Settings and opted in.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional, Tuple

from .models import LayoutWarning, Severity, ValidationIssue


@dataclass
class PageBreakConfig:
    #: MMD-compatible page-break marker. Left as None until a user supplies
    #: one for their rendering environment -- we refuse to guess it.
    marker: Optional[str] = None
    #: Whether to actually stamp `marker` into the output at recommended
    #: break points. Off by default even if a marker is configured, so a
    #: break is only ever inserted as a deliberate choice.
    insert_breaks: bool = False
    #: Heuristic used purely for layout *analysis* (not real pagination).
    lines_per_page: int = 45
    #: Keep heading+first-paragraph, table+heading, signature+closing text
    #: etc. together rather than letting them split badly (Section 23).
    keep_sections_together: bool = True


DEFAULT_PAGE_CONFIG = PageBreakConfig()


def apply_page_breaks(
    body: str,
    recommended_break_before: List[str],
    config: PageBreakConfig,
) -> Tuple[str, List[ValidationIssue]]:
    """Optionally stamp the configured page-break marker into ``body``
    immediately before each recommended section (Section 22).

    Returns the (possibly unmodified) body plus any validation issues, most
    notably the Section 37 "Page-break syntax has not been configured"
    warning when a break was requested but no marker is set.
    """
    issues: List[ValidationIssue] = []

    if not config.insert_breaks:
        return body, issues

    if not config.marker:
        issues.append(
            ValidationIssue(
                severity=Severity.WARNING,
                code="PAGE_BREAK_NOT_CONFIGURED",
                message=(
                    "Page-break syntax has not been configured; no page breaks "
                    "were inserted even though layout analysis recommended some. "
                    "Set a marker in Settings first."
                ),
            )
        )
        return body, issues

    result = body
    for snippet in recommended_break_before:
        if snippet and snippet in result:
            result = result.replace(snippet, f"{config.marker}\n{snippet}", 1)
    return result, issues
