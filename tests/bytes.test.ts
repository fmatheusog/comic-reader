import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatBytes } from '../src/shared/utils/bytes.ts';

test('tamanhos legíveis', () => {
  assert.equal(formatBytes(null), '');
  assert.equal(formatBytes(512), '1 KB');
  assert.equal(formatBytes(5 * 1024 * 1024), '5.0 MB');
  assert.equal(formatBytes(3 * 1024 ** 3), '3.00 GB');
});
