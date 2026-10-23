import { getDb } from './index';

export type BookFormat = 'epub' | 'cbz' | 'pdf';
export type Filter = 'all' | 'reading' | 'new' | 'read';
export type SortKey = 'recent' | 'title' | 'added';

export type Book = {
  id: string;
  title: string;
  author: string | null;
  format: BookFormat;
  coverPath: string | null;
  addedAt: number;
  lastReadAt: number | null;
  progress: number;
  position: string | null;
  finished: boolean;
  rtl: boolean;
  pageCount: number | null;
};

type Row = {
  id: string;
  title: string;
  author: string | null;
  format: BookFormat;
  cover_path: string | null;
  added_at: number;
  last_read_at: number | null;
  progress: number;
  position: string | null;
  finished: number;
  rtl: number;
  page_count: number | null;
};

const toBook = (r: Row): Book => ({
  id: r.id,
  title: r.title,
  author: r.author,
  format: r.format,
  coverPath: r.cover_path,
  addedAt: r.added_at,
  lastReadAt: r.last_read_at,
  progress: r.progress,
  position: r.position,
  finished: r.finished === 1,
  rtl: r.rtl === 1,
  pageCount: r.page_count,
});

export type NewBook = Pick<Book, 'id' | 'title' | 'author' | 'format' | 'coverPath' | 'rtl' | 'pageCount'>;

export async function insertBook(b: NewBook) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO books (id, title, author, format, cover_path, added_at, rtl, page_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    b.id,
    b.title,
    b.author,
    b.format,
    b.coverPath,
    Date.now(),
    b.rtl ? 1 : 0,
    b.pageCount,
  );
}

export async function getBook(id: string): Promise<Book | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Row>('SELECT * FROM books WHERE id = ?', id);
  return row ? toBook(row) : null;
}

export async function listBooks(opts: {
  search: string;
  filter: Filter;
  sort: SortKey;
}): Promise<Book[]> {
  const db = await getDb();
  const where: string[] = [];
  const params: string[] = [];
  if (opts.search.trim()) {
    where.push('(title LIKE ? OR author LIKE ?)');
    const q = `%${opts.search.trim()}%`;
    params.push(q, q);
  }
  if (opts.filter === 'reading') where.push('finished = 0 AND last_read_at IS NOT NULL');
  if (opts.filter === 'new') where.push('finished = 0 AND last_read_at IS NULL');
  if (opts.filter === 'read') where.push('finished = 1');
  const order =
    opts.sort === 'title'
      ? 'title COLLATE NOCASE ASC'
      : opts.sort === 'added'
        ? 'added_at DESC'
        : 'COALESCE(last_read_at, added_at) DESC';
  const sql = `SELECT * FROM books ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${order}`;
  const rows = await db.getAllAsync<Row>(sql, params);
  return rows.map(toBook);
}

export async function listContinueReading(limit = 10): Promise<Book[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    `SELECT * FROM books WHERE finished = 0 AND last_read_at IS NOT NULL
     ORDER BY last_read_at DESC LIMIT ?`,
    limit,
  );
  return rows.map(toBook);
}

export async function saveProgress(id: string, progress: number, position: string) {
  const db = await getDb();
  const p = Math.min(1, Math.max(0, progress));
  await db.runAsync(
    'UPDATE books SET progress = ?, position = ?, last_read_at = ?, finished = CASE WHEN ? >= 0.98 THEN 1 ELSE finished END WHERE id = ?',
    p,
    position,
    Date.now(),
    p,
    id,
  );
}

export async function renameBook(id: string, title: string) {
  const db = await getDb();
  await db.runAsync('UPDATE books SET title = ? WHERE id = ?', title.trim(), id);
}

export async function setFinished(id: string, finished: boolean) {
  const db = await getDb();
  await db.runAsync(
    finished
      ? 'UPDATE books SET finished = 1, progress = 1 WHERE id = ?'
      : 'UPDATE books SET finished = 0, progress = 0, position = NULL, last_read_at = NULL WHERE id = ?',
    id,
  );
}

export async function setRtl(id: string, rtl: boolean) {
  const db = await getDb();
  await db.runAsync('UPDATE books SET rtl = ? WHERE id = ?', rtl ? 1 : 0, id);
}

export async function updateBookMeta(
  id: string,
  meta: { title?: string; author?: string | null; coverPath?: string | null; pageCount?: number | null },
) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE books SET title = COALESCE(?, title), author = COALESCE(?, author),
     cover_path = COALESCE(?, cover_path), page_count = COALESCE(?, page_count) WHERE id = ?`,
    meta.title ?? null,
    meta.author ?? null,
    meta.coverPath ?? null,
    meta.pageCount ?? null,
    id,
  );
}

export async function deleteBookRow(id: string) {
  const db = await getDb();
  await db.runAsync('DELETE FROM books WHERE id = ?', id);
}
