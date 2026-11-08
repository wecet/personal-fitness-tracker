import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

/*
 * Text responses go out brotli- or gzip-compressed: the app's script shrinks to about
 * a quarter, which is most of the wait on a slow phone connection. Static files are
 * compressed once and kept, so only the first request for each pays for it.
 */

export type Encoding = 'br' | 'gzip';

/** Below this, compressing saves less than it costs. */
const MIN_BYTES = 1024;
const COMPRESSIBLE = /^(text\/|application\/(json|javascript|manifest\+json)|image\/svg\+xml)/;

export function pickEncoding(acceptEncoding: string | string[] | undefined): Encoding | null {
  const accepted = String(acceptEncoding ?? '')
    .split(',')
    .map((part) => part.trim().split(';'))
    .filter(([, q]) => !q || Number(q.trim().replace(/^q=/, '')) > 0)
    .map(([name]) => name.trim().toLowerCase());
  if (accepted.includes('br')) return 'br';
  if (accepted.includes('gzip')) return 'gzip';
  return null;
}

export const worthCompressing = (type: string, bytes: number) => bytes >= MIN_BYTES && COMPRESSIBLE.test(type);

/** Static files are compressed hard once; per-request bodies are compressed fast. */
export function compress(body: Buffer, encoding: Encoding, { once = false } = {}): Buffer {
  if (encoding === 'gzip') return gzipSync(body, { level: once ? 9 : 6 });
  return brotliCompressSync(body, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: once ? 11 : 5,
      [constants.BROTLI_PARAM_SIZE_HINT]: body.length,
    },
  });
}

/** Compressed copies of static files, keyed by path, encoding and modified time. */
export function staticCache() {
  const cache = new Map<string, Buffer>();
  return (path: string, mtimeMs: number, encoding: Encoding, read: () => Buffer) => {
    const key = `${encoding}:${path}:${mtimeMs}`;
    let body = cache.get(key);
    if (!body) {
      body = compress(read(), encoding, { once: true });
      cache.set(key, body);
    }
    return body;
  };
}
