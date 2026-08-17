// Protected / system MMD tags (Sections 8, 33) + the editable approved tag
// dictionary (Section 49). Port of mmd_generator/protected_tags.py.

import type { LetterType } from "./models";

export const PROTECTED_TAGS: ReadonlySet<string> = new Set([
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
]);

export interface FieldMap {
  title: string;
  forename: string;
  surname: string;
  address: string;
  postcode: string;
  id: string;
}

export const MEMBER_FIELDS: FieldMap = {
  title: "member_title_guess",
  forename: "member_forename",
  surname: "member_surname",
  address: "member_address",
  postcode: "member_postcode_or_foreign_country",
  id: "member_id",
};

export const DEPENDANT_FIELDS: FieldMap = {
  title: "dependant_title_guess",
  forename: "dependant_forename",
  surname: "dependant_surname",
  address: "dependant_address",
  postcode: "dependant_postcode_or_foreign_country",
  // Section 5: the member ID may still relate to the underlying member
  // even when the recipient is a dependant.
  id: "member_id",
};

export function fieldsFor(letterType: LetterType): FieldMap {
  return letterType === "MEMBER" ? MEMBER_FIELDS : DEPENDANT_FIELDS;
}

export function isProtected(tagName: string): boolean {
  return PROTECTED_TAGS.has(tagName);
}

// Section 49: approved tag dictionary. Values containing "{ctx}" are
// recipient-context sensitive and get formatted with "member"/"dependant".
export const DEFAULT_APPROVED_TAG_DICTIONARY: Record<string, string> = {
  title: "{ctx}_title_guess",
  forename: "{ctx}_forename",
  "first name": "{ctx}_forename",
  "christian name": "{ctx}_forename",
  surname: "{ctx}_surname",
  "last name": "{ctx}_surname",
  address: "{ctx}_address",
  postcode: "{ctx}_postcode_or_foreign_country",
  "post code": "{ctx}_postcode_or_foreign_country",
  "document date": "current_date_l",
  "letter date": "current_date_l",
  "todays date": "current_date_l",
  "date of letter": "current_date_l",
  "scheme name": "scheme_name",
  "scheme name quick": "scheme_name_quick",
  "member id": "member_id",
  "member reference": "member_id",
};
