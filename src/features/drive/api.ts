import { Directory, File, Paths } from 'expo-file-system';

import { getAccessToken } from './auth';
import {
  LIST_FIELDS,
  QUERY_SHARED,
  queryChildren,
  sortEntries,
  toEntry,
  type DriveEntry,
  type DriveFile,
} from './model';

const BASE = 'https://www.googleapis.com/drive/v3';

/** GET autenticado; se o token vencer (401), pede outro e tenta uma vez de novo. */
async function authedFetch(url: string, retry = true): Promise<Response> {
  const token = await getAccessToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401 && retry) {
    await getAccessToken(true);
    return authedFetch(url, false);
  }
  return res;
}

async function listQuery(q: string): Promise<DriveEntry[]> {
  const entries: DriveEntry[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q,
      fields: LIST_FIELDS,
      pageSize: '1000',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await authedFetch(`${BASE}/files?${params}`);
    if (!res.ok) throw new Error(`Drive respondeu ${res.status}`); // sem o corpo da resposta, que pode citar ids
    const body = (await res.json()) as { files?: DriveFile[]; nextPageToken?: string };
    for (const f of body.files ?? []) {
      const entry = toEntry(f);
      if (entry) entries.push(entry);
    }
    pageToken = body.nextPageToken;
  } while (pageToken);
  return sortEntries(entries);
}

/** Itens que outras pessoas compartilharam com você (nível mais alto). */
export const listSharedWithMe = () => listQuery(QUERY_SHARED);

/** Conteúdo de uma pasta; 'root' é o "Meu Drive". */
export const listFolder = (folderId: string) => listQuery(queryChildren(folderId));

export type RemoteFile = { id: string; name: string; format: 'cbz' | 'epub' | 'pdf'; size: number | null; folderName: string };

/**
 * Todos os arquivos suportados dentro de uma pasta, incluindo as subpastas.
 * `folderName` é o nome da pasta que contém cada arquivo (vira a obra sugerida).
 */
export async function collectFiles(
  folder: { id: string; name: string },
  onProgress?: (found: number) => void,
  signal?: AbortSignal,
): Promise<RemoteFile[]> {
  const found: RemoteFile[] = [];
  const queue = [folder];
  const seen = new Set<string>();
  while (queue.length) {
    if (signal?.aborted) throw new Error('cancelado');
    const current = queue.shift()!;
    if (seen.has(current.id)) continue; // atalhos podem formar ciclos
    seen.add(current.id);
    for (const e of await listFolder(current.id)) {
      if (e.kind === 'folder') queue.push({ id: e.id, name: e.name });
      else found.push({ id: e.id, name: e.name, format: e.format, size: e.size, folderName: current.name });
    }
    onProgress?.(found.length);
  }
  return found;
}

/** Apaga o que sobrou de downloads no cache (interrompidos ou cancelados). */
export function clearDriveCache() {
  try {
    const dir = new Directory(Paths.cache, 'drive');
    if (dir.exists) dir.delete();
  } catch {
    // o sistema pode já ter limpado o cache
  }
}

/** Baixa um arquivo para o cache, com progresso. O chamador apaga depois de importar. */
export async function downloadFile(
  file: { id: string; name: string },
  onProgress: (received: number, total: number) => void,
  signal?: AbortSignal,
): Promise<File> {
  const dir = new Directory(Paths.cache, 'drive');
  dir.create({ intermediates: true, idempotent: true });
  const dest = new File(dir, `${file.id}-${file.name.replace(/[^\w.-]+/g, '_')}`);
  if (dest.exists) dest.delete();

  // token novo a cada arquivo: um lote grande dura mais que a vida de um token (1 h)
  const token = await getAccessToken(true);
  const task = File.createDownloadTask(`${BASE}/files/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`, dest, {
    headers: { Authorization: `Bearer ${token}` }, // o token vai só no cabeçalho, nunca na URL
    onProgress: ({ bytesWritten, totalBytes }) => onProgress(bytesWritten, totalBytes),
    signal,
  });
  try {
    const done = await task.downloadAsync();
    if (!done || done.size === 0) throw new Error('download incompleto');
    return done;
  } catch (e) {
    if (dest.exists) dest.delete();
    // a mensagem original pode trazer a URL do arquivo; não a repassamos para a tela nem para o log
    throw new Error(signal?.aborted ? 'cancelado' : e instanceof Error && e.message === 'download incompleto' ? e.message : 'falha no download');
  }
}
