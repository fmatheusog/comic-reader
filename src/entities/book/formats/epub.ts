import { Directory, File } from 'expo-file-system';
import { unzip } from 'react-native-zip-archive';

import {
  dirOf,
  parseContainer,
  parseNav,
  parseNcx,
  parseOpf,
  sanitizeChapter,
  splitChapter,
  type EpubPackage,
  type TocEntry,
} from './epubParse';
import { bookDir, relPath, stripScheme } from '@/entities/book/storage';

export type EpubBook = {
  rootUri: string;
  pkg: EpubPackage;
  toc: TocEntry[];
  /** Tamanho em bytes de cada capítulo da spine, para ponderar o progresso */
  sizes: number[];
};

const epubRoot = (id: string) => new Directory(bookDir(id), 'epub');

const fileIn = (id: string, path: string) => new File(epubRoot(id), ...path.split('/'));

export async function extractEpub(id: string, epubUri: string) {
  const target = epubRoot(id);
  target.create({ intermediates: true, idempotent: true });
  await unzip(stripScheme(epubUri), stripScheme(target.uri));
}

/** Lê container.xml, OPF e sumário de um EPUB já extraído. */
export async function loadEpub(id: string): Promise<EpubBook> {
  const root = epubRoot(id);
  const opfPath = parseContainer(await new File(root, 'META-INF', 'container.xml').text());
  const pkg = parseOpf(await fileIn(id, opfPath).text(), opfPath);

  let toc: TocEntry[] = [];
  if (pkg.tocPath && pkg.tocKind) {
    try {
      const raw = await fileIn(id, pkg.tocPath).text();
      toc = pkg.tocKind === 'nav' ? parseNav(raw, pkg.tocPath) : parseNcx(raw, pkg.tocPath);
    } catch {
      toc = [];
    }
  }
  if (pkg.spine.length === 0) throw new Error('EPUB sem capítulos');
  const sizes = pkg.spine.map((path) => {
    try {
      return fileIn(id, path).size || 1;
    } catch {
      return 1;
    }
  });
  return { rootUri: root.uri.replace(/\/?$/, '/'), pkg, toc, sizes };
}

export type ImportedEpubMeta = {
  title: string | null;
  author: string | null;
  coverPath: string | null;
  chapters: number;
};

export async function readEpubMeta(id: string): Promise<ImportedEpubMeta> {
  const { pkg } = await loadEpub(id);
  return {
    title: pkg.title,
    author: pkg.author,
    coverPath: pkg.coverPath ? relPath(id, 'epub', pkg.coverPath) : null,
    chapters: pkg.spine.length,
  };
}

export type ChapterContent = {
  /** URI base (file://) para resolver imagens e CSS relativos */
  baseUrl: string;
  head: string;
  body: string;
};

export async function readChapter(id: string, book: EpubBook, index: number): Promise<ChapterContent> {
  const path = book.pkg.spine[index];
  const raw = await fileIn(id, path).text();
  const { head, body } = splitChapter(sanitizeChapter(raw));
  const dir = dirOf(path);
  const baseUrl = encodeURI(book.rootUri + (dir ? dir + '/' : ''));
  return { baseUrl, head, body };
}

/** Índice do capítulo (na spine) para um href do sumário ou de um link interno. */
export function spineIndexOf(book: EpubBook, href: string): number {
  const file = href.split('#')[0];
  return book.pkg.spine.indexOf(file);
}
