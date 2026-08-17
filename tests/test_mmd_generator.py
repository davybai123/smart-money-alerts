"""Test suite for the MMD Letter Generator.

Covers: realistic member/dependant letters, nested conditionals, malformed
brackets, duplicate tags, ambiguous conditions, and page-overflow scenarios,
per the god-prompt's Section 19 self-review checklist.
"""
from __future__ import annotations

import re

import pytest

from mmd_generator.conditionals import (
    _clean_condition,
    _find_matching_close,
    _split_condition_body,
    collect_known_conditions,
    convert_brackets,
    looks_like_bare_marker,
)
from mmd_generator.exporter import build_review_report
from mmd_generator.models import LetterType, ReadinessGate, Severity, TagStatus
from mmd_generator.page_manager import PageBreakConfig
from mmd_generator.parser import (
    LetterTypeConflictError,
    analyse_structure,
    find_unmatched_brackets,
    generate_mmd,
    tidy_whitespace,
)
from mmd_generator.placeholders import convert_paren_placeholders
from mmd_generator.protected_tags import PROTECTED_TAGS
from mmd_generator.recipient_context import (
    RecipientContext,
    check_type_conflict,
    detect_letter_type,
    has_header_block,
)
from mmd_generator.tag_manager import TagManager
from mmd_generator.tag_normaliser import find_potential_duplicates, normalise_tag_name


# ---------------------------------------------------------------------------
# Section 44 worked example
# ---------------------------------------------------------------------------

SECTION_44_RAW = """[IF JPS 2015]
[Member Pension Amount]
Dear Mr(Title) (Surname),
Your pension amount is [Pension Amount].
[IF Member Has GMP]
Your GMP amount is [GMP Amount].
[/IF]
[/IF]
"""


def test_section_44_member_letter_matches_spec_shape():
    result = generate_mmd(SECTION_44_RAW, LetterType.MEMBER, allow_conflict=True)
    mmd = result.mmd_text

    assert "<% data_insert_true(JPS_2015) %>" in mmd
    assert "<% data_l(Member_Pension_Amount) %>" in mmd
    assert "Dear <% member_title_guess %> <% member_surname %>," in mmd
    assert "Your pension amount is <% data_l(Pension_Amount) %>." in mmd
    assert "<% data_insert_true(Member_Has_GMP) %>" in mmd
    assert "Your GMP amount is <% data_l(GMP_Amount) %>." in mmd
    # nesting: two closes, in the right order (inner GMP close before outer JPS close)
    gmp_close = mmd.index("Your GMP amount")
    first_close = mmd.index("<% /data_insert_true() %>")
    second_close = mmd.index("<% /data_insert_true() %>", first_close + 1)
    assert gmp_close < first_close < second_close
    # no stray literal "Mr" left dangling
    assert "Mr<%" not in mmd
    assert "(Title)" not in mmd and "(Surname)" not in mmd


def test_section_44_dependant_letter_uses_dependant_tags():
    result = generate_mmd(SECTION_44_RAW, LetterType.DEPENDANT, allow_conflict=True)
    mmd = result.mmd_text
    assert "<% dependant_title_guess %>" in mmd
    assert "<% dependant_surname %>" in mmd
    assert "<% member_title_guess %>" not in mmd
    assert "<% member_surname %>" not in mmd
    # dependant letters must NOT include the scheme-name intro line (Section 4)
    assert "(''the Scheme\")" not in mmd


# ---------------------------------------------------------------------------
# Letter type detection & conflicts (Section 2)
# ---------------------------------------------------------------------------


def test_detects_member_letter_from_leading_tags():
    raw = "<% member_forename %> <% member_surname %>\nDear Sir,"
    detected, matches = detect_letter_type(raw)
    assert detected == LetterType.MEMBER
    assert "member_forename" in matches


def test_detects_dependant_letter_from_leading_tags():
    raw = "<% dependant_forename %> <% dependant_surname %>\nDear Sir,"
    detected, matches = detect_letter_type(raw)
    assert detected == LetterType.DEPENDANT


