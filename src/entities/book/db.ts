import { getDb } from '@/shared/db';

export type BookFormat = 'epub' | 'cbz' | 'pdf';
export type Filter = 'all' | 'reading' | 'new' | 'read';
export type SortKey = 'recent' | 'title' | 'added';

export type Book = {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  /** Obra a que o capítulo pertence (null = livro avulso) */
  series: string | null;
  seriesNumber: number | null;
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
  description: string | null;
  series: string | null;
  series_number: number | null;
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
  description: r.description,
  series: r.series,
  seriesNumber: r.series_number,
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

export type NewBook = Pick<
  Book,
  'id' | 'title' | 'author' | 'description' | 'series' | 'seriesNumber' | 'format' | 'coverPath' | 'rtl' | 'pageCount'
>;

export async function insertBook(b: NewBook) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO books (id, title, author, description, series, series_number, format, cover_path, added_at, rtl, page_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    b.id,
    b.title,
    b.author,
    b.description,
    b.series,
    b.seriesNumber,
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

/** Todos os livros que batem com a busca (e, se o termo casa com um capítulo, a obra inteira). O filtro de leitura é feito depois, por obra. */
export async function listBooks(opts: { search: string; sort: SortKey }): Promise<Book[]> {
  const db = await getDb();
  const where: string[] = [];
  const params: string[] = [];
  if (opts.search.trim()) {
    where.push(
      `(title LIKE ? OR author LIKE ? OR series LIKE ? OR series COLLATE NOCASE IN (
         SELECT series FROM books WHERE series IS NOT NULL AND (title LIKE ? OR author LIKE ?)))`,
    );
    const q = `%${opts.search.trim()}%`;
    params.push(q, q, q, q, q);
  }
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

export type BookInfo = Pick<Book, 'title' | 'author' | 'description' | 'series' | 'seriesNumber'>;

/** Edição manual dos metadados; campos vazios viram NULL. */
export async function updateBookInfo(id: string, info: BookInfo) {
  const db = await getDb();
  await db.runAsync(
    'UPDATE books SET title = ?, author = ?, description = ?, series = ?, series_number = ? WHERE id = ?',
    info.title.trim(),
    info.author?.trim() || null,
    info.description?.trim() || null,
    info.series?.trim() || null,
    info.series?.trim() ? info.seriesNumber : null,
    id,
  );
}

/** Capítulos de uma obra na ordem de leitura (número; sem número vão para o fim, por título). */
export async function listSeriesBooks(series: string): Promise<Book[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    `SELECT * FROM books WHERE series = ? COLLATE NOCASE
     ORDER BY series_number IS NULL, series_number ASC, title COLLATE NOCASE ASC`,
    series,
  );
  return rows.map(toBook);
}

/** Renomeia a obra em todos os capítulos (também serve para mesclar duas obras). */
export async function renameSeries(from: string, to: string) {
  const db = await getDb();
  await db.runAsync('UPDATE books SET series = ? WHERE series = ? COLLATE NOCASE', to.trim(), from);
}

/** Livros que ainda não passaram pela detecção de obra. */
export async function listBooksWithoutSeries(): Promise<Pick<Book, 'id' | 'title'>[]> {
  const db = await getDb();
  return db.getAllAsync<{ id: string; title: string }>('SELECT id, title FROM books WHERE series IS NULL');
}

export async function setBookSeries(id: string, series: string, number: number | null) {
  const db = await getDb();
  await db.runAsync('UPDATE books SET series = ?, series_number = ? WHERE id = ?', series, number, id);
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
