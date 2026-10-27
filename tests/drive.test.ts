import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatBytes, formatFromName, queryChildren, sortEntries, toEntry } from '../src/features/drive/model.ts';

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