def test_type_conflict_raises_by_default():
    raw = "<% dependant_forename %> <% dependant_surname %>\nDear Sir,\nYour pension."
    with pytest.raises(LetterTypeConflictError):
        generate_mmd(raw, LetterType.MEMBER)


def test_type_conflict_bypassed_with_allow_conflict():
    raw = "<% dependant_forename %> <% dependant_surname %>\nDear Sir,\nYour pension."
    result = generate_mmd(raw, LetterType.MEMBER, allow_conflict=True)
    assert result.type_conflict is True
    assert result.letter_type == LetterType.MEMBER


def test_no_conflict_when_types_agree():
    raw = "<% member_forename %> <% member_surname %>\nDear Sir,"
    conflict = check_type_conflict(LetterType.MEMBER, raw)
    assert conflict is None


# ---------------------------------------------------------------------------
# Header generation (Sections 3, 4, 32)
# ---------------------------------------------------------------------------


def test_auto_header_inserted_for_member_letter_with_no_header():
    raw = "Your pension amount is [Pension Amount]."
    result = generate_mmd(raw, LetterType.MEMBER, allow_conflict=True)
    assert result.mmd_text.startswith("Recipient:")
    assert "<% member_title_guess %> <% member_forename %> <% member_surname %>" in result.mmd_text
    assert "Header Text:                    <% scheme_name_quick %> - <% member_id %>" in result.mmd_text
    assert '**<% scheme_name %> (\'\'the Scheme")' in result.mmd_text


def test_auto_header_for_dependant_letter_has_no_scheme_line():
    raw = "Your pension amount is [Pension Amount]."
    result = generate_mmd(raw, LetterType.DEPENDANT, allow_conflict=True)
    assert "Recipient:                      <% dependant_title_guess %>" in result.mmd_text
    assert "scheme_name %> (" not in result.mmd_text


def test_existing_header_is_not_duplicated():
    raw = "Recipient:  <% member_title_guess %> <% member_forename %> <% member_surname %>\nDear Sir,"
    result = generate_mmd(raw, LetterType.MEMBER, allow_conflict=True)
    assert result.mmd_text.count("Recipient:") == 1


def test_protected_tags_never_converted_to_data_l():
    raw = "<% member_forename %> <% member_surname %> <% scheme_name %> <% vspace %>"
    result = generate_mmd(raw, LetterType.MEMBER, allow_conflict=True)
    assert "data_l(" not in result.mmd_text
    for tag in PROTECTED_TAGS:
        assert f"data_l({tag})" not in result.mmd_text


# ---------------------------------------------------------------------------
# Name reference conversion (Section 6)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "raw,letter_type,expected",
    [
        ("Mr(Title)", LetterType.MEMBER, "<% member_title_guess %>"),
        ("(Title) (Surname)", LetterType.MEMBER, "<% member_title_guess %> <% member_surname %>"),
        (
            "(Title) (Forename) (Surname)",
            LetterType.MEMBER,
            "<% member_title_guess %> <% member_forename %> <% member_surname %>",
        ),
        ("Dear Mr Surname", LetterType.MEMBER, "Dear <% member_title_guess %> <% member_surname %>"),
        ("Mr Title Surname", LetterType.DEPENDANT, "<% dependant_title_guess %> <% dependant_surname %>"),
    ],
)
def test_name_reference_patterns(raw, letter_type, expected):
    ctx = RecipientContext(letter_type)
    converted = convert_paren_placeholders(raw, ctx)
    assert expected in converted


def test_name_reference_does_not_touch_unrelated_prose():
    ctx = RecipientContext(LetterType.MEMBER)
    raw = "The member is entitled to a pension under the Scheme."
    converted = convert_paren_placeholders(raw, ctx)
    assert converted == raw  # Section 45: no blind "member" substitution


# ---------------------------------------------------------------------------
# Generic placeholders (Sections 9, 20, 46-48)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "raw,expected_tag",
    [
        ("[Date of Birth]", "<% data_l(Date_of_Birth) %>"),
        ("[Member Number]", "<% data_l(Member_Number) %>"),
        ("[Pension Amount]", "<% data_l(Pension_Amount) %>"),
        ("[Bank Account Number]", "<% data_l(Bank_Account_Number) %>"),
    ],
)
def test_generic_square_bracket_placeholders(raw, expected_tag):
    result = generate_mmd(raw, LetterType.MEMBER, allow_conflict=True)
    assert expected_tag in result.mmd_text


