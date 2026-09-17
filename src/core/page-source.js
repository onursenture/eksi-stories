import { EMPTY_PAGE_LIMIT, PAGE_MIN_GAP_MS, PAGE_RETRY_DELAY_MS, STORY_DURATION_MS } from './constants.js';
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

/** `signal` iptal edilirse bekleme hemen biter; iptali çağıran denetler. */
const defaultSleep = (ms, signal) => new Promise((resolve) => {
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => {
    clearTimeout(timer);
    resolve();
  }, { once: true });
});

/**
 * Sekmedeki bütün sayfa isteklerinin ortak sırası: aynı anda tek iş, istek başlangıçları arasında en az `minGapMs`.
 * Story ekranı kapatılıp açılınca da kurallar sürsün diye sekme başına bir kez kurulur.
 * Varsayılan saat monotondur: sistem saati geri alınsa da bekleme `minGapMs`'yi geçmez.
 * Önden okuma istekleri (`fetchAhead`) ayrıca hak harcar: `fetchAheadBurst` hak vardır, her `fetchAheadRefillMs`'de bir hak dolar, hak yoksa dolana kadar beklenir.
 * Varsayılanlar sayfa sınırı ve story süresidir: tek bir görselsiz bölüm hızlı taranır, uzun zincir story süresinden hızlı sayfa istemez.
 * @returns {{ run: (job: () => Promise<any>, signal: AbortSignal) => Promise<any>, pace: (signal: AbortSignal, options?: { fetchAhead?: boolean, cancel?: AbortSignal }) => Promise<void> }}
 */
export function createPageQueue({
  minGapMs = PAGE_MIN_GAP_MS,
  fetchAheadBurst = EMPTY_PAGE_LIMIT,
  fetchAheadRefillMs = STORY_DURATION_MS,
  now = () => performance.now(),
  sleep = defaultSleep,
} = {}) {
  let tail = Promise.resolve();
  let lastRequestAt = Number.NEGATIVE_INFINITY;
  // Önden okuma hakları milisaniye bütçesi olarak tutulur: bir hak `fetchAheadRefillMs` eder, bütçe geçen süre kadar dolar.
  const budgetLimit = fetchAheadBurst * fetchAheadRefillMs;
  let budget = budgetLimit;
  let budgetAt = now();

  /** İşi sıraya sokar: önceki iş bitmeden başlamaz. Sırası geldiğinde iptal edilmişse hiç başlamaz. */
  function run(job, signal) {
    const result = tail.then(() => {
      signal.throwIfAborted();
      return job();
    });
    tail = result.catch(() => {});
    return result;
  }

  function refillBudget() {
    const t = now();
    budget = Math.min(budgetLimit, budget + (t - budgetAt));
    budgetAt = t;
  }

  /**
   * Yalnızca `run` işinin içinde, her istekten hemen önce çağrılır: önceki istek başlayalı `minGapMs` geçmediyse bekler.
   * Önden okuma isteğinde hak yoksa bir hak dolana kadar da bekler. Beklerken iptal edildiyse istek sayılmaz, hak harcanmaz.
   * `cancel` önden okumayı düşürür ve hak beklemesini keser; kapatma (`signal`) hiçbir beklemeyi kesmez.
   */
  async function pace(signal, { fetchAhead = false, cancel = null } = {}) {
    const wait = lastRequestAt + minGapMs - now();
    if (wait > 0) await sleep(wait);
    if (fetchAhead) {
      refillBudget();
      if (budget < fetchAheadRefillMs && !cancel?.aborted) await sleep(fetchAheadRefillMs - budget, cancel);
    }
    signal.throwIfAborted();
    cancel?.throwIfAborted();
    if (fetchAhead) {
      refillBudget();
      budget -= fetchAheadRefillMs;
    }
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
  // İsteği henüz gitmemiş önden okumanın iptali: sayfa atlanınca çağrılır.
  let fetchAheadCancel = null;
  let lastResult = null;

  async function request(url, options) {
    await queue.pace(signal, options);
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

  async function fetchPage(page, options) {
    const url = buildPageUrl(baseUrl, page);
    let result = await request(url, options);
    if (result.error && result.retryable) {
      await sleep(retryDelayMs);
      result = await request(url, options);
    }
    // Story ekranı bu arada kapandıysa yanıt kullanılmaz.
    signal.throwIfAborted();
    if (result.error) throw result.error;
    return parseTopicPage(parseHtml(result.html));
  }

  /** Sayfa isteklerini sekmenin ortak sırasına sokar. Aynı sayfaya art arda istek varsa son sonucu döndürür. `options` sıranın `pace`'ine gider. */
  function enqueue(pickPageFn, options) {
    return queue.run(async () => {
      const page = pickPageFn();
      if (lastResult && lastResult.page === page) return lastResult;
      const parsed = await fetchPage(page, options);
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

  /** Önden okuma: sonraki sayfa isteği sıradan hak da harcar. Sayfa atlanırsa isteği henüz gitmemiş okuma düşer. */
  function next() {
    if (nextInFlight) return nextInFlight;
    const cancel = new AbortController();
    fetchAheadCancel = cancel;
    nextInFlight = enqueue(() => {
      if (!hasNext()) throw new Error('sonraki sayfa yok');
      return lastPage + 1;
    }, { fetchAhead: true, cancel: cancel.signal }).finally(() => {
      nextInFlight = null;
    });
    return nextInFlight;
  }

  /** İstenen sayfayı yükler; art arda aynı sayfa istenirse bir istek atar. İsteği henüz gitmemiş önden okumayı düşürür. */
  function load(page) {
    fetchAheadCancel?.abort();
    return enqueue(() => page);
  }

  /** Story ekranı kapanınca çağrılır: bekleyen işler istek atmadan düşer, uçuştaki isteğin yanıtı kullanılmaz. */
  function dispose() {
    controller.abort();
  }

  return { hasNext, next, load, dispose };
}
