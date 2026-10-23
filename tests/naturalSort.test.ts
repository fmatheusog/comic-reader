import assert from 'node:assert/strict';
import { test } from 'node:test';

import { naturalSort } from '../src/utils/naturalSort.ts';

test('ordena números dentro do nome', () => {
  assert.deepEqual(naturalSort(['p10.jpg', 'p2.jpg', 'p1.jpg']), ['p1.jpg', 'p2.jpg', 'p10.jpg']);
});

test('ignora maiúsculas e respeita pastas', () => {
  assert.deepEqual(naturalSort(['B/2.png', 'a/10.png', 'A/9.png']), ['A/9.png', 'a/10.png', 'B/2.png']);
});
