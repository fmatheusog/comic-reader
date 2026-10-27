import { getDb } from '@/shared/db';

import { listBooksWithoutSeries, setBookSeries } from './db';
import { guessSeries } from './series';

const MARKER = 'series_backfill_v1';

/** Uma vez só: descobre a obra dos livros importados antes de existir esse campo, pelo título. */
export async function backfillSeries() {
  const db = await getDb();
  const done = await db.getFirstAsync('SELECT value FROM settings WHERE key = ?', MARKER);
  if (done) return;
  for (const book of await listBooksWithoutSeries()) {
    const guess = guessSeries(book.title);
    if (guess) await setBookSeries(book.id, guess.series, guess.number);
  }
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', MARKER, '1');
}
