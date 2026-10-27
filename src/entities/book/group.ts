import type { Book } from './db';

// mesma regra de agrupamento de seriesKey (series.ts); sem import para os testes rodarem direto no Node
const keyOf = (name: string) => name.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

export type SeriesGroup = {
  kind: 'series';
  key: string;
  name: string;
  /** Capítulos na ordem de leitura */
  books: Book[];
};
export type LibraryItem = { kind: 'book'; book: Book } | SeriesGroup;

const byChapter = (a: Book, b: Book) => {
  if (a.seriesNumber == null && b.seriesNumber == null) return a.title.localeCompare(b.title, undefined, { numeric: true });
  if (a.seriesNumber == null) return 1;
  if (b.seriesNumber == null) return -1;
  return a.seriesNumber - b.seriesNumber;
};

/** Junta os capítulos de cada obra num item só, na posição do primeiro que aparece na lista. */
export function groupBySeries(books: Book[]): LibraryItem[] {
  const items: LibraryItem[] = [];
  const groups = new Map<string, SeriesGroup>();
  for (const book of books) {
    if (!book.series) {
      items.push({ kind: 'book', book });
      continue;
    }
    const key = keyOf(book.series);
    let group = groups.get(key);
    if (!group) {
      group = { kind: 'series', key, name: book.series, books: [] };
      groups.set(key, group);
      items.push(group);
    }
    group.books.push(book);
  }
  for (const g of groups.values()) g.books.sort(byChapter);
  return items;
}

/** Capítulo em que continuar: o último lido sem terminar, senão o primeiro não lido, senão o primeiro. */
export function resumeChapter(books: Book[]): Book | undefined {
  const inProgress = books
    .filter((b) => !b.finished && b.lastReadAt != null)
    .sort((a, b) => (b.lastReadAt ?? 0) - (a.lastReadAt ?? 0))[0];
  return inProgress ?? books.find((b) => !b.finished) ?? books[0];
}
