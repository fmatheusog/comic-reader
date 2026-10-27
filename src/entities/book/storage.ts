import { Directory, File, Paths } from 'expo-file-system';

/** Cada livro vive em `<documentos>/books/<id>/`. No banco guardamos caminhos relativos a `Paths.document`. */
export const bookDir = (id: string) => new Directory(Paths.document, 'books', id);

export const relPath = (id: string, ...parts: string[]) => ['books', id, ...parts].join('/');

export const resolveUri = (rel: string) => new File(Paths.document, ...rel.split('/')).uri;

/** O react-native-zip-archive espera caminhos sem o esquema file://. */
export const stripScheme = (uri: string) => decodeURIComponent(uri.replace(/^file:\/\//, ''));

export const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;

export function listFilesRecursive(dir: Directory, out: File[] = []): File[] {
  for (const entry of dir.list()) {
    if (entry instanceof Directory) listFilesRecursive(entry, out);
    else out.push(entry);
  }
  return out;
}

export function removeBookFiles(id: string) {
  const dir = bookDir(id);
  if (dir.exists) dir.delete();
}

export function newId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
