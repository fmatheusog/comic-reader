import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const MIGRATIONS: string[] = [
  `CREATE TABLE books (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    author TEXT,
    format TEXT NOT NULL,
    cover_path TEXT,
    added_at INTEGER NOT NULL,
    last_read_at INTEGER,
    progress REAL NOT NULL DEFAULT 0,
    position TEXT,
    finished INTEGER NOT NULL DEFAULT 0,
    rtl INTEGER NOT NULL DEFAULT 0,
    page_count INTEGER
  );
  CREATE INDEX idx_books_last_read ON books(last_read_at);`,
  `CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);`,
  `ALTER TABLE books ADD COLUMN description TEXT;`,
  `ALTER TABLE books ADD COLUMN series TEXT;
   ALTER TABLE books ADD COLUMN series_number REAL;
   CREATE INDEX idx_books_series ON books(series COLLATE NOCASE, series_number);`,
];

async function migrate(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  await db.execAsync('PRAGMA journal_mode = WAL;');
  while (version < MIGRATIONS.length) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
    version++;
  }
}

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('library.db').then(async (db) => {
      await migrate(db);
      return db;
    });
  }
  return dbPromise;
}
