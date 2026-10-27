import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import { deleteBookRow, insertBook, type BookFormat } from '@/entities/book/db';
import { cleanSeriesName, guessChapterNumber, guessSeries } from '@/entities/book/series';

import { extractCbz } from '@/entities/book/formats/cbz';
import { extractEpub, readEpubMeta } from '@/entities/book/formats/epub';
import { createPdfCover } from '@/entities/book/formats/pdf';
import { bookDir, newId, removeBookFiles } from '@/entities/book/storage';

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
    outcomes.push(await importFile(asset.uri, asset.name));
  }
  return outcomes;
}

export type ImportOptions = {
  /** Obra já conhecida (por exemplo, o nome da pasta de origem); tem prioridade sobre o nome do arquivo */
  series?: string;
};

/** Importa um arquivo local (copiado para o cache) para a biblioteca. */
export async function importFile(uri: string, name: string, options: ImportOptions = {}): Promise<ImportOutcome> {
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
    let comicSeries: { series?: string; number?: number } | undefined;
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
      comicSeries = info ? { series: info.series, number: info.number } : undefined;
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

    // obra: pasta de origem > nome do arquivo > ComicInfo.xml
    const guess = guessSeries(name);
    const hint = options.series ? cleanSeriesName(options.series) : '';
    const series = hint || guess?.series || (comicSeries?.series ? cleanSeriesName(comicSeries.series) : '') || null;
    const seriesNumber = series
      ? ((hint ? guessChapterNumber(name) : guess?.number) ?? guessChapterNumber(name) ?? comicSeries?.number ?? null)
      : null;

    await insertBook({ id, title, author, description, series, seriesNumber, format, coverPath, rtl, pageCount });
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
