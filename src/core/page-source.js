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
 * Sekmedeki bütün sayfa isteklerinin ortak sırası: aynı anda tek iş, istek başlangıçları arasında en az `minGapMs`.
 * Story ekranı kapatılıp açılınca da kurallar sürsün diye sekme başına bir kez kurulur.
 * Varsayılan saat monotondur: sistem saati geri alınsa da bekleme `minGapMs`'yi geçmez.
 * @returns {{ run: (job: () => Promise<any>, signal: AbortSignal) => Promise<any>, pace: (signal: AbortSignal) => Promise<void> }}
 */
export function createPageQueue({ minGapMs = PAGE_MIN_GAP_MS, now = () => performance.now(), sleep = defaultSleep } = {}) {
  let tail = Promise.resolve();
  let lastRequestAt = Number.NEGATIVE_INFINITY;

  /** İşi sıraya sokar: önceki iş bitmeden başlamaz. Sırası geldiğinde iptal edilmişse hiç başlamaz. */
  function run(job, signal) {
    const result = tail.then(() => {
      signal.throwIfAborted();
      return job();
    });
    tail = result.catch(() => {});
    return result;
  }

  /** Yalnızca `run` işinin içinde, her istekten hemen önce çağrılır: önceki istek başlayalı `minGapMs` geçmediyse bekler. Beklerken iptal edildiyse istek sayılmaz. */
  async function pace(signal) {
    const wait = lastRequestAt + minGapMs - now();
    if (wait > 0) await sleep(wait);
    signal.throwIfAborted();
    lastRequestAt = now();
  }

  return { run, pace };
}

/**
 * Bir story oturumunda başlığın sayfalarını sekmenin ortak sırasıyla, siteye yük bindirmeden çeker.
 * @returns {{ hasNext: () => boolean, next: () => Promise<{ page: number, count: number, entries: object[] }>, load: (page: number) => Promise<{ page: number, count: number, entries: object[] }>, dispose: () => void }}
 */
export function createPageSource({
  fetch,
  parseHtml,
  baseUrl,
  current,
  count,
  queue,
  retryDelayMs = PAGE_RETRY_DELAY_MS,
  sleep = defaultSleep,
}) {
  const controller = new AbortController();
  const { signal } = controller;
  let lastPage = current;
  let pageCount = count;
  let nextInFlight = null;
  let lastResult = null;

  async function request(url) {
    await queue.pace(signal);
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
    // Story ekranı bu arada kapandıysa yanıt kullanılmaz.
    signal.throwIfAborted();
    if (result.error) throw result.error;
    return parseTopicPage(parseHtml(result.html));
  }

  /** Sayfa isteklerini sekmenin ortak sırasına sokar. Aynı sayfaya art arda istek varsa son sonucu döndürür. */
  function enqueue(pickPageFn) {
    return queue.run(async () => {
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
    }, signal);
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

  /** Story ekranı kapanınca çağrılır: bekleyen işler istek atmadan düşer, uçuştaki isteğin yanıtı kullanılmaz. */
  function dispose() {
    controller.abort();
  }

  return { hasNext, next, load, dispose };
}
