"""Protected / system MMD tags that must never be auto-converted (Sections 8, 33).

Also holds the editable "approved tag dictionary" (Section 49) that maps
common raw-letter labels onto existing MMD system tags, in priority order
ahead of freshly-minted ``data_l()`` tags (Section 48).
"""
from __future__ import annotations

from typing import Dict, Set

from .models import LetterType

# Section 33: protected system tags. Never automatically renamed or converted.
PROTECTED_TAGS: Set[str] = {
    "member_title_guess",
    "member_forename",
    "member_surname",
    "member_address",
    "member_postcode_or_foreign_country",
    "member_id",
    "dependant_title_guess",
    "dependant_forename",
    "dependant_surname",
    "dependant_address",
    "dependant_postcode_or_foreign_country",
    "current_date_l",
    "scheme_name_quick",
    "scheme_name",
    "vspace",
}

# Section 5: recipient context field families, keyed by concept.
MEMBER_FIELDS: Dict[str, str] = {
    "title": "member_title_guess",
    "forename": "member_forename",
    "surname": "member_surname",
    "address": "member_address",
    "postcode": "member_postcode_or_foreign_country",
    "id": "member_id",
}

DEPENDANT_FIELDS: Dict[str, str] = {
    "title": "dependant_title_guess",
    "forename": "dependant_forename",
    "surname": "dependant_surname",
    "address": "dependant_address",
    "postcode": "dependant_postcode_or_foreign_country",
    # Section 5: the member ID may still relate to the underlying member
    # even when the recipient is a dependant.
    "id": "member_id",
}


def fields_for(letter_type: LetterType) -> Dict[str, str]:
    return MEMBER_FIELDS if letter_type == LetterType.MEMBER else DEPENDANT_FIELDS


def is_protected(tag_name: str) -> bool:
    return tag_name in PROTECTED_TAGS


# Section 49: approved tag dictionary. Values containing "{ctx}" are
# recipient-context sensitive and get formatted with "member"/"dependant".
# This dictionary is intentionally a plain module-level dict so Settings can
# load/replace it at runtime (see app.py `Settings`).
DEFAULT_APPROVED_TAG_DICTIONARY: Dict[str, str] = {
    "title": "{ctx}_title_guess",
    "forename": "{ctx}_forename",
    "first name": "{ctx}_forename",
    "christian name": "{ctx}_forename",
    "surname": "{ctx}_surname",
    "last name": "{ctx}_surname",
    "address": "{ctx}_address",
    "postcode": "{ctx}_postcode_or_foreign_country",
    "post code": "{ctx}_postcode_or_foreign_country",
    "document date": "current_date_l",
    "letter date": "current_date_l",
    "todays date": "current_date_l",
    "date of letter": "current_date_l",
    "scheme name": "scheme_name",
    "scheme name quick": "scheme_name_quick",
    "member id": "member_id",
    "member reference": "member_id",
}
