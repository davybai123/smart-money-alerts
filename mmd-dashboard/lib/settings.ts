// Section 41 Settings: protected tags (read-only), approved tag dictionary,
// and page-break configuration, persisted to localStorage in the browser.

import { DEFAULT_APPROVED_TAG_DICTIONARY } from "./protectedTags";
import { defaultPageConfig, type PageBreakConfig } from "./pageManager";

export interface AppSettings {
  approvedDictionary: Record<string, string>;
  pageConfig: PageBreakConfig;
}

const STORAGE_KEY = "mmd-generator-settings";

export function defaultSettings(): AppSettings {
  return {
    approvedDictionary: { ...DEFAULT_APPROVED_TAG_DICTIONARY },
    pageConfig: defaultPageConfig(),
  };
}

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return defaultSettings();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw);
    return {
      approvedDictionary: { ...DEFAULT_APPROVED_TAG_DICTIONARY, ...(parsed.approvedDictionary ?? {}) },
      pageConfig: { ...defaultPageConfig(), ...(parsed.pageConfig ?? {}) },
    };
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(settings: AppSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