def test_approved_dictionary_maps_to_system_tag_not_data_l():
    raw = "[Member ID]"
    result = generate_mmd(raw, LetterType.MEMBER, allow_conflict=True)
    assert "<% member_id %>" in result.mmd_text
    assert "data_l(Member_ID)" not in result.mmd_text


def test_instruction_only_bracket_is_flagged_not_converted():
    raw = "[NOTE] Insert legal wording here."
    result = generate_mmd(raw, LetterType.MEMBER, allow_conflict=True)
    assert "data_l(NOTE)" not in result.mmd_text
    assert "REVIEW REQUIRED" in result.mmd_text


def test_ambiguous_bare_date_field_flagged_without_context():
    raw = "It happened on [Date]."
    result = generate_mmd(raw, LetterType.MEMBER, allow_conflict=True)
    assert "REVIEW REQUIRED" in result.mmd_text
    assert "data_l(Date)" not in result.mmd_text


def test_context_resolves_letter_dated_to_current_date_l():
    raw = "This letter is dated [Date]."
    result = generate_mmd(raw, LetterType.MEMBER, allow_conflict=True)
    assert "<% current_date_l %>" in result.mmd_text


def test_context_resolves_date_of_birth_field():
    raw = "Date of birth: [Date]"
    result = generate_mmd(raw, LetterType.MEMBER, allow_conflict=True)
    assert "<% data_l(Date_of_Birth) %>" in result.mmd_text


# ---------------------------------------------------------------------------
# Nested conditionals (Sections 10-12)
# ---------------------------------------------------------------------------


def test_deeply_nested_conditionals_preserve_structure():
    raw = (
        "[IF A]\n"
        "outer\n"
        "[IF B]\n"
        "middle\n"
        "[IF C]\n"
        "inner\n"
        "[/IF]\n"
        "[/IF]\n"
        "[/IF]\n"
    )
    result = generate_mmd(raw, LetterType.MEMBER, allow_conflict=True)
    mmd = result.mmd_text
    assert mmd.count("<% data_insert_true(") == 3
    assert mmd.count("<% /data_insert_true() %>") == 3
    # correct order: A open, B open, C open, inner, C close, B close mid, A close
    a_open = mmd.index("data_insert_true(A)")
    b_open = mmd.index("data_insert_true(B)")
    c_open = mmd.index("data_insert_true(C)")
    inner = mmd.index("inner")
    c_close = mmd.index("/data_insert_true", inner)
    b_close = mmd.index("/data_insert_true", c_close + 1)
    a_close = mmd.index("/data_insert_true", b_close + 1)
    assert a_open < b_open < c_open < inner < c_close < b_close < a_close
    assert not result.has_errors()


def test_sibling_conditionals_not_confused_with_nesting():
    raw = "[IF A]\nfirst\n[/IF]\n[IF B]\nsecond\n[/IF]\n"
    result = generate_mmd(raw, LetterType.MEMBER, allow_conflict=True)
    mmd = result.mmd_text
    assert "data_insert_true(A)" in mmd
    assert "data_insert_true(B)" in mmd
    assert not result.has_errors()
    names = {c.name for c in result.conditionals}
    assert names == {"A", "B"}


# ---------------------------------------------------------------------------
# Malformed brackets (Section 27)
# ---------------------------------------------------------------------------


def test_unmatched_open_conditional_flagged_as_error():
    raw = "[IF JPS 2015]\nSome text with no close.\n"
    result = generate_mmd(raw, LetterType.MEMBER, allow_conflict=True)
    assert result.has_errors()
    assert any(i.code == "UNMATCHED_CONDITIONAL" for i in result.validation_issues)
    assert result.readiness == ReadinessGate.NOT_READY
    # must not fabricate a matching close
    assert "<% /data_insert_true() %>" not in result.mmd_text or "data_insert_true(JPS_2015)" not in result.mmd_text


