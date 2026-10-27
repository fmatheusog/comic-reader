import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import { deleteBookRow, insertBook, type BookFormat } from '@/db/books';

import { extractCbz } from './cbz';
import { extractEpub, readEpubMeta } from './epub';
import { createPdfCover } from './pdf';
import { bookDir, newId, removeBookFiles } from './storage';

export type ImportOutcome = { name: string; ok: boolean; error?: string };

const FORMAT_BY_EXT: Record<string, BookFormat> = { epub: 'epub', cbz: 'cbz', pdf: 'pdf' };

const formatOf = (name: string): BookFormat | null =>
  FORMAT_BY_EXT[name.split('.').pop()?.toLowerCase() ?? ''] ?? null;

const titleOf = (name: string) =>
  name
    .replace(/\.[^.]+$/, '')
    .replace(/[_]+/g, ' ')
    .trim();

/** Abre o seletor de arquivos do Android e importa o que for EPUB, PDF ou CBZ. */
export async function pickAndImport(): Promise<ImportOutcome[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return [];

  const outcomes: ImportOutcome[] = [];
  for (const asset of result.assets) {
    outcomes.push(await importOne(asset.uri, asset.name));
  }
  return outcomes;
}

async function importOne(uri: string, name: string): Promise<ImportOutcome> {
  const format = formatOf(name);
  const picked = new File(uri);
  if (!format) {
    picked.delete();
    return { name, ok: false, error: 'unsupported' };
  }

  const id = newId();
  try {
    const dir = bookDir(id);
    dir.create({ intermediates: true, idempotent: true });
    const original = new File(dir, `book.${format}`);
    await picked.copy(original);

    let title = titleOf(name);
    let author: string | null = null;
    let description: string | null = null;
    let coverPath: string | null = null;
    let rtl = false;
    let pageCount: number | null = null;

    if (format === 'cbz') {
      const { pages, info } = await extractCbz(id, original.uri);
      if (pages.length === 0) throw new Error('empty');
      coverPath = pages[0];
      pageCount = pages.length;
      rtl = info?.rtl ?? false;
      // o título vem do nome do arquivo (que o usuário organiza); o ComicInfo só completa o resto
      author = info?.writer ?? null;
      description = info?.summary ?? null;
      // as páginas já estão extraídas; o arquivo original só ocuparia espaço em dobro
      original.delete();
    }

    if (format === 'epub') {
      await extractEpub(id, original.uri);
      const meta = await readEpubMeta(id);
      title = meta.title ?? title;
      author = meta.author;
      coverPath = meta.coverPath;
      pageCount = meta.chapters;
      original.delete();
    }

    if (format === 'pdf') coverPath = await createPdfCover(id, original.uri);

    await insertBook({ id, title, author, description, format, coverPath, rtl, pageCount });
    return { name, ok: true };
  } catch (e) {
    console.warn(`Falha ao importar "${name}":`, e);
    removeBookFiles(id);
    await deleteBookRow(id).catch(() => {});
    return { name, ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    if (picked.exists) picked.delete();
  }
}
