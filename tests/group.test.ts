import assert from 'node:assert/strict';
import { test } from 'node:test';

import { arrangeItems, groupBySeries, resumeChapter } from '../src/entities/book/group.ts';

const book = (id: string, series: string | null, n: number | null, extra = {}) =>
  ({ id, title: id, series, seriesNumber: n, finished: false, lastReadAt: null, ...extra }) as never;

const ids = (g: unknown) => (g as { books: { id: string }[] }).books.map((b) => b.id);

test('agrupa capítulos por obra, em ordem, na posição do primeiro', () => {
  const items = groupBySeries([book('a', 'Obra X', 10), book('solo', null, null), book('b', 'obra x', 2), book('c', 'Y', 1)]);
  assert.equal(items.length, 3);
  assert.equal(items[0].kind, 'series');
  assert.deepEqual(ids(items[0]), ['b', 'a']);
  assert.equal(items[1].kind, 'book');
});

test('capítulos sem número vão para o fim', () => {
  const [g] = groupBySeries([book('sem', 'S', null), book('um', 'S', 1)]);
  assert.deepEqual(ids(g), ['um', 'sem']);
});

test('continuar: em andamento > primeiro não lido > primeiro', () => {
  const lido = book('1', 'S', 1, { finished: true });
  const andamento = book('2', 'S', 2, { lastReadAt: 5 });
  const novo = book('3', 'S', 3);
  assert.equal(resumeChapter([lido, andamento, novo])?.id, '2');
  assert.equal(resumeChapter([lido, novo])?.id, '3');
  assert.equal(resumeChapter([lido])?.id, '1');
});

test('a chave não mexe nas letras do nome', () => {
  const [g] = groupBySeries([book('a', 'Sasha  Sins', 1), book('b', 'sasha sins', 2)]);
  assert.equal((g as { key: string }).key, 'sasha sins');
  assert.deepEqual(ids(g), ['a', 'b']);
});

test('filtros valem para a obra inteira e o card mantém todos os capítulos', () => {
  const books = [
    book('1', 'S', 1, { finished: true, progress: 1 }),
    book('2', 'S', 2),
    book('3', 'Lida', 1, { finished: true, progress: 1 }),
    book('4', 'Nova', 1),
    book('5', null, null, { lastReadAt: 9, progress: 0.3 }),
  ];
  const names = (f: 'all' | 'reading' | 'new' | 'read') =>
    arrangeItems(books, f, 'recent').map((i) => (i.kind === 'series' ? `${i.name}:${i.books.length}` : (i.book as { id: string }).id));
  assert.deepEqual(names('reading'), ['S:2', '5']); // S tem um lido e um não lido: está em andamento
  assert.deepEqual(names('read'), ['Lida:1']);
  assert.deepEqual(names('new'), ['Nova:1']);
  assert.equal(names('all').length, 4);
});

test('ordenar por título usa o nome da obra', () => {
  const items = arrangeItems([book('z', null, null, { title: 'Zebra' }), book('a', 'Berserk', 1), book('b', 'Akira', 1)], 'all', 'title');
  assert.deepEqual(items.map((i) => (i.kind === 'series' ? i.name : 'Zebra')), ['Akira', 'Berserk', 'Zebra']);
});
