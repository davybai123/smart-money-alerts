// Tag & conditional-item registry (Sections 15-19). Port of tag_manager.py.

import type { ConditionalRecord, TagRecord, TagStatus, TagType } from "./models";
import { findPotentialDuplicates, normaliseTagName } from "./tagNormaliser";

export class TagManager {
  private tagsByName = new Map<string, TagRecord>();
  private conditionalsByName = new Map<string, ConditionalRecord>();

  registerTag(
    name: string,
    mmdSyntax: string,
    tagType: TagType,
    status: TagStatus,
    location: string,
    sourceText: string,
  ): TagRecord {
    let rec = this.tagsByName.get(name);
    if (!rec) {
      rec = { name, mmdSyntax, tagType, status, occurrences: 0, locations: [], sourceTexts: [], notes: "" };
      this.tagsByName.set(name, rec);
    }
    rec.occurrences += 1;
    rec.locations.push(location);
    rec.sourceTexts.push(sourceText);
    return rec;
  }

  tags(): TagRecord[] {
    return [...this.tagsByName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  deduplicate(): string[][] {
    const names = [...this.tagsByName.keys()];
    const groups = findPotentialDuplicates(names);
    for (const group of groups) {
      for (const n of group) {
        const others = group.filter((g) => g !== n).join(", ");
        const rec = this.tagsByName.get(n)!;
        rec.status = "Duplicate";
        rec.notes = `Potential duplicate of: ${others}`;
      }
    }
    return groups;
  }

  registerConditional(
    name: string,
    mmdOpen: string,
    mmdClose: string,
    section: string,
    needsCreation = true,
  ): ConditionalRecord {
    let rec = this.conditionalsByName.get(name);
    if (!rec) {
      rec = {
        name,
        mmdOpen,
        mmdClose,
        occurrences: 0,
        sections: [],
        needsCreation,
        confirmed: false,
        scope: section,
        status: needsCreation ? "Needs Creation" : "Existing",
      };
      this.conditionalsByName.set(name, rec);
    }
    rec.occurrences += 1;
    if (!rec.sections.includes(section)) rec.sections.push(section);
    return rec;
  }

  flagReview(rawMarker: string, section: string): ConditionalRecord {
    const name = normaliseTagName(rawMarker) || rawMarker.trim();
    let rec = this.conditionalsByName.get(name);
    if (!rec) {
      rec = {
        name,
        mmdOpen: "",
        mmdClose: "",
        occurrences: 0,
        sections: [],
        needsCreation: true,
        confirmed: false,
        scope: "Unknown",
        status: "Review Required",
      };
      this.conditionalsByName.set(name, rec);
    }
    rec.occurrences += 1;
    if (!rec.sections.includes(section)) rec.sections.push(section);
    return rec;
  }

  confirmScope(name: string, scope: string): boolean {
    const rec = this.conditionalsByName.get(name);
    if (!rec) return false;
    rec.scope = scope;
    rec.confirmed = true;
    rec.status = "Confirmed";
    return true;
  }

  conditionals(): ConditionalRecord[] {
    return [...this.conditionalsByName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
}
