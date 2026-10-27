import { Directory, Paths } from 'expo-file-system';

import { listFilesRecursive } from './storage';

export type LibraryUsage = { total: number; perBook: Map<string, number> };

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Espaço que cada livro ocupa no aparelho. Soma os arquivos um livro por vez e cede a vez à
 * interface entre um e outro, porque são milhares de arquivos (as páginas dos CBZ).
 */
export async function measureLibrary(): Promise<LibraryUsage> {
  const perBook = new Map<string, number>();
  let total = 0;
  const root = new Directory(Paths.document, 'books');
  if (!root.exists) return { total, perBook };
  for (const entry of root.list()) {
    if (!(entry instanceof Directory)) continue;
    let size = 0;
    for (const file of listFilesRecursive(entry)) size += file.size ?? 0;
    perBook.set(entry.name, size);
    total += size;
    await yieldToUi();
  }
  return { total, perBook };
}
