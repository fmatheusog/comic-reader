import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cleanSeriesName, guessChapterNumber, guessSeries, seriesKey } from '../src/entities/book/series.ts';

test('capítulo com palavra-chave', () => {
  assert.deepEqual(guessSeries('A Sign of Affection - Chapter 1.cbz'), { series: 'A Sign of Affection', number: 1 });
  assert.deepEqual(guessSeries('One Piece - Cap 1050 - Título'), { series: 'One Piece', number: 1050 });
  assert.deepEqual(guessSeries('Berserk Capítulo 042.cbz'), { series: 'Berserk', number: 42 });
  assert.deepEqual(guessSeries('Naruto_v01.cbz'), { series: 'Naruto', number: 1 });
  assert.deepEqual(guessSeries('Vagabond Vol. 3'), { series: 'Vagabond', number: 3 });
  assert.deepEqual(guessSeries('Série #7'), { series: 'Série', number: 7 });
});

test('capítulo decimal', () => {
  assert.deepEqual(guessSeries('Spy x Family - Ch 12.5.cbz'), { series: 'Spy x Family', number: 12.5 });
});

test('número solto só com traço', () => {
  assert.deepEqual(guessSeries('Monster - 018.cbz'), { series: 'Monster', number: 18 });
  assert.equal(guessSeries('Fahrenheit 451.epub'), null);
});

test('ignora grupos e tags entre colchetes e parênteses', () => {
  assert.deepEqual(guessSeries('[Grupo] Blue Lock - Chapter 200 (Digital).cbz'), { series: 'Blue Lock', number: 200 });
});

test('nomes que não são capítulo de uma série', () => {
  assert.equal(guessSeries('Dom Casmurro.epub'), null);
  assert.equal(guessSeries('Chapter 1.cbz'), null);
  assert.equal(guessSeries('Livro.pdf'), null);
});

test('limpeza e chave de agrupamento', () => {
  assert.equal(cleanSeriesName('  A_Sign__of Affection - '), 'A Sign of Affection');
  assert.equal(seriesKey('a sign of  affection'), seriesKey('A Sign of Affection'));
});

test('número do capítulo com a obra já conhecida', () => {
  assert.equal(guessChapterNumber('Chapter 5.cbz'), 5);
  assert.equal(guessChapterNumber('012.cbz'), 12);
  assert.equal(guessChapterNumber('012 - Título.cbz'), 12);
  assert.equal(guessChapterNumber('Vol 03 (Digital).cbz'), 3);
  assert.equal(guessChapterNumber('Título sem número.cbz'), null);
});
