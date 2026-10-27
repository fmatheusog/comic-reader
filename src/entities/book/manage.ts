import { deleteBookRow, listSeriesBooks } from './db';
import { removeBookFiles } from './storage';

/** Apaga o livro por inteiro: arquivos extraídos e registro no banco. */
export async function deleteBookCompletely(id: string) {
  removeBookFiles(id);
  await deleteBookRow(id);
}

/** Apaga todos os capítulos de uma obra. Devolve quantos foram removidos. */
export async function deleteSeriesCompletely(series: string): Promise<number> {
  const books = await listSeriesBooks(series);
  for (const b of books) await deleteBookCompletely(b.id);
  return books.length;
}