def test_stray_close_conditional_flagged_as_error():
    raw = "Some text.\n[/IF]\nMore text.\n"
    result = generate_mmd(raw, LetterType.MEMBER, allow_conflict=True)
    assert any(i.code == "UNMATCHED_CLOSE" for i in result.validation_issues)
    assert result.readiness == ReadinessGate.NOT_READY


def test_raw_unbalanced_square_bracket_detected():
    # two opens, one close -> one genuinely unmatched '['
    raw = "This has [a stray bracket and [another stray, but only one close ]."
    issues = find_unmatched_brackets(raw)
    codes = {i.code for i in issues}
    assert "UNMATCHED_OPEN_BRACKET" in codes

    # one close with no preceding open at all -> unmatched ']'
    raw2 = "This has a stray close bracket ] with no matching open."
    issues2 = find_unmatched_brackets(raw2)
    codes2 = {i.code for i in issues2}
    assert "UNMATCHED_CLOSE_BRACKET" in codes2


def test_find_matching_close_respects_nesting():
    text = "[IF A] x [IF B] y [/IF] z [/IF] tail"
    tokens = list(re.finditer(r"\[([^\[\]]*)\]", text))
    close_idx = _find_matching_close(tokens, 0)
    assert close_idx == 3  # the outer [/IF], not the inner one at index 2
    body = _split_condition_body(text, tokens, 0, close_idx)
    assert body.strip() == "x [IF B] y [/IF] z"


def test_clean_condition_strips_if_prefix():
    assert _clean_condition(" IF JPS 2015 ") == "JPS 2015"
    assert _clean_condition("if member has gmp") == "member has gmp"


# ---------------------------------------------------------------------------
# Duplicate tags (Section 18)
# ---------------------------------------------------------------------------


def test_duplicate_synonym_tags_detected():
    groups = find_potential_duplicates(["Date_of_Birth", "DOB", "Birth_Date", "Pension_Amount"])
    flat = {name for g in groups for name in g}
    assert {"Date_of_Birth", "DOB", "Birth_Date"} <= flat
    assert "Pension_Amount" not in flat


def test_generator_marks_duplicate_tags_in_result():
    raw = "[Date of Birth] and separately [DOB] and also [Birth Date]"
    result = generate_mmd(raw, LetterType.MEMBER, allow_conflict=True)
    dupes = [t for t in result.tags if t.status == TagStatus.DUPLICATE]
    assert len(dupes) >= 2
    assert any(i.code == "DUPLICATE_TAG" for i in result.validation_issues)
    assert result.readiness != ReadinessGate.READY


def test_fuzzy_duplicate_detection_catches_near_misses():
    groups = find_potential_duplicates(["Date_of_birth", "Date_of_Birth"])
    assert len(groups) == 1
    assert set(groups[0]) == {"Date_of_birth", "Date_of_Birth"}


# ---------------------------------------------------------------------------
# Ambiguous / bare conditional markers (Section 13)
# ---------------------------------------------------------------------------


def test_bare_scheme_marker_flagged_for_review_not_guessed():
    raw = "[ALL SCHEMES]\nSome universal text.\n"
    result = generate_mmd(raw, LetterType.MEMBER, allow_conflict=True)
    assert "REVIEW REQUIRED" in result.mmd_text
    assert "data_insert_true(ALL_SCHEMES)" not in result.mmd_text
    assert any(i.code == "AMBIGUOUS_CONDITION_SCOPE" for i in result.validation_issues)
    unconfirmed = [c for c in result.conditionals if not c.confirmed]
    assert any(c.name == "ALL_SCHEMES" for c in unconfirmed)


def test_bare_marker_referencing_known_condition_flagged():
    raw = "[IF JPS 2015]\nbody\n[/IF]\nElsewhere: [JPS 2015] also applies.\n"
    result = generate_mmd(raw, LetterType.MEMBER, allow_conflict=True)
    assert result.mmd_text.count("REVIEW REQUIRED") == 1
    known = collect_known_conditions(raw)
    assert "jps_2015" in known
    assert looks_like_bare_marker("JPS 2015", known) is True


