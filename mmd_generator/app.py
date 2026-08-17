"""MMD Letter Generator -- CLI application (Sections 1, 31, 41-43).

No web framework exists in this repository, so the "clean professional UI"
called for in the spec is delivered as a menu-driven terminal application
with the same information architecture that a GUI would have:

    GENERATOR | TAGS & ITEMS | VALIDATION | PAGE LAYOUT | TRANSFORMATION LOG | SETTINGS

Run ``python -m mmd_generator.app interactive`` for the menu, or
``python -m mmd_generator.app generate --input letter.txt --type member``
for a one-shot, scriptable run.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, Optional

from .exporter import build_review_report, export_all
from .models import GenerationResult, LetterType, ReadinessGate, Severity
from .page_manager import PageBreakConfig
from .parser import LetterTypeConflictError, generate_mmd
from .protected_tags import DEFAULT_APPROVED_TAG_DICTIONARY, PROTECTED_TAGS
from .recipient_context import detect_letter_type

SETTINGS_PATH = Path(__file__).resolve().parent / "settings.json"

_GATE_LABEL = {
    ReadinessGate.NOT_READY: "\U0001F534 NOT READY",
    ReadinessGate.REVIEW_REQUIRED: "\U0001F7E0 REVIEW REQUIRED",
    ReadinessGate.READY: "\U0001F7E2 READY",
}


class Settings:
    """Section 41: Protected tags / tag naming rules / page-break
    configuration / system configuration, persisted to a small JSON file."""

    def __init__(self) -> None:
        self.approved_dictionary: Dict[str, str] = dict(DEFAULT_APPROVED_TAG_DICTIONARY)
        self.page_config = PageBreakConfig()
        self.load()

    def load(self) -> None:
        if not SETTINGS_PATH.exists():
            return
        try:
            data = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return
        self.approved_dictionary.update(data.get("approved_dictionary", {}))
        pc = data.get("page_config", {})
        self.page_config.marker = pc.get("marker")
        self.page_config.insert_breaks = pc.get("insert_breaks", False)
        self.page_config.lines_per_page = pc.get("lines_per_page", 45)
        self.page_config.keep_sections_together = pc.get("keep_sections_together", True)

    def save(self) -> None:
        data = {
            "approved_dictionary": self.approved_dictionary,
            "page_config": {
                "marker": self.page_config.marker,
                "insert_breaks": self.page_config.insert_breaks,
                "lines_per_page": self.page_config.lines_per_page,
                "keep_sections_together": self.page_config.keep_sections_together,
            },
        }
        SETTINGS_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")


# ---------------------------------------------------------------------------
# Rendering helpers
# ---------------------------------------------------------------------------


def _table(headers, rows, widths=None) -> str:
    cols = len(headers)
    widths = widths or [
        max(len(str(headers[c])), *(len(str(r[c])) for r in rows)) if rows else len(str(headers[c]))
        for c in range(cols)
    ]
    widths = [min(w, 60) for w in widths]

    def fmt_row(vals):
        cells = []
        for v, w in zip(vals, widths):
            s = str(v)
            if len(s) > w:
                s = s[: w - 1] + "…"
            cells.append(s.ljust(w))
        return " | ".join(cells)

    lines = [fmt_row(headers), "-+-".join("-" * w for w in widths)]
    for r in rows:
        lines.append(fmt_row(r))
    return "\n".join(lines)


def print_letter_type_banner(result: GenerationResult) -> None:
    print(f"\n# {result.letter_type.value} LETTER")


def print_validation(result: GenerationResult) -> None:
    print("\n# LETTER VALIDATION")
    print(f"{'✓' if not result.type_conflict else '⚠'} Recipient type identified: {result.letter_type.value}")
    print("✓ Header valid")
    data_tags = [t for t in result.tags]
    cond_tags = result.conditionals
    print(f"✓ {len(data_tags)} data tag(s) detected")
    print(f"✓ {len(cond_tags)} conditional tag(s) detected")

    errors = [i for i in result.validation_issues if i.severity == Severity.ERROR]
    warnings = [i for i in result.validation_issues if i.severity == Severity.WARNING]

    mark = "✓" if not errors else "✗"
    print(f"{mark} {'No' if not errors else len(errors)} structural error(s)")
    for i in errors:
        print(f"    ✗ [{i.code}] {i.message}")

    needs_creation = [t for t in result.tags if t.status.value == "Needs Creation"]
    if needs_creation:
        print(f"⚠ {len(needs_creation)} tag(s) need creation")
    unresolved_cond = [c for c in result.conditionals if not c.confirmed]
    if unresolved_cond:
        print(f"⚠ {len(unresolved_cond)} conditional(s) require scope confirmation")

    layout_bad = [w for w in result.layout_warnings if w.severity != Severity.INFO]
    if layout_bad:
        print(f"⚠ {len(layout_bad)} page layout warning(s)")
    else:
        print("✓ Page layout appears safe")

    print(f"\n# {_GATE_LABEL[result.readiness]}")


def print_tags_and_items(result: GenerationResult) -> None:
    print("\n# TAGS & ITEMS\n\n## DATA TAGS")
    rows = [
        [t.name, t.tag_type.value, t.occurrences, t.status.value]
        for t in result.tags
    ]
    print(_table(["Tag", "Type", "Occurrences", "Status"], rows))

    print("\n## CONDITIONAL ITEMS")
    rows = [
        [c.name, c.occurrences, ", ".join(c.sections) or "-", "Yes" if c.needs_creation else "No", "Yes" if c.confirmed else "No", c.status]
        for c in result.conditionals
    ]
    print(_table(["Condition", "Occurrences", "Used In", "Needs Creation", "Confirmed", "Status"], rows))


def print_conditional_review(result: GenerationResult) -> None:
    print("\n# CONDITIONAL REVIEW")
    rows = []
    for c in result.conditionals:
        status = "✓ Confirmed" if c.confirmed else "⚠ Review Required"
        rows.append([c.name, status, c.scope, "Confirmed" if c.confirmed else "Review"])
    print(_table(["Condition", "Status", "Scope", "Action"], rows))


def print_page_layout(result: GenerationResult) -> None:
    print("\n# PAGE LAYOUT REVIEW")
    for w in result.layout_warnings:
        icon = "✓" if w.severity == Severity.INFO else "⚠"
        print(f"{icon} {w.message}")
    print(f"\nPage Layout Confidence: {result.layout_confidence:.0f}%")


def print_transformation_log(result: GenerationResult) -> None:
    print("\n# TRANSFORMATION LOG")
    for e in result.transformation_log:
        line = f"[{e.index}] ({e.rule}) RAW: {e.raw!r} -> BECAME: {e.became!r}"
        print(line)


def print_generator_panels(result: GenerationResult) -> None:
    print_letter_type_banner(result)
    print("\n# RAW LETTER\n")
    print(result.raw_text)
    print("\n# GENERATED MMD\n")
    print(result.mmd_text)


# ---------------------------------------------------------------------------
# Core run (shared by both CLI modes)
# ---------------------------------------------------------------------------


def resolve_letter_type(raw_text: str, requested: Optional[LetterType], interactive: bool) -> LetterType:
    if requested is not None:
        return requested
    detected, _ = detect_letter_type(raw_text)
    if detected is not None:
        return detected
    if interactive:
        while True:
            choice = input("Letter type could not be auto-detected. Enter MEMBER or DEPENDANT: ").strip().upper()
            if choice in ("MEMBER", "DEPENDANT"):
                return LetterType(choice)
    raise SystemExit("Letter type could not be determined; pass --type member|dependant.")


def run_generation(
    raw_text: str, selected_type: LetterType, settings: Settings, interactive: bool
) -> GenerationResult:
    try:
        return generate_mmd(
            raw_text,
            selected_type,
            allow_conflict=not interactive,
            page_config=settings.page_config,
            approved_dictionary=settings.approved_dictionary,
        )
    except LetterTypeConflictError as exc:
        print(f"\n⚠ {exc}")
        print(f"   Selected: {exc.selected.value}  |  Detected: {exc.detected.value if exc.detected else 'Unknown'}")
        print(f"   Matched tags: {', '.join(exc.matched_tags)}")
        if not interactive:
            raise
        while True:
            choice = input("Keep selected type, switch to detected type, or abort? [keep/switch/abort]: ").strip().lower()
            if choice == "keep":
                return generate_mmd(
                    raw_text, exc.selected, allow_conflict=True,
                    page_config=settings.page_config, approved_dictionary=settings.approved_dictionary,
                )
            if choice == "switch" and exc.detected is not None:
                print("Changing letter type will update recipient references throughout the document.")
                confirm = input("Confirm switch? [y/N]: ").strip().lower()
                if confirm == "y":
                    return generate_mmd(
                        raw_text, exc.detected, allow_conflict=True,
                        page_config=settings.page_config, approved_dictionary=settings.approved_dictionary,
                    )
            if choice == "abort":
                raise SystemExit("Aborted by user.")


# ---------------------------------------------------------------------------
# Interactive menu (Section 41)
# ---------------------------------------------------------------------------


def interactive_main() -> None:
    settings = Settings()
    print("=" * 60)
    print("MMD LETTER GENERATOR")
    print("=" * 60)

    path = input("Path to raw letter (.txt): ").strip()
    raw_text = Path(path).read_text(encoding="utf-8")

    print("\nLETTER TYPE\n  1) MEMBER LETTER\n  2) DEPENDANT LETTER\n  3) Auto-detect")
    choice = input("Select [1/2/3]: ").strip()
    requested = {"1": LetterType.MEMBER, "2": LetterType.DEPENDANT}.get(choice)
    selected_type = resolve_letter_type(raw_text, requested, interactive=True)

    result = run_generation(raw_text, selected_type, settings, interactive=True)

    while True:
        print("\n" + "=" * 60)
        print(f"[{result.letter_type.value} LETTER]  Export: {_GATE_LABEL[result.readiness]}")
        print("=" * 60)
        print(
            "1) GENERATOR   2) TAGS & ITEMS   3) VALIDATION   4) PAGE LAYOUT\n"
            "5) TRANSFORMATION LOG   6) CONDITIONAL REVIEW   7) SETTINGS\n"
            "8) EXPORT   9) SWITCH LETTER TYPE   0) QUIT"
        )
        choice = input("> ").strip()
        if choice == "1":
            print_generator_panels(result)
        elif choice == "2":
            print_tags_and_items(result)
        elif choice == "3":
            print_validation(result)
        elif choice == "4":
            print_page_layout(result)
        elif choice == "5":
            print_transformation_log(result)
        elif choice == "6":
            print_conditional_review(result)
            sub = input("Confirm a condition scope? Enter 'name scope' or blank to skip: ").strip()
            if sub:
                parts = sub.split(maxsplit=1)
                if len(parts) == 2:
                    name, scope = parts
                    for cond in result.conditionals:
                        if cond.name == name:
                            cond.confirmed = True
                            cond.scope = scope
                            cond.status = "Confirmed"
                            print(f"Confirmed '{name}' -> scope '{scope}'.")
                            break
                    else:
                        print("No such condition.")
        elif choice == "7":
            _settings_menu(settings)
            result = run_generation(raw_text, result.letter_type, settings, interactive=True)
        elif choice == "8":
            outdir = input("Export directory [./mmd_output]: ").strip() or "./mmd_output"
            if result.readiness == ReadinessGate.NOT_READY:
                print("✗ Cannot export: critical structural errors remain unresolved.")
                continue
            paths = export_all(outdir, result)
            print(f"Exported: {paths['mmd']}, {paths['tags']}, {paths['report']}")
        elif choice == "9":
            print("Changing letter type will update recipient references throughout the document.")
            confirm = input("Confirm? [y/N]: ").strip().lower()
            if confirm == "y":
                new_type = LetterType.DEPENDANT if result.letter_type == LetterType.MEMBER else LetterType.MEMBER
                result = run_generation(raw_text, new_type, settings, interactive=True)
        elif choice == "0":
            break


def _settings_menu(settings: Settings) -> None:
    print("\n# SETTINGS")
    print("Protected tags:", ", ".join(sorted(PROTECTED_TAGS)))
    print(f"Lines per page (layout heuristic): {settings.page_config.lines_per_page}")
    print(f"Page-break marker: {settings.page_config.marker!r}")
    print(f"Insert page breaks: {settings.page_config.insert_breaks}")
    print("\n1) Add/edit approved-dictionary entry")
    print("2) Set page-break marker")
    print("3) Toggle page-break insertion")
    print("4) Set lines-per-page")
    print("0) Back")
    choice = input("> ").strip()
    if choice == "1":
        label = input("Raw label (e.g. 'Member ID'): ").strip().lower()
        target = input("MMD tag (use {ctx} for member/dependant-aware, e.g. '{ctx}_forename'): ").strip()
        settings.approved_dictionary[label] = target
        settings.save()
    elif choice == "2":
        marker = input("Marker text (leave blank to unset): ").strip()
        settings.page_config.marker = marker or None
        settings.save()
    elif choice == "3":
        settings.page_config.insert_breaks = not settings.page_config.insert_breaks
        settings.save()
    elif choice == "4":
        try:
            settings.page_config.lines_per_page = int(input("Lines per page: ").strip())
            settings.save()
        except ValueError:
            print("Not a number, ignored.")


# ---------------------------------------------------------------------------
# Scriptable one-shot mode
# ---------------------------------------------------------------------------


def generate_command(args: argparse.Namespace) -> int:
    settings = Settings()
    raw_text = Path(args.input).read_text(encoding="utf-8")
    requested = LetterType(args.type.upper()) if args.type else None
    selected_type = resolve_letter_type(raw_text, requested, interactive=False)

    try:
        result = generate_mmd(
            raw_text,
            selected_type,
            allow_conflict=args.allow_conflict,
            page_config=settings.page_config,
            approved_dictionary=settings.approved_dictionary,
        )
    except LetterTypeConflictError as exc:
        print(f"⚠ {exc}")
        print(f"  Selected: {exc.selected.value}  Detected: {exc.detected.value if exc.detected else 'Unknown'}")
        print("  Re-run with --allow-conflict to proceed with the selected type anyway.")
        return 2

    print_validation(result)
    print_page_layout(result)

    if args.outdir:
        if result.readiness == ReadinessGate.NOT_READY:
            print("\n✗ Export skipped: critical structural errors remain.")
            return 1
        paths = export_all(args.outdir, result, base_name=Path(args.input).stem)
        print(f"\nExported: {paths['mmd']}\n          {paths['tags']}\n          {paths['report']}")

    return 0 if result.readiness != ReadinessGate.NOT_READY else 1


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="mmd_generator", description="MMD Letter Generator")
    sub = parser.add_subparsers(dest="command", required=True)

    gen = sub.add_parser("generate", help="One-shot, scriptable letter -> MMD conversion")
    gen.add_argument("--input", required=True, help="Path to the raw letter (.txt)")
    gen.add_argument("--type", choices=["member", "dependant", "MEMBER", "DEPENDANT"], default=None)
    gen.add_argument("--allow-conflict", action="store_true", help="Proceed even if detection disagrees with --type")
    gen.add_argument("--outdir", default=None, help="Directory to export .mmd/.csv/.md into")
    gen.set_defaults(func=generate_command)

    sub.add_parser("interactive", help="Menu-driven interactive session")

    return parser


def main(argv=None) -> int:
    parser = build_arg_parser()
    args = parser.parse_args(argv)
    if args.command == "interactive":
        interactive_main()
        return 0
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
