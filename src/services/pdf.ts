import { File } from 'expo-file-system';
import PdfThumbnail from 'react-native-pdf-thumbnail';

import { bookDir, relPath } from './storage';

/** Renderiza a primeira página do PDF como capa. Se falhar, a biblioteca mostra o título no lugar. */
export async function createPdfCover(id: string, pdfUri: string): Promise<string | null> {
  try {
    const thumb = await PdfThumbnail.generate(pdfUri, 0, { quality: 80, maxWidth: 600 });
    const cover = new File(bookDir(id), 'cover.jpg');
    await new File(thumb.uri).copy(cover);
    return relPath(id, 'cover.jpg');
  } catch {
    return null;
  }
}
