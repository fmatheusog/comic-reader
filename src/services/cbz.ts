import { Directory, File } from 'expo-file-system';
import { unzip } from 'react-native-zip-archive';

import { naturalCompare } from '@/utils/naturalSort';

import { parseComicInfo, type ComicInfo } from './comicInfo';
import { IMAGE_EXT, bookDir, listFilesRecursive, relPath, stripScheme } from './storage';

export type ExtractedCbz = {
  /** Caminhos relativos (a Paths.document) das páginas, em ordem natural. */
  pages: string[];
  info: ComicInfo | null;
};

/** Extrai o CBZ para `books/<id>/pages` sem carregar o arquivo na memória. */
export async function extractCbz(id: string, cbzUri: string): Promise<ExtractedCbz> {
  const target = new Directory(bookDir(id), 'pages');
  target.create({ intermediates: true, idempotent: true });
  await unzip(stripScheme(cbzUri), stripScheme(target.uri));
  return readExtracted(id);
}

export function readExtracted(id: string): ExtractedCbz {
  const root = new Directory(bookDir(id), 'pages');
  const prefix = root.uri.endsWith('/') ? root.uri : root.uri + '/';
  const files = listFilesRecursive(root);

  const rel = (f: File) => decodeURI(f.uri).slice(decodeURI(prefix).length);
  const images = files
    .map(rel)
    .filter((p) => IMAGE_EXT.test(p) && !p.startsWith('__MACOSX') && !/(^|\/)\./.test(p))
    .sort(naturalCompare);

  const infoFile = files.find((f) => /(^|\/)comicinfo\.xml$/i.test(rel(f)));
  let info: ComicInfo | null = null;
  if (infoFile) {
    try {
      info = parseComicInfo(infoFile.textSync());
    } catch {
      info = null;
    }
  }
  return { pages: images.map((p) => relPath(id, 'pages', p)), info };
}