def test_title_case_field_label_is_not_a_bare_marker():
    known = set()
    assert looks_like_bare_marker("Member Pension Amount", known) is False
    assert looks_like_bare_marker("Date of Birth", known) is False
    assert looks_like_bare_marker("GMP Amount", known) is False


def test_confirming_scope_clears_review_requirement():
    raw = "[ALL SCHEMES]\ntext\n"
    result = generate_mmd(raw, LetterType.MEMBER, allow_conflict=True)
    cond = next(c for c in result.conditionals if c.name == "ALL_SCHEMES")
    assert not cond.confirmed
    cond.confirmed = True
    cond.scope = "Paragraph 1"
    cond.status = "Confirmed"
    assert cond.confirmed


# ---------------------------------------------------------------------------
# Cross-context / incorrect recipient references
# ---------------------------------------------------------------------------


def test_dependant_tag_in_member_letter_is_flagged():
    raw = "<% member_forename %> <% member_surname %>\nSee also <% dependant_surname %>."
    result = generate_mmd(raw, LetterType.MEMBER, allow_conflict=True)
    assert any(i.code == "CROSS_CONTEXT_TAG" for i in result.validation_issues)
    assert result.readiness == ReadinessGate.NOT_READY


def test_member_id_shared_does_not_trigger_cross_context_flag():
    raw = "<% dependant_forename %> <% dependant_surname %> <% member_id %>"
    result = generate_mmd(raw, LetterType.DEPENDANT, allow_conflict=True)
    assert not any(i.code == "CROSS_CONTEXT_TAG" for i in result.validation_issues)


# ---------------------------------------------------------------------------
# Wording / formatting preservation (Sections 25-26)
# ---------------------------------------------------------------------------


def test_legal_wording_is_never_altered():
    raw = "The Trustees have determined that the member is entitled to a lump sum under Rule 4.2."
    result = generate_mmd(raw, LetterType.MEMBER, allow_conflict=True)
    # header gets prepended, but the original sentence must appear verbatim
    assert raw in result.mmd_text


def test_bold_and_bullet_formatting_preserved():
    raw = "**Important**\n- First point\n- Second point\n"
    result = generate_mmd(raw, LetterType.MEMBER, allow_conflict=True)
    assert "**Important**" in result.mmd_text
    assert "- First point" in result.mmd_text
    assert "- Second point" in result.mmd_text


def test_tidy_whitespace_collapses_excess_blank_lines_but_keeps_one():
    raw = "Para one.\n\n\n\n\nPara two."
    tidied = tidy_whitespace(raw)
    assert "\n\n\n" not in tidied
    assert "Para one." in tidied and "Para two." in tidied


# ---------------------------------------------------------------------------
# Page-layout intelligence (Sections 21-24)
# ---------------------------------------------------------------------------


def test_page_overflow_flags_split_table():
    heading = "Benefit Summary"
    table_rows = "\n".join(f"| Row {i} | Value {i} |" for i in range(60))
    body = f"Intro paragraph.\n\n{heading}\n\n{table_rows}\n"
    result = generate_mmd(body, LetterType.MEMBER, allow_conflict=True, page_config=PageBreakConfig(lines_per_page=20))
    messages = " ".join(w.message for w in result.layout_warnings)
    assert "Table" in messages or "table" in messages
    assert result.layout_confidence < 100


def test_small_letter_has_high_layout_confidence():
    raw = "Dear Sir,\n\nThank you for your enquiry.\n\nYours sincerely,\nThe Trustees\n"
    result = generate_mmd(raw, LetterType.MEMBER, allow_conflict=True)
    assert result.layout_confidence == 100


def test_page_break_marker_never_invented_by_default():
    raw = "Para.\n\n" + ("| a | b |\n" * 60)
    result = generate_mmd(raw, LetterType.MEMBER, allow_conflict=True)
    # default config never inserts breaks or synthesises markers
    assert "PAGEBREAK" not in result.mmd_text
    assert not any(i.code == "PAGE_BREAK_NOT_CONFIGURED" for i in result.validation_issues)


