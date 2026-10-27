import { getDb } from './index';

/** Pares chave/valor em JSON para dados do app que não são ajustes (por exemplo, o catálogo do Drive). */
export async function getKv<T>(key: string): Promise<T | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export async function setKv(key: string, value: unknown) {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', key, JSON.stringify(value));
}

export async function deleteKv(key: string) {
  const db = await getDb();
  await db.runAsync('DELETE FROM kv WHERE key = ?', key);
}
