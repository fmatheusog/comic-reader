import { useSyncExternalStore } from 'react';

import { getDb } from '@/shared/db';

export type ThemePref = 'system' | 'light' | 'sepia' | 'dark';

export type Settings = {
  theme: ThemePref;
  fontFamily: 'serif' | 'sans';
  /** px */
  fontSize: number;
  lineHeight: number;
  /** margem lateral em px */
  margin: number;
  /** duas páginas lado a lado com o aparelho deitado */
  dualPage: boolean;
  /** PDF: 'page' mostra a página inteira; 'width' ocupa toda a largura (a página rola na vertical) */
  pdfFit: 'page' | 'width';
};

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  fontFamily: 'serif',
  fontSize: 18,
  lineHeight: 1.6,
  margin: 20,
  dualPage: true,
  pdfFit: 'page',
};

let current: Settings = DEFAULT_SETTINGS;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

export async function loadSettings() {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'prefs'");
  if (row) {
    try {
      current = { ...DEFAULT_SETTINGS, ...JSON.parse(row.value) };
    } catch {
      current = DEFAULT_SETTINGS;
    }
  }
  emit();
}

export async function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  emit();
  const db = await getDb();
  await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('prefs', ?)", JSON.stringify(current));
}

export const getSettings = () => current;

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}
