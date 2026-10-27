import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseComicInfo } from '../src/entities/book/formats/comicInfo.ts';

test('detecta mangá da direita para a esquerda', () => {
  const info = parseComicInfo('<ComicInfo><Title>Cap 1</Title><Manga>YesAndRightToLeft</Manga></ComicInfo>');
  assert.equal(info.title, 'Cap 1');
  assert.equal(info.rtl, true);
  assert.equal(info.manga, true);
});

test('quadrinho comum não é mangá', () => {
  const info = parseComicInfo('<ComicInfo><Series>X</Series><Manga>No</Manga></ComicInfo>');
  assert.equal(info.rtl, false);
  assert.equal(info.manga, false);
});