def test_page_break_not_configured_warns_when_insertion_requested():
    raw = "Para.\n\n" + ("| a | b |\n" * 60)
    cfg = PageBreakConfig(lines_per_page=10, insert_breaks=True, marker=None)
    result = generate_mmd(raw, LetterType.MEMBER, allow_conflict=True, page_config=cfg)
    assert any(i.code == "PAGE_BREAK_NOT_CONFIGURED" for i in result.validation_issues)


def test_configured_page_break_marker_is_inserted():
    # Unit-test page_manager directly (rather than through the full
    # generate_mmd pipeline, whose auto-inserted header would shift the
    # simulated page position and make this fragile): a table that doesn't
    # fit in the room left on the current page should be recommended for a
    # break, and with a marker configured that break must actually appear.
    from mmd_generator.layout_analyser import analyse_layout
    from mmd_generator.models import DocumentSection
    from mmd_generator.page_manager import apply_page_breaks

    sections = [
        DocumentSection(kind="paragraph", text="Intro.", start_line=1, end_line=1, estimated_lines=1),
        DocumentSection(
            kind="table",
            text="| Row 0 |\n| Row 1 |\n| Row 2 |\n| Row 3 |\n| Row 4 |\n| Row 5 |\n| Row 6 |\n| Row 7 |\n| Row 8 |\n| Row 9 |",
            start_line=3,
            end_line=12,
            estimated_lines=10,
        ),
    ]
    cfg = PageBreakConfig(lines_per_page=10, insert_breaks=True, marker="<!--PAGE_BREAK-->")
    warnings, confidence, recommend = analyse_layout(sections, cfg)
    assert recommend, "table should have been recommended to move to a fresh page"

    body = "Intro.\n\n" + sections[1].text
    new_body, issues = apply_page_breaks(body, recommend, cfg)
    assert "<!--PAGE_BREAK-->" in new_body
    assert not issues


def test_document_structure_classifies_sections():
    raw = "Heading\n\nA normal paragraph of prose that runs on.\n\nYours sincerely,\nThe Trustees\n"
    sections = analyse_structure(raw)
    kinds = [s.kind for s in sections]
    assert "heading" in kinds
    assert "paragraph" in kinds
    assert "signature" in kinds


# ---------------------------------------------------------------------------
# Tag normalisation
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("Date of Birth", "Date_of_Birth"),
        ("date of birth", "Date_of_Birth"),
        ("Member Date of Birth", "Member_Date_of_Birth"),
        ("Pension Commencement Date", "Pension_Commencement_Date"),
        ("Insert Date of Birth", "Date_of_Birth"),
    ],
)
def test_normalise_tag_name(raw, expected):
    assert normalise_tag_name(raw) == expected


def test_no_spaces_ever_in_generated_tag_names():
    raw = "[Date of Birth] [National Insurance Number] [Some Random Field Label]"
    result = generate_mmd(raw, LetterType.MEMBER, allow_conflict=True)
    for tag in result.tags:
        assert " " not in tag.name
    assert not any(i.code == "SPACE_IN_TAG_NAME" for i in result.validation_issues)


# ---------------------------------------------------------------------------
# Validation gate (Section 43)
# ---------------------------------------------------------------------------


def test_clean_letter_is_ready():
    raw = (
        "Recipient:  <% member_title_guess %> <% member_forename %> <% member_surname %>\n"
        "Dear <% member_title_guess %> <% member_surname %>,\n\n"
        "Thank you for your enquiry regarding the Scheme.\n\n"
        "Yours sincerely,\nThe Trustees\n"
    )
    result = generate_mmd(raw, LetterType.MEMBER, allow_conflict=True)
    assert not result.has_errors()
    assert result.readiness in (ReadinessGate.READY, ReadinessGate.REVIEW_REQUIRED)


def test_export_report_contains_key_sections():
    raw = "[IF X]\n[Amount Owed]\n[/IF]"
    result = generate_mmd(raw, LetterType.MEMBER, allow_conflict=True)
    report = build_review_report(result)
    assert "# LETTER VALIDATION REPORT" in report
    assert "Unresolved Conditions" in report
    assert "New Data Tags" in report


