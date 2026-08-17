"""Export .mmd, tag list and review report (Sections 34-36)."""
from __future__ import annotations

import csv
import io
from pathlib import Path
from typing import Union

from .models import GenerationResult, ReadinessGate, Severity

PathLike = Union[str, Path]


def export_mmd(path: PathLike, result: GenerationResult) -> Path:
    p = Path(path)
    p.write_text(result.mmd_text, encoding="utf-8")
    return p


def export_tag_list(path: PathLike, result: GenerationResult) -> Path:
    """Section 35: Tag Name / MMD Syntax / Type / Occurrences / Source Text
    / Status / Notes, as CSV."""
    p = Path(path)
    with p.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(
            ["Tag Name", "MMD Syntax", "Type", "Occurrences", "Source Text", "Status", "Notes"]
        )
        for tag in result.tags:
            source = tag.source_texts[0] if tag.source_texts else ""
            writer.writerow(
                [tag.name, tag.mmd_syntax, tag.tag_type.value, tag.occurrences, source, tag.status.value, tag.notes]
            )
        writer.writerow([])
        writer.writerow(["Conditional", "MMD Open", "MMD Close", "Occurrences", "Scope", "Confirmed", "Status"])
        for cond in result.conditionals:
            writer.writerow(
                [
                    cond.name,
                    cond.mmd_open,
                    cond.mmd_close,
                    cond.occurrences,
                    cond.scope,
                    "Yes" if cond.confirmed else "No",
                    cond.status,
                ]
            )
    return p


_GATE_ICON = {
    ReadinessGate.NOT_READY: "\U0001F534 NOT READY",
    ReadinessGate.REVIEW_REQUIRED: "\U0001F7E0 REVIEW REQUIRED",
    ReadinessGate.READY: "\U0001F7E2 READY",
}


def build_review_report(result: GenerationResult) -> str:
    buf = io.StringIO()
    buf.write("# LETTER VALIDATION REPORT\n\n")
    buf.write(f"Letter type: {result.letter_type.value}\n")
    if result.detected_type:
        buf.write(f"Auto-detected type: {result.detected_type.value}\n")
    buf.write(f"Export status: {_GATE_ICON[result.readiness]}\n")
    buf.write(f"Page layout confidence: {result.layout_confidence:.0f}%\n\n")

    errors = [i for i in result.validation_issues if i.severity == Severity.ERROR]
    warnings = [i for i in result.validation_issues if i.severity == Severity.WARNING]

    buf.write("## Errors\n")
    if errors:
        for i in errors:
            buf.write(f"- [{i.code}] {i.message}\n")
    else:
        buf.write("(none)\n")

    buf.write("\n## Warnings\n")
    if warnings:
        for i in warnings:
            buf.write(f"- [{i.code}] {i.message}\n")
    else:
        buf.write("(none)\n")

    buf.write("\n## Page Layout Warnings\n")
    for w in result.layout_warnings:
        prefix = "OK" if w.severity == Severity.INFO else "WARN"
        buf.write(f"- [{prefix}] {w.message}\n")

    new_tags = [t for t in result.tags if t.status.value == "Needs Creation"]
    dup_tags = [t for t in result.tags if t.status.value == "Duplicate"]
    review_tags = [t for t in result.tags if t.status.value == "Review"]

    buf.write("\n## New Data Tags\n")
    for t in new_tags:
        buf.write(f"- {t.mmd_syntax} (x{t.occurrences})\n")
    if not new_tags:
        buf.write("(none)\n")

    buf.write("\n## Potential Duplicate Tags\n")
    for t in dup_tags:
        buf.write(f"- {t.name}: {t.notes}\n")
    if not dup_tags:
        buf.write("(none)\n")

    buf.write("\n## Tags Requiring Review\n")
    for t in review_tags:
        buf.write(f"- {t.mmd_syntax or '(unresolved)'} : {t.notes or 'context could not be determined'}\n")
    if not review_tags:
        buf.write("(none)\n")

    buf.write("\n## Unresolved Conditions\n")
    unresolved = [c for c in result.conditionals if not c.confirmed]
    for c in unresolved:
        buf.write(f"- {c.name} (scope: {c.scope}, occurrences: {c.occurrences})\n")
    if not unresolved:
        buf.write("(none)\n")

    return buf.getvalue()


def export_review_report(path: PathLike, result: GenerationResult) -> Path:
    p = Path(path)
    p.write_text(build_review_report(result), encoding="utf-8")
    return p


def export_all(outdir: PathLike, result: GenerationResult, base_name: str = "letter") -> dict:
    outdir = Path(outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    return {
        "mmd": export_mmd(outdir / f"{base_name}.mmd", result),
        "tags": export_tag_list(outdir / f"{base_name}_tags.csv", result),
        "report": export_review_report(outdir / f"{base_name}_review_report.md", result),
    }
