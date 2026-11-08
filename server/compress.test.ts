import assert from 'node:assert/strict';
import { test } from 'node:test';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { compress, pickEncoding, staticCache, worthCompressing } from './compress.ts';

test('prefers brotli, falls back to gzip, honours q=0', () => {
  assert.equal(pickEncoding('gzip, deflate, br'), 'br');
  assert.equal(pickEncoding('gzip, deflate'), 'gzip');
  assert.equal(pickEncoding('br;q=0, gzip'), 'gzip');
  assert.equal(pickEncoding('identity'), null);
  assert.equal(pickEncoding(undefined), null);
});

test('only text worth the effort is compressed', () => {
  assert.equal(worthCompressing('text/javascript', 50_000), true);
  assert.equal(worthCompressing('application/json', 200), false);
  assert.equal(worthCompressing('image/png', 50_000), false);
});

test('compressed bodies round-trip', () => {
  const body = Buffer.from('tempo '.repeat(1000));
  assert.deepEqual(brotliDecompressSync(compress(body, 'br')), body);
  assert.deepEqual(gunzipSync(compress(body, 'gzip')), body);
});

test('static files are compressed once per version', () => {
  const cached = staticCache();
  let reads = 0;
  const read = () => (reads++, Buffer.from('x'.repeat(5000)));
  cached('/a.js', 1, 'br', read);
  cached('/a.js', 1, 'br', read);
  assert.equal(reads, 1);
  cached('/a.js', 2, 'br', read);
  assert.equal(reads, 2);
});