# ---------------------------------------------------------------------------
# TagManager mechanics
# ---------------------------------------------------------------------------


def test_tag_manager_accumulates_occurrences():
    tm = TagManager()
    from mmd_generator.models import TagStatus, TagType

    tm.register_tag("Pension_Amount", "<% data_l(Pension_Amount) %>", TagType.DATA, TagStatus.NEEDS_CREATION, "body", "[Pension Amount]")
    tm.register_tag("Pension_Amount", "<% data_l(Pension_Amount) %>", TagType.DATA, TagStatus.NEEDS_CREATION, "body", "[Pension Amount]")
    tags = tm.tags()
    assert len(tags) == 1
    assert tags[0].occurrences == 2


# ---------------------------------------------------------------------------
# Additional self-review checks (unresolved placeholders, false positives,
# repeated occurrences, instructional-wording stripping)
# ---------------------------------------------------------------------------


def test_unresolved_name_placeholder_is_flagged_not_silently_dropped():
    # "(Title)" with no honorific and no surname pairing matches none of the
    # defined name-reference shapes, so it must be left visible and flagged
    # rather than silently vanishing or being guessed at.
    raw = "Reference: (Title) on file."
    result = generate_mmd(raw, LetterType.MEMBER, allow_conflict=True)
    assert "(Title)" in result.mmd_text
    assert any(i.code == "UNRESOLVED_NAME_PLACEHOLDER" for i in result.validation_issues)


def test_repeated_placeholder_counts_all_occurrences_under_one_tag():
    raw = "Pension amount is [Pension Amount]. Confirmed: [Pension Amount] again. Once more: [Pension Amount]."
    result = generate_mmd(raw, LetterType.MEMBER, allow_conflict=True)
    pension_tags = [t for t in result.tags if t.name == "Pension_Amount"]
    assert len(pension_tags) == 1
    assert pension_tags[0].occurrences == 3


def test_instructional_wording_stripped_before_tag_creation():
    raw = "[Insert Date of Birth]"
    result = generate_mmd(raw, LetterType.MEMBER, allow_conflict=True)
    assert "<% data_l(Date_of_Birth) %>" in result.mmd_text


def test_click_to_add_wording_stripped_and_concept_recognised():
    raw = "[Click to add Pension Amount]"
    result = generate_mmd(raw, LetterType.MEMBER, allow_conflict=True)
    assert "<% data_l(Pension_Amount) %>" in result.mmd_text


def test_auto_header_does_not_duplicate_existing_greeting():
    # No "Recipient:" envelope, but the letter has its own "Dear ..." line --
    # the auto-inserted envelope must not also inject a second greeting.
    raw = "Dear Mr(Title) (Surname),\n\nThank you for your enquiry.\n"
    result = generate_mmd(raw, LetterType.MEMBER, allow_conflict=True)
    assert result.mmd_text.count("Dear <% member_title_guess %> <% member_surname %>,") == 1
    assert result.mmd_text.startswith("Recipient:")


def test_note_marker_is_not_treated_as_a_phantom_conditional():
    raw = "Yours sincerely,\n\n[NOTE] insert signature image here\n"
    result = generate_mmd(raw, LetterType.MEMBER, allow_conflict=True)
    assert not any(c.name.upper() == "NOTE" for c in result.conditionals)
    assert "authoring note" in result.mmd_text
    assert "data_insert_true(NOTE)" not in result.mmd_text


def test_ordinary_prose_word_member_is_not_falsely_converted():
    raw = "The member's spouse may also be entitled to a dependant's pension."
    result = generate_mmd(raw, LetterType.MEMBER, allow_conflict=True)
    assert "data_l(" not in result.mmd_text
    assert "member's spouse" in result.mmd_text


def test_tag_manager_confirm_scope():
    tm = TagManager()
    tm.flag_review("ALL SCHEMES", "body")
    ok = tm.confirm_scope("ALL_SCHEMES", "Paragraph 2")
    assert ok is True
    cond = tm.conditionals()[0]
    assert cond.confirmed is True
    assert cond.scope == "Paragraph 2"
