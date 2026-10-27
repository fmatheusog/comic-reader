// Lógica pura do Google Drive (sem imports de runtime, para os testes rodarem direto no Node).
import type { BookFormat } from '@/entities/book/db';

export const FOLDER_MIME = 'application/vnd.google-apps.folder';
export const SHORTCUT_MIME = 'application/vnd.google-apps.shortcut';

/** Resposta crua da Drive API (só os campos que pedimos). */
export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  shortcutDetails?: { targetId: string; targetMimeType: string };
};

export type DriveEntry =
  | { kind: 'folder'; id: string; name: string }
  | { kind: 'file'; id: string; name: string; format: BookFormat; size: number | null };

const FORMAT_BY_EXT: Record<string, BookFormat> = { epub: 'epub', cbz: 'cbz', pdf: 'pdf' };

export const formatFromName = (name: string): BookFormat | null =>
  FORMAT_BY_EXT[name.split('.').pop()?.toLowerCase() ?? ''] ?? null;

/** Campos pedidos à API em toda listagem. */
export const LIST_FIELDS = 'nextPageToken,files(id,name,mimeType,size,shortcutDetails(targetId,targetMimeType))';

const quote = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

export const QUERY_SHARED = 'sharedWithMe = true and trashed = false';
export const queryChildren = (folderId: string) => `'${quote(folderId)}' in parents and trashed = false`;

/**
 * Converte um item da API numa entrada da tela: pastas, e arquivos EPUB/PDF/CBZ.
 * Atalhos viram o que apontam; todo o resto (documentos do Google, imagens...) é ignorado.
 */
export function toEntry(f: DriveFile): DriveEntry | null {
  let id = f.id;
  let mime = f.mimeType;
  if (mime === SHORTCUT_MIME && f.shortcutDetails) {
    id = f.shortcutDetails.targetId;
    mime = f.shortcutDetails.targetMimeType;
  }
  if (mime === FOLDER_MIME) return { kind: 'folder', id, name: f.name };
  const format = formatFromName(f.name);
  if (!format) return null;
  const size = f.size != null && Number.isFinite(Number(f.size)) ? Number(f.size) : null;
  return { kind: 'file', id, name: f.name, format, size };
}

const byName = (a: DriveEntry, b: DriveEntry) =>
  a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

/** Pastas primeiro; dentro de cada grupo, ordem natural (Cap 2 antes de Cap 10). */
export function sortEntries(entries: DriveEntry[]): DriveEntry[] {
  const folders = entries.filter((e) => e.kind === 'folder').sort(byName);
  const files = entries.filter((e) => e.kind === 'file').sort(byName);
  return [...folders, ...files];
}

export function formatBytes(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
