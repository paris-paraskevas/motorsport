const KEY = 'paddock:consent';
const VERSION = 1;

export interface ConsentCategories {
  functional: true;
  analytics: boolean;
  marketing: boolean;
}

export interface ConsentRecord {
  version: number;
  decidedAt: string;
  categories: ConsentCategories;
}

export function getConsent(): ConsentRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentRecord;
    if (parsed.version !== VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setConsent(categories: ConsentCategories): void {
  if (typeof window === 'undefined') return;
  const record: ConsentRecord = {
    version: VERSION,
    decidedAt: new Date().toISOString(),
    categories,
  };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    /* ignore */
  }
}

export function clearConsent(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export const ACCEPT_ALL: ConsentCategories = {
  functional: true,
  analytics: true,
  marketing: true,
};

export const REJECT_ALL: ConsentCategories = {
  functional: true,
  analytics: false,
  marketing: false,
};
