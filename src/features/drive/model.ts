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

export type CatalogFile = { id: string; name: string; format: BookFormat; size: number | null };

export type DriveEntry =
  | { kind: 'folder'; id: string; name: string }
  | ({ kind: 'file' } & CatalogFile);

/** Pasta do Drive com o que há diretamente nela, como a varredura a enxerga. */
export type DriveNode = { id: string; name: string; files: CatalogFile[]; children: DriveNode[] };

/** Uma obra do catálogo: uma pasta com capítulos (ou livros) dentro. */
export type Work = {
  id: string;
  name: string;
  /** Primeira pasta acima da obra, abaixo da raiz (por exemplo, "Mangás"); null se estiver na raiz */
  category: string | null;
  files: CatalogFile[];
};

export type Catalog = { builtAt: number; works: Work[] };

/** Arquivo a importar, com o nome da obra de origem. */
export type RemoteFile = CatalogFile & { folderName: string };

const FORMAT_BY_EXT: Record<string, BookFormat> = { epub: 'epub', cbz: 'cbz', pdf: 'pdf' };

export const formatFromName = (name: string): BookFormat | null =>
  FORMAT_BY_EXT[name.split('.').pop()?.toLowerCase() ?? ''] ?? null;

/** Campos pedidos à API em toda listagem. */
export const LIST_FIELDS = 'nextPageToken,files(id,name,mimeType,size,shortcutDetails(targetId,targetMimeType))';

const quote = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

export const QUERY_SHARED = 'sharedWithMe = true and trashed = false';
export const queryChildren = (folderId: string) => `'${quote(folderId)}' in parents and trashed = false`;

/**
 * Converte um item da API numa entrada: pastas, e arquivos EPUB/PDF/CBZ.
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

const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

/** Pastas primeiro; dentro de cada grupo, ordem natural (Cap 2 antes de Cap 10). */
export function sortEntries(entries: DriveEntry[]): DriveEntry[] {
  const folders = entries.filter((e) => e.kind === 'folder').sort((a, b) => natural(a.name, b.name));
  const files = entries.filter((e) => e.kind === 'file').sort((a, b) => natural(a.name, b.name));
  return [...folders, ...files];
}

// "Vol 1", "Volume 02", "Cap. 10", "Chapter 3 - Título", "01"
const CHAPTER_FOLDER = /^(?:(?:vol(?:ume)?|v|tomo|cap[ií]tulo|cap|chapter|ch|c|livro|book)[\s._-]*)?\d+(?:\.\d+)?(?:[\s._-].*)?$/i;
export const isChapterFolderName = (name: string) => CHAPTER_FOLDER.test(name.trim());

const sortFiles = (files: CatalogFile[]) => [...files].sort((a, b) => natural(a.name, b.name));

/**
 * Transforma a árvore de pastas em obras. Uma obra é uma pasta com arquivos dentro.
 * Se uma pasta não tem arquivos próprios e só contém subpastas de volumes/capítulos
 * ("Obra/Vol 1", "Obra/Vol 2"), ela mesma é a obra e as subpastas se juntam nela.
 */
export function buildWorks(root: DriveNode): Work[] {
  const out: Work[] = [];

  const walk = (node: DriveNode, ancestors: string[]) => {
    const category = ancestors[0] ?? null;
    const foldable =
      node.files.length === 0 &&
      node.children.length > 0 &&
      node.children.every((k) => k.children.length === 0 && k.files.length > 0 && isChapterFolderName(k.name));
    if (foldable) {
      const files = [...node.children].sort((a, b) => natural(a.name, b.name)).flatMap((k) => sortFiles(k.files));
      out.push({ id: node.id, name: node.name, category, files });
      return;
    }
    if (node.files.length) out.push({ id: node.id, name: node.name, category, files: sortFiles(node.files) });
    for (const k of node.children) walk(k, [...ancestors, node.name]);
  };

  if (root.files.length) out.push({ id: root.id, name: root.name, category: null, files: sortFiles(root.files) });
  for (const k of root.children) walk(k, []);
  return out.sort((a, b) => natural(a.name, b.name));
}

/** Quantos arquivos da obra já foram importados. */
export function workProgress(work: Work, imported: Set<string>) {
  const done = work.files.filter((f) => imported.has(f.id)).length;
  return { done, total: work.files.length, complete: done === work.files.length, untouched: done === 0 };
}

/** Obra com um arquivo só é um livro avulso, não uma série de capítulos. */
export const isSingleBook = (work: Work) => work.files.length === 1;

/** Arquivos ainda não importados, prontos para o importador (obra sugerida = nome da pasta). */
export function pendingFiles(work: Work, imported: Set<string>): RemoteFile[] {
  const folderName = isSingleBook(work) ? '' : work.name;
  return work.files.filter((f) => !imported.has(f.id)).map((f) => ({ ...f, folderName }));
}

export type DriveErrorKind = 'apiDisabled' | 'scope' | 'rateLimit' | 'forbidden' | 'notFound' | 'http';

/**
 * Descobre o motivo de uma resposta de erro da Drive API. Só usa o código de motivo
 * (por exemplo "accessNotConfigured"); o texto da resposta pode citar ids e não é repassado.
 */
export function classifyDriveError(status: number, bodyText: string): { kind: DriveErrorKind; reason: string | null } {
  let reason: string | null = null;
  let message = '';
  try {
    const body = JSON.parse(bodyText) as { error?: { message?: string; status?: string; errors?: { reason?: string }[] } };
    reason = body.error?.errors?.[0]?.reason ?? body.error?.status ?? null;
    message = body.error?.message ?? '';
  } catch {
    // corpo que não é JSON
  }
  if (reason === 'accessNotConfigured' || /has not been used|is disabled/i.test(message)) return { kind: 'apiDisabled', reason };
  if (reason === 'insufficientPermissions' || reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' || /insufficient (authentication )?scopes?/i.test(message))
    return { kind: 'scope', reason };
  if (reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded' || reason === 'dailyLimitExceeded' || status === 429)
    return { kind: 'rateLimit', reason };
  if (status === 403) return { kind: 'forbidden', reason };
  if (status === 404) return { kind: 'notFound', reason };
  return { kind: 'http', reason };
}

/** Aceita o link da pasta (drive.google.com/drive/folders/ID, com ou sem parâmetros) ou o próprio id. */
export function parseFolderId(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  if (/^[A-Za-z0-9_-]{10,}$/.test(text)) return text;
  const m = /\/folders\/([A-Za-z0-9_-]+)/.exec(text) ?? /[?&]id=([A-Za-z0-9_-]+)/.exec(text);
  return m ? m[1] : null;
}

export function formatBytes(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
