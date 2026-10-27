import type { Book, Filter, SortKey } from './db';

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

const started = (b: Book) => b.finished || b.progress > 0 || b.lastReadAt != null;

/** Estado de leitura: uma obra só é "lida" com todos os capítulos lidos e "nova" se nenhum foi aberto. */
export function itemStatus(item: LibraryItem): 'new' | 'reading' | 'read' {
  const books = item.kind === 'series' ? item.books : [item.book];
  if (books.every((b) => b.finished)) return 'read';
  return books.some(started) ? 'reading' : 'new';
}

const itemName = (item: LibraryItem) => (item.kind === 'series' ? item.name : item.book.title);

/** Agrupa por obra e só então filtra e ordena, para os números e estados valerem para a obra inteira. */
export function arrangeItems(books: Book[], filter: Filter, sort: SortKey): LibraryItem[] {
  let items = groupBySeries(books);
  if (filter !== 'all') items = items.filter((i) => itemStatus(i) === filter);
  if (sort === 'title') items = [...items].sort((a, b) => itemName(a).localeCompare(itemName(b), undefined, { sensitivity: 'base', numeric: true }));
  return items;
}
