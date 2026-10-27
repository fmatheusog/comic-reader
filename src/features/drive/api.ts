import { Directory, File, Paths } from 'expo-file-system';

import { t } from '@/shared/i18n/pt';

import { getAccessToken } from './auth';
import {
  LIST_FIELDS,
  LIST_FIELDS_WITH_PARENTS,
  chunk,
  classifyDriveError,
  QUERY_SHARED,
  queryChildren,
  queryChildrenOf,
  sortEntries,
  toEntry,
  type DriveEntry,
  type DriveFile,
  type DriveNode,
} from './model';

const BASE = 'https://www.googleapis.com/drive/v3';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

/** Erro com mensagem em português e o código HTTP/motivo (nunca o corpo da resposta nem ids). */
async function driveError(res: Response): Promise<{ error: Error; retryable: boolean }> {
  const { kind, reason, project } = classifyDriveError(res.status, await res.text().catch(() => ''));
  const friendly: Record<typeof kind, string> = {
    apiDisabled: t.drive.errApiDisabled,
    scope: t.drive.errScope,
    rateLimit: t.drive.errRateLimit,
    forbidden: t.drive.errForbidden,
    notFound: t.drive.errNotFound,
    http: t.drive.loadError,
  };
  const detail = `HTTP ${res.status}${reason ? `, ${reason}` : ''}${project ? `, projeto ${project}` : ''}`;
  return { error: new Error(`${friendly[kind]} (${detail})`), retryable: kind === 'rateLimit' || res.status >= 500 };
}

/** Uma página da listagem, repetindo com espera quando o Google limita o ritmo ou falha (5xx). */
async function fetchPage(url: string): Promise<{ files?: DriveFile[]; nextPageToken?: string }> {
  for (let attempt = 0; ; attempt++) {
    const res = await authedFetch(url);
    if (res.ok) return res.json();
    const { error, retryable } = await driveError(res);
    if (retryable && attempt < 3) {
      await sleep(600 * 2 ** attempt);
      continue;
    }
    throw error;
  }
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
    const body = await fetchPage(`${BASE}/files?${params}`);
    for (const f of body.files ?? []) {
      const entry = toEntry(f);
      if (entry) entries.push(entry);
    }
    pageToken = body.nextPageToken;
  } while (pageToken);
  return sortEntries(entries);
}

/** Nome de uma pasta pelo id (para titular o catálogo quando a pasta vem fixa do .env). */
export async function getFolderName(folderId: string): Promise<string> {
  const params = new URLSearchParams({ fields: 'name', supportsAllDrives: 'true' });
  const res = await authedFetch(`${BASE}/files/${encodeURIComponent(folderId)}?${params}`);
  if (!res.ok) throw (await driveError(res)).error;
  return ((await res.json()) as { name: string }).name;
}

/** Itens que outras pessoas compartilharam com você (nível mais alto). */
export const listSharedWithMe = () => listQuery(QUERY_SHARED);

/** Conteúdo de uma pasta; 'root' é o "Meu Drive". */
export const listFolder = (folderId: string) => listQuery(queryChildren(folderId));

const FOLDERS_PER_QUERY = 20; // pastas lidas por consulta
const PARALLEL_QUERIES = 6; // consultas ao mesmo tempo

/** Executa `fn` para cada item com no máximo `limit` em andamento, sem esperar o mais lento de cada grupo. */
async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await fn(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/** Itens diretamente dentro de várias pastas, cada um ligado à pasta onde está. */
async function listChildrenBatch(folderIds: string[]): Promise<{ parent: string; entry: DriveEntry }[]> {
  const wanted = new Set(folderIds);
  const out: { parent: string; entry: DriveEntry }[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: queryChildrenOf(folderIds),
      fields: LIST_FIELDS_WITH_PARENTS,
      pageSize: '1000',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const body = await fetchPage(`${BASE}/files?${params}`);
    for (const f of body.files ?? []) {
      const entry = toEntry(f);
      if (!entry) continue;
      for (const parent of f.parents ?? []) if (wanted.has(parent)) out.push({ parent, entry });
    }
    pageToken = body.nextPageToken;
  } while (pageToken);
  return out;
}

/**
 * Lê a pasta do catálogo e tudo que há dentro dela (subpastas incluídas), nível por nível:
 * cada consulta traz o conteúdo de até 20 pastas e várias consultas rodam juntas.
 * Só lê; devolve a árvore para `buildWorks` transformar em obras.
 */
export async function crawlFolder(
  root: { id: string; name: string },
  onProgress: (folders: number, files: number) => void,
  signal?: AbortSignal,
): Promise<DriveNode> {
  const rootNode: DriveNode = { id: root.id, name: root.name, files: [], children: [] };
  const seen = new Set([root.id]); // atalhos podem formar ciclos
  let frontier = [rootNode];
  let folders = 0;
  let files = 0;

  while (frontier.length) {
    const byId = new Map(frontier.map((n) => [n.id, n]));
    const next: DriveNode[] = [];
    await mapLimit(chunk(frontier, FOLDERS_PER_QUERY), PARALLEL_QUERIES, async (batch) => {
      if (signal?.aborted) throw new Error('cancelado');
      for (const { parent, entry } of await listChildrenBatch(batch.map((n) => n.id))) {
        const node = byId.get(parent);
        if (!node) continue;
        if (entry.kind === 'folder') {
          if (seen.has(entry.id)) continue;
          seen.add(entry.id);
          const child: DriveNode = { id: entry.id, name: entry.name, files: [], children: [] };
          node.children.push(child);
          next.push(child);
        } else {
          node.files.push({ id: entry.id, name: entry.name, format: entry.format, size: entry.size });
          files++;
        }
      }
      folders += batch.length;
      onProgress(folders, files);
    });
    frontier = next;
  }
  return rootNode;
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

  // o token em memória é renovado sozinho antes de vencer, mesmo em lotes longos
  const token = await getAccessToken();
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
