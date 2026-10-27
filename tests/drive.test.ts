import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildWorks, classifyDriveError, formatBytes, formatFromName, isChapterFolderName, parseFolderId, pendingFiles, queryChildren, sortEntries, toEntry, workProgress } from '../src/features/drive/model.ts';

test('pastas e arquivos suportados viram entradas', () => {
  assert.deepEqual(toEntry({ id: '1', name: 'Obra', mimeType: 'application/vnd.google-apps.folder' }), {
    kind: 'folder',
    id: '1',
    name: 'Obra',
  });
  assert.deepEqual(toEntry({ id: '2', name: 'Cap 1.CBZ', mimeType: 'application/octet-stream', size: '2048' }), {
    kind: 'file',
    id: '2',
    name: 'Cap 1.CBZ',
    format: 'cbz',
    size: 2048,
  });
});

test('ignora o que não é pasta nem EPUB/PDF/CBZ', () => {
  assert.equal(toEntry({ id: '3', name: 'Planilha', mimeType: 'application/vnd.google-apps.spreadsheet' }), null);
  assert.equal(toEntry({ id: '4', name: 'capa.jpg', mimeType: 'image/jpeg' }), null);
});

test('atalhos valem pelo destino', () => {
  const e = toEntry({
    id: 'atalho',
    name: 'Obra (atalho)',
    mimeType: 'application/vnd.google-apps.shortcut',
    shortcutDetails: { targetId: 'real', targetMimeType: 'application/vnd.google-apps.folder' },
  });
  assert.deepEqual(e, { kind: 'folder', id: 'real', name: 'Obra (atalho)' });
});

test('ordem: pastas primeiro, depois nomes em ordem natural', () => {
  const sorted = sortEntries([
    { kind: 'file', id: 'a', name: 'Cap 10.cbz', format: 'cbz', size: null },
    { kind: 'folder', id: 'f', name: 'Zeta', mimeType: '' } as never,
    { kind: 'file', id: 'b', name: 'Cap 2.cbz', format: 'cbz', size: null },
  ]);
  assert.deepEqual(sorted.map((e) => e.name), ['Zeta', 'Cap 2.cbz', 'Cap 10.cbz']);
});

test('consulta escapa aspas e barras no id', () => {
  assert.equal(queryChildren("a'b\\c"), "'a\\'b\\\\c' in parents and trashed = false");
});

test('extensões e tamanhos', () => {
  assert.equal(formatFromName('x.EPUB'), 'epub');
  assert.equal(formatFromName('x.zip'), null);
  assert.equal(formatBytes(null), '');
  assert.equal(formatBytes(512), '1 KB');
  assert.equal(formatBytes(5 * 1024 * 1024), '5.0 MB');
});

const f = (name: string) => ({ id: `id-${name}`, name, format: 'cbz' as const, size: null });
const dir = (name: string, files: string[] = [], children: ReturnType<typeof dir>[] = []) => ({
  id: `dir-${name}`,
  name,
  files: files.map(f),
  children,
});

test('obras: pasta com arquivos vira obra, com a categoria da pasta de cima', () => {
  const root = dir('Biblioteca', [], [
    dir('Mangás', [], [dir('Berserk', ['Cap 10.cbz', 'Cap 2.cbz']), dir('Akira', ['Vol 1.cbz'])]),
    dir('Livros', [], [dir('Dom Casmurro', ['dom.epub'])]),
    dir('Solta', ['a.cbz']),
  ]);
  const works = buildWorks(root);
  assert.deepEqual(works.map((w) => `${w.name}|${w.category}|${w.files.length}`), [
    'Akira|Mangás|1',
    'Berserk|Mangás|2',
    'Dom Casmurro|Livros|1',
    'Solta|null|1',
  ]);
  assert.deepEqual(works[1].files.map((x) => x.name), ['Cap 2.cbz', 'Cap 10.cbz']); // ordem natural
});

test('obras: subpastas de volumes se juntam na obra', () => {
  const root = dir('Biblioteca', [], [
    dir('Vagabond', [], [dir('Vol 1', ['a.cbz']), dir('Vol 2', ['b.cbz', 'c.cbz'])]),
  ]);
  const works = buildWorks(root);
  assert.equal(works.length, 1);
  assert.equal(works[0].name, 'Vagabond');
  assert.equal(works[0].files.length, 3);
});

test('obras: subpastas que não parecem volumes continuam sendo obras separadas', () => {
  const root = dir('Biblioteca', [], [dir('Shonen', [], [dir('Naruto', ['a.cbz']), dir('Bleach', ['b.cbz'])])]);
  const works = buildWorks(root);
  assert.deepEqual(works.map((w) => `${w.name}|${w.category}`), ['Bleach|Shonen', 'Naruto|Shonen']);
});

test('progresso da obra e arquivos pendentes', () => {
  const [w] = buildWorks(dir('R', [], [dir('Obra', ['1.cbz', '2.cbz', '3.cbz'])]));
  const done = new Set(['id-1.cbz']);
  assert.deepEqual(workProgress(w, done), { done: 1, total: 3, complete: false, untouched: false });
  assert.deepEqual(pendingFiles(w, done).map((p) => `${p.name}|${p.folderName}`), ['2.cbz|Obra', '3.cbz|Obra']);
  const [livro] = buildWorks(dir('R', [], [dir('Livro', ['x.epub'])]));
  assert.equal(pendingFiles(livro, new Set())[0].folderName, ''); // livro avulso: sem obra
});

test('nomes de pasta de volume ou capítulo', () => {
  assert.equal(isChapterFolderName('Vol 02'), true);
  assert.equal(isChapterFolderName('Capítulo 10 - Título'), true);
  assert.equal(isChapterFolderName('01'), true);
  assert.equal(isChapterFolderName('Naruto'), false);
});

test('id da pasta a partir de link ou id (valores de exemplo)', () => {
  const id = 'ABCdef123_-XYZ789';
  assert.equal(parseFolderId(id), id);
  assert.equal(parseFolderId(`https://drive.google.com/drive/folders/${id}?usp=sharing`), id);
  assert.equal(parseFolderId(`https://drive.google.com/drive/u/1/folders/${id}`), id);
  assert.equal(parseFolderId(`https://drive.google.com/open?id=${id}`), id);
  assert.equal(parseFolderId('  '), null);
  assert.equal(parseFolderId('não é um link'), null);
});

test('classifica erros da Drive API pelo motivo, sem depender do texto', () => {
  const body = (reason: string, message = '') => JSON.stringify({ error: { message, errors: [{ reason }] } });
  assert.equal(classifyDriveError(403, body('accessNotConfigured')).kind, 'apiDisabled');
  assert.equal(classifyDriveError(403, body('x', 'Google Drive API has not been used in project 1 before or it is disabled.')).kind, 'apiDisabled');
  assert.equal(classifyDriveError(403, body('insufficientPermissions')).kind, 'scope');
  assert.equal(classifyDriveError(403, body('userRateLimitExceeded')).kind, 'rateLimit');
  assert.equal(classifyDriveError(429, '').kind, 'rateLimit');
  assert.equal(classifyDriveError(403, body('forbidden')).kind, 'forbidden');
  assert.deepEqual(classifyDriveError(404, 'não é json'), { kind: 'notFound', reason: null, project: null });
  const disabled = JSON.stringify({ error: { message: 'Google Drive API has not been used in project 123456789012 before or it is disabled.', errors: [{ reason: 'accessNotConfigured' }] } });
  assert.equal(classifyDriveError(403, disabled).project, '123456789012');
  assert.equal(classifyDriveError(500, '').kind, 'http');
});
