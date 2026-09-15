import { EKSI_ORIGIN, RESOLVE_CONCURRENCY } from './constants.js';
import { imageRefKey } from './image-links.js';

export class ImageResolveError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ImageResolveError';
  }
}

/**
 * Görsel referanslarını gösterilebilir URL'lere çevirir.
 * @param {{ fetch: (url: string, init?: object) => Promise<Response>, parseHtml: (html: string) => Document, concurrency?: number }} deps
 */
export function createResolver({ fetch, parseHtml, concurrency = RESOLVE_CONCURRENCY }) {
  const cache = new Map();
  const queue = [];
  let active = 0;

  function pump() {
    while (active < concurrency && queue.length > 0) {
      const job = queue.shift();
      active += 1;
      job().finally(() => {
        active -= 1;
        pump();
      });
    }
  }

  function enqueue(task) {
    return new Promise((resolve, reject) => {
      queue.push(() => task().then(resolve, reject));
      pump();
    });
  }

  async function lookupEksiImage(id) {
    const response = await fetch(`${EKSI_ORIGIN}/img/${encodeURIComponent(id)}`, { credentials: 'include' });
    if (!response.ok) throw new ImageResolveError(`görsel sayfası HTTP ${response.status}`);
    const doc = parseHtml(await response.text());
    const src = doc.querySelector('meta[property="og:image"]')?.getAttribute('content')
      || doc.querySelector('#image')?.getAttribute('src');
    if (!src) throw new ImageResolveError('görsel adresi bulunamadı');
    return new URL(src, EKSI_ORIGIN).href;
  }

  function resolve(ref) {
    if (ref.kind === 'direct') return Promise.resolve(ref.url);
    const key = imageRefKey(ref);
    if (!cache.has(key)) {
      const pending = enqueue(() => lookupEksiImage(ref.id));
      pending.catch(() => {}); // önbellekteki reddedilmiş söz "unhandled rejection" üretmesin
      cache.set(key, pending);
    }
    return cache.get(key);
  }

  return { resolve };
}
