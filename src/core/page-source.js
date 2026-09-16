import { PAGE_MIN_GAP_MS, PAGE_RETRY_DELAY_MS } from './constants.js';
import { parseTopicPage } from './entry-parser.js';

export class PageFetchError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'PageFetchError';
    this.status = status;
  }
}

/** Mevcut adresten N. sayfanın adresini üretir: filtreleri korur, `p`'yi ezen `focusto`'yu siler. */
export function buildPageUrl(baseUrl, page) {
  const url = new URL(baseUrl);
  url.searchParams.delete('focusto');
  url.searchParams.set('p', String(page));
  url.hash = '';
  return url.href;
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Başlığın sayfalarını siteye yük bindirmeden, sırayla çeker.
 * @returns {{ hasNext: () => boolean, next: () => Promise<{ page: number, count: number, entries: object[] }>, load: (page: number) => Promise<{ page: number, count: number, entries: object[] }> }}
 */
export function createPageSource({
  fetch,
  parseHtml,
  baseUrl,
  current,
  count,
  minGapMs = PAGE_MIN_GAP_MS,
  retryDelayMs = PAGE_RETRY_DELAY_MS,
  now = () => Date.now(),
  sleep = defaultSleep,
}) {
  let lastPage = current;
  let pageCount = count;
  let lastRequestAt = Number.NEGATIVE_INFINITY;
  let queue = Promise.resolve();
  let nextInFlight = null;
  let lastResult = null;

  async function request(url) {
    const wait = lastRequestAt + minGapMs - now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = now();
    try {
      const response = await fetch(url, { credentials: 'include' });
      if (response.ok) return { html: await response.text() };
      return {
        error: new PageFetchError(`sayfa HTTP ${response.status}`, response.status),
        retryable: response.status === 429 || response.status >= 500,
      };
    } catch (cause) {
      const error = new PageFetchError('sayfa isteği başarısız', 0);
      error.cause = cause;
      return { error, retryable: true };
    }
  }

  async function fetchPage(page) {
    const url = buildPageUrl(baseUrl, page);
    let result = await request(url);
    if (result.error && result.retryable) {
      await sleep(retryDelayMs);
      result = await request(url);
    }
    if (result.error) throw result.error;
    return parseTopicPage(parseHtml(result.html));
  }

  /** Sayfa isteklerini sıraya sokar: biri bitmeden sonraki başlamaz. Aynı sayfaya art arda istek varsa son sonucu döndürür. */
  function enqueue(pickPageFn) {
    const result = queue.then(async () => {
      const page = pickPageFn();
      if (lastResult && lastResult.page === page) return lastResult;
      const parsed = await fetchPage(page);
      lastPage = page;
      if (parsed.page.current !== page) {
        pageCount = page;
        lastResult = { page, count: pageCount, entries: [] };
        return lastResult;
      }
      pageCount = Math.max(parsed.page.count, page);
      lastResult = { page, count: pageCount, entries: parsed.entries };
      return lastResult;
    });
    queue = result.catch(() => {});
    return result;
  }

  const hasNext = () => lastPage < pageCount;

  function next() {
    if (nextInFlight) return nextInFlight;
    nextInFlight = enqueue(() => {
      if (!hasNext()) throw new Error('sonraki sayfa yok');
      return lastPage + 1;
    }).finally(() => {
      nextInFlight = null;
    });
    return nextInFlight;
  }

  /** İstenen sayfayı yükler; art arda aynı sayfa istenirse bir istek atar. */
  function load(page) {
    return enqueue(() => page);
  }

  return { hasNext, next, load };
}
