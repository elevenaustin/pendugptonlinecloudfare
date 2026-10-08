import type { SupportedStorage } from "@supabase/supabase-js";

/**
 * Standard browser session & local storage provider for Supabase Auth
 */
export const previewAuthStorage: SupportedStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== "undefined") {
        return window.localStorage.getItem(key);
      }
    } catch {
      /* ignore */
    }
    return null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, value);
      }
    } catch {
      /* ignore */
    }
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(key);
      }
    } catch {
      /* ignore */
    }
  },
};

export function brokeredPreviewStorage(): SupportedStorage {
  return previewAuthStorage;
}
