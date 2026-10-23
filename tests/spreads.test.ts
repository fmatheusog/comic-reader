import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildSpreads, spreadIndexOf } from '../src/utils/spreads.ts';

test('modo simples: uma página por folha', () => {
  assert.deepEqual(buildSpreads(3, false), [[0], [1], [2]]);
});

test('modo duplo: capa sozinha e demais em pares', () => {
  assert.deepEqual(buildSpreads(6, true), [[0], [1, 2], [3, 4], [5]]);
  assert.deepEqual(buildSpreads(5, true), [[0], [1, 2], [3, 4]]);
});

test('acha a folha que contém a página', () => {
  const s = buildSpreads(6, true);
  assert.equal(spreadIndexOf(s, 4), 2);
  assert.equal(spreadIndexOf(s, 0), 0);
});
