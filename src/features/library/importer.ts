import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import { deleteBookRow, insertBook, type BookFormat } from '@/entities/book/db';
import { extractCbz } from '@/entities/book/formats/cbz';
import { extractEpub, readEpubMeta } from '@/entities/book/formats/epub';
import { createPdfCover } from '@/entities/book/formats/pdf';
import { cleanSeriesName, guessChapterNumber, guessSeries, parseChapterNumber } from '@/entities/book/series';
import { bookDir, newId, removeBookFiles } from '@/entities/book/storage';

export type ImportOutcome = { name: string; ok: boolean; error?: string };

/** Um arquivo já copiado para o cache, com os dados que o usuário confere antes de importar. */
export type ImportDraft = {
  uri: string;
  name: string;
  format: BookFormat;
  title: string;
  /** Obra; vazio = livro avulso */
  series: string;
  /** Número do capítulo, como digitado (obrigatório quando há obra) */
  number: string;
};

const FORMAT_BY_EXT: Record<string, BookFormat> = { epub: 'epub', cbz: 'cbz', pdf: 'pdf' };

export const formatOf = (name: string): BookFormat | null =>
  FORMAT_BY_EXT[name.split('.').pop()?.toLowerCase() ?? ''] ?? null;

const titleOf = (name: string) =>
  name
    .replace(/\.[^.]+$/, '')
    .replace(/[_]+/g, ' ')
    .trim();

/**
 * Monta o rascunho de um arquivo com o que dá para adivinhar pelo nome.
 * `seriesHint` é uma obra já conhecida (por exemplo, o nome da pasta de origem) e tem prioridade.
 */
export function buildDraft(uri: string, name: string, format: BookFormat, seriesHint?: string): ImportDraft {
  const hint = seriesHint ? cleanSeriesName(seriesHint) : '';
  const guess = guessSeries(name);
  const series = hint || guess?.series || '';
  const number = series ? ((hint ? guessChapterNumber(name) : guess?.number) ?? guessChapterNumber(name)) : null;
  return { uri, name, format, title: titleOf(name), series, number: number == null ? '' : String(number) };
}

/** Abre o seletor de arquivos do Android e devolve rascunhos dos EPUB, PDF e CBZ escolhidos. */
export async function pickDrafts(): Promise<{ drafts: ImportDraft[]; skipped: number }> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return { drafts: [], skipped: 0 };

  const drafts: ImportDraft[] = [];
  let skipped = 0;
  for (const asset of result.assets) {
    const format = formatOf(asset.name);
    if (!format) {
      skipped++;
      new File(asset.uri).delete();
      continue;
    }
    drafts.push(buildDraft(asset.uri, asset.name, format));
  }
  return { drafts, skipped };
}

/** Descarta os arquivos do cache de rascunhos que não serão importados. */
export function discardDrafts(drafts: ImportDraft[]) {
  for (const d of drafts) {
    try {
      const f = new File(d.uri);
      if (f.exists) f.delete();
    } catch {
      // o cache pode ter sido limpo pelo sistema
    }
  }
}

export async function importDrafts(drafts: ImportDraft[]): Promise<ImportOutcome[]> {
  const outcomes: ImportOutcome[] = [];
  for (const draft of drafts) outcomes.push(await importDraft(draft));
  return outcomes;
}

/** Importa um rascunho já conferido para a biblioteca. */
export async function importDraft(draft: ImportDraft): Promise<ImportOutcome> {
  const { name, format } = draft;
  const picked = new File(draft.uri);
  const id = newId();
  try {
    const dir = bookDir(id);
    dir.create({ intermediates: true, idempotent: true });
    const original = new File(dir, `book.${format}`);
    await picked.copy(original);

    let title = draft.title.trim();
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
      // título, obra e número vêm da revisão; o ComicInfo só completa o resto
      author = info?.writer ?? null;
      description = info?.summary ?? null;
      // as páginas já estão extraídas; o arquivo original só ocuparia espaço em dobro
      original.delete();
    }

    if (format === 'epub') {
      await extractEpub(id, original.uri);
      const meta = await readEpubMeta(id);
      // sem edição do usuário, vale o título que está dentro do EPUB
      if (title === titleOf(name)) title = meta.title ?? title;
      author = meta.author;
      coverPath = meta.coverPath;
      pageCount = meta.chapters;
      original.delete();
    }

    if (format === 'pdf') coverPath = await createPdfCover(id, original.uri);

    const series = draft.series.trim() ? cleanSeriesName(draft.series) : null;
    const seriesNumber = series ? parseChapterNumber(draft.number) : null;

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
