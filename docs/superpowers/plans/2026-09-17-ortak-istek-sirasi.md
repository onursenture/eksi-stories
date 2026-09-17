# ortak sayfa istek sırası: uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Story ekranı kapatılıp hemen açılsa da bir sekmedeki sayfa isteklerini tek sırada tutmak: aynı anda tek istek, istek başlangıçları arasında en az 1500 ms, kapanan oturum için yeni istek yok.

**Architecture:** `src/core/page-source.js`'e sekme başına bir kez kurulan `createPageQueue` gelir: tek söz zinciri ve son isteğin başladığı an. Her story oturumunun `createPageSource`'u bu sırayı kullanır ve `dispose()` ile iç `AbortController`'ını iptal eder; iptal edilmiş iş sırası gelince başlamaz, aralık bekledikten sonra istek atmaz, uçuştaki isteğin yanıtını kullanmaz. `main()` sırayı kurar, her oturuma verir ve kapatınca `feed.dispose()` yanında `pageSource.dispose()` çağırır.

**Tech Stack:** Vanilla JS (MV3 Chrome eklentisi, build yok), `AbortController` ve `AbortSignal.throwIfAborted()` (Chrome 100+, manifest `minimum_chrome_version` 111), Node.js `node:test`, jsdom.

**Spec:** [docs/superpowers/specs/2026-09-17-ortak-istek-sirasi-design.md](../specs/2026-09-17-ortak-istek-sirasi-design.md)

## Global Constraints

- İstek kuralları ve sabitler değişmez: aynı anda tek sayfa isteği; istek başlangıçları arasında en az `PAGE_MIN_GAP_MS` = 1500 ms; 429/5xx/ağ hatasında `PAGE_RETRY_DELAY_MS` = 5000 ms sonra bir tekrar. `src/core/constants.js`'e dokunulmaz.
- Kapatma kuralı: kapatmak hiçbir beklemeyi kısaltmaz, yalnızca yeni istek atılmasını engeller. Uçuştaki istek kesilmez: `fetch`'e `signal` verilmez (kullanıcı kararı, 17.09.2026).
- Kapatılan sayfa kaynağının bütün bekleyen sözleri `AbortError` ile (`signal.reason`, `DOMException`) reddedilir.
- `createPageSource` için `queue` zorunludur; varsayılan bir iç sıra yazılmaz.
- `src/core/story-feed.js`, `src/viewer/*`, `dev/playground.js` kodu değişmez.
- README, PRIVACY, `store/` yazıları ve CHANGELOG değişmez.
- Kod yorumları ve test adları Türkçedir, küçük harfle başlar; dosyaların mevcut yorum yoğunluğu korunur.
- Commit mesajları şu satırla biter: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Kullanıcıya sormadan push yapılmaz.

## Dosya haritası

| dosya | değişiklik | görev |
|---|---|---|
| `src/core/page-source.js` | `createPageQueue`; `createPageSource` ortak sırayı kullanır, `dispose()` | 1 |
| `test/page-source.test.js` | sekme yardımcısı `makeTab`, 5 yeni test | 1 |
| `src/content/main.js` | Görev 1: yeni imzaya uyum (oturum başına sıra, geçici); Görev 2: `pageQueue` parametresi, kapatınca `pageSource.dispose()` | 1, 2 |
| `test/story-feed.test.js` | kapatıldıktan sonra reddedilen sayfa isteği | 2 |
| `test/main.smoke.test.js` | kapatıp hemen yeniden açma | 2 |
| `docs/superpowers/specs/2026-09-14-eksi-stories-design.md`, `docs/superpowers/specs/2026-09-16-sayfa-gostergesi-design.md` | not satırları | 2 |

Test sayısı: başlangıçta 80, Görev 1 sonunda 85, Görev 2 sonunda 87.

> Plan kodu `e0774b9` + spec commit'i üzerinde, temiz kopyada baştan sona denendi. Her kırmızı ve yeşil çıktı ve test sayısı gözlendi. Yeni testlerin her biri, kodun ilgili satırı bilerek bozulunca düştü.

---

### Task 1: Ortak sayfa isteği sırası ve `dispose()`

**Files:**
- Modify: `test/page-source.test.js` (import satırı, `makeSource` yardımcısı, dosya sonu)
- Modify: `src/core/page-source.js` (dosyanın tamamı)
- Modify: `src/content/main.js` (import satırı, `startStories` içindeki `createPageSource` çağrısı)

**Interfaces:**
- Consumes: yok
- Produces:
  - `createPageQueue({ minGapMs = PAGE_MIN_GAP_MS, now = () => Date.now(), sleep = defaultSleep } = {})` → `{ run(job: () => Promise<T>, signal: AbortSignal): Promise<T>, pace(signal: AbortSignal): Promise<void> }`
    - `run`: işi tek söz zincirine ekler, önceki iş bitmeden başlamaz; sırası geldiğinde `signal` iptal edilmişse `job` çağrılmadan `signal.reason` ile reddeder.
    - `pace`: istekten hemen önce çağrılır; önceki istek başlayalı `minGapMs` geçmediyse `sleep` eder; sonra `signal` iptal edilmişse reddeder ve son istek anını değiştirmez, değilse son istek anını `now()` yapar.
  - `createPageSource({ fetch, parseHtml, baseUrl, current, count, queue, retryDelayMs = PAGE_RETRY_DELAY_MS, sleep = defaultSleep })` → `{ hasNext(): boolean, next(): Promise<{ page, count, entries }>, load(page: number): Promise<{ page, count, entries }>, dispose(): void }`. `minGapMs` ve `now` parametreleri kalkar.
  - Bu görevin sonunda `main.js` her oturumda yeni bir `createPageQueue()` kurar; davranış bugünküyle aynıdır. Görev 2 sırayı sekmeye taşır.

- [ ] **Step 1: Testleri ortak sıraya geçir ve başarısız testleri yaz**

`test/page-source.test.js` içinde import satırını değiştir:

```js
import { buildPageUrl, createPageSource, PageFetchError } from '../src/core/page-source.js';
```

→

```js
import { buildPageUrl, createPageQueue, createPageSource, PageFetchError } from '../src/core/page-source.js';
```

Aynı dosyada `makeSource` yardımcısını:

```js
function makeSource(fetch, overrides = {}) {
  const clock = { t: 0, sleeps: [] };
  const source = createPageSource({
    fetch,
    parseHtml,
    baseUrl: TOPIC_URL,
    current: 1,
    count: 5,
    now: () => clock.t,
    sleep: async (ms) => {
      clock.sleeps.push(ms);
      clock.t += ms;
    },
    ...overrides,
  });
  return { source, clock };
}
```

şununla değiştir:

```js
/** Tek sekme: sahte saat, ortak sayfa isteği sırası ve bu sıradan oturum açan `open`. `clock.onSleep` bekleme sürerken çalışır. */
function makeTab() {
  const clock = { t: 0, sleeps: [], onSleep: null };
  const sleep = async (ms) => {
    clock.sleeps.push(ms);
    clock.onSleep?.();
    clock.t += ms;
  };
  const queue = createPageQueue({ now: () => clock.t, sleep });
  const open = (fetch, overrides = {}) => createPageSource({
    fetch,
    parseHtml,
    baseUrl: TOPIC_URL,
    current: 1,
    count: 5,
    queue,
    sleep,
    ...overrides,
  });
  return { clock, open };
}

function makeSource(fetch, overrides = {}) {
  const { clock, open } = makeTab();
  return { source: open(fetch, overrides), clock };
}
```

Mevcut testlere dokunma. Dosyanın sonuna ekle:

```js

test('aynı sıradaki iki oturumun istekleri üst üste binmez, aralarında 1500 ms beklenir', async () => {
  const { clock, open } = makeTab();
  const requests = [];
  const firstResponse = deferred();
  const fetch = async (url) => {
    requests.push(url);
    if (requests.length === 1) await firstResponse.promise;
    return ok(pageBody(2, 5));
  };
  const both = Promise.all([open(fetch).next(), open(fetch).next()]);
  await flush();
  assert.deepEqual(requests, [`${TOPIC_URL}?p=2`], 'ilk yanıt gelmeden ikinci oturum istek atmaz');
  firstResponse.resolve();
  await both;
  assert.deepEqual(requests, [`${TOPIC_URL}?p=2`, `${TOPIC_URL}?p=2`]);
  assert.deepEqual(clock.sleeps, [1500]);
});

test('kapatılan oturumun uçuştaki isteği beklenir, sıradaki işi istek atmadan düşer', async () => {
  const { clock, open } = makeTab();
  const requests = [];
  const firstResponse = deferred();
  const fetch = async (url) => {
    requests.push(url);
    if (requests.length === 1) await firstResponse.promise;
    return ok(pageBody(Number(new URL(url).searchParams.get('p')), 9));
  };
  const closed = open(fetch, { count: 9 });
  const inFlight = assert.rejects(closed.next(), { name: 'AbortError' });
  const queued = assert.rejects(closed.load(7), { name: 'AbortError' });
  await flush();
  closed.dispose();
  const reopened = open(fetch, { count: 9 }).next();
  await flush();
  assert.deepEqual(requests, [`${TOPIC_URL}?p=2`], 'uçuştaki yanıt gelmeden yeni istek başlamaz');
  firstResponse.resolve();
  await inFlight;
  await queued;
  assert.equal((await reopened).page, 2);
  assert.deepEqual(requests, [`${TOPIC_URL}?p=2`, `${TOPIC_URL}?p=2`]);
  assert.deepEqual(clock.sleeps, [1500]);
});

test('aralık beklenirken kapatılırsa istek atılmaz, sonraki oturum fazladan beklemez', async () => {
  const { clock, open } = makeTab();
  const requests = [];
  const fetch = async (url) => {
    requests.push(url);
    return ok(pageBody(Number(new URL(url).searchParams.get('p')), 9));
  };
  const closed = open(fetch, { count: 9 });
  await closed.next();
  clock.onSleep = () => closed.dispose(); // 1500 ms aralık beklenirken kapanır
  await assert.rejects(closed.next(), { name: 'AbortError' });
  clock.onSleep = null;
  assert.equal((await open(fetch, { count: 9 }).next()).page, 2);
  assert.deepEqual(requests, [`${TOPIC_URL}?p=2`, `${TOPIC_URL}?p=2`]);
  assert.deepEqual(clock.sleeps, [1500]);
});

test('uçuştaki istek 503 dönerken kapatılırsa 5 sn beklenir, tekrar isteği atılmaz', async () => {
  let calls = 0;
  const { source, clock } = makeSource(async () => {
    calls += 1;
    source.dispose(); // yanıt gelmeden story ekranı kapanır
    return failWith(503);
  });
  await assert.rejects(source.next(), { name: 'AbortError' });
  assert.equal(calls, 1);
  assert.deepEqual(clock.sleeps, [5000]);
});

test('kapatıldıktan sonra next ve load istek atmadan reddedilir', async () => {
  let calls = 0;
  const { source } = makeSource(async () => {
    calls += 1;
    return ok(pageBody(2, 5));
  });
  await source.load(2);
  source.dispose();
  source.dispose();
  await assert.rejects(source.load(2), { name: 'AbortError' }, 'son sonuç da kullanılmaz');
  await assert.rejects(source.next(), { name: 'AbortError' });
  assert.equal(calls, 1);
});
```

Testlerin neyi tuttuğu:
- 1. test: iki oturum aynı sırayı ve aralığı paylaşır.
- 2. test: uçuştaki isteğin yanıtı kullanılmaz, sıradaki iş istek atmadan düşer.
- 3. test: `pace` iptal görünce son istek anını değiştirmez.
- 4. test: `pace` iptal görünce tekrar isteğini atmaz, 5 sn bekleme kısalmaz.
- 5. test: `run` iptal edilmiş işi hiç başlatmaz, önceki sonucu da döndürmez.

- [ ] **Step 2: Testlerin başarısız olduğunu gör**

Run: `node --test test/page-source.test.js`
Expected: FAIL, dosya yüklenmez: `SyntaxError: The requested module '../src/core/page-source.js' does not provide an export named 'createPageQueue'`

- [ ] **Step 3: Ortak sırayı ve `dispose()`'u yaz**

`src/core/page-source.js` dosyasının tamamını şununla değiştir:

```js
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
 * @returns {{ run: (job: () => Promise<any>, signal: AbortSignal) => Promise<any>, pace: (signal: AbortSignal) => Promise<void> }}
 */
export function createPageQueue({ minGapMs = PAGE_MIN_GAP_MS, now = () => Date.now(), sleep = defaultSleep } = {}) {
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

  /** Her istekten hemen önce çağrılır: önceki istek başlayalı `minGapMs` geçmediyse bekler. Beklerken iptal edildiyse istek sayılmaz. */
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
```

Dikkat: `await queue.pace(signal)` bugünkü bekleme gibi `try` bloğunun dışında kalır. İçeride olursa iptal, tekrar denenen ağ hatasına çevrilir ve kapanan oturum boşuna 5 sn bekler.

- [ ] **Step 4: Sayfa kaynağı testlerini çalıştır**

Run: `node --test test/page-source.test.js`
Expected: PASS: `ℹ tests 23`, `ℹ pass 23`, `ℹ fail 0`

- [ ] **Step 5: `main.js`'i yeni imzaya uydur**

`queue` artık zorunlu. Bu adım yapılmadan `npm test` çalıştırılırsa çok sayfalı dört smoke testi `TypeError: Cannot read properties of undefined (reading 'run')` ile düşer.

`src/content/main.js` içinde:

```js
import { createPageSource } from '../core/page-source.js';
```

→

```js
import { createPageQueue, createPageSource } from '../core/page-source.js';
```

ve `startStories` içinde:

```js
  const pageSource = createPageSource({
    fetch: fetchImpl,
    parseHtml,
    baseUrl: doc.location.href,
    current: page.current,
    count: page.count,
  });
```

→

```js
  const pageSource = createPageSource({
    fetch: fetchImpl,
    parseHtml,
    baseUrl: doc.location.href,
    current: page.current,
    count: page.count,
    queue: createPageQueue(),
  });
```

Bu ara durumda her oturum hâlâ kendi sırasını kurar. Görev 2 sırayı sekmeye taşır ve kapatınca kaynağı durdurur.

- [ ] **Step 6: Bütün testleri çalıştır**

Run: `npm test`
Expected: PASS: `ℹ tests 85`, `ℹ pass 85`, `ℹ fail 0`

- [ ] **Step 7: Commit**

```bash
git add src/core/page-source.js test/page-source.test.js src/content/main.js
git commit -m "$(cat <<'EOF'
feat: sayfa kaynağını ortak istek sırasına bağla, dispose ekle

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Kapatınca sayfa kaynağını durdur, sırayı sekmede paylaş

**Files:**
- Modify: `test/story-feed.test.js` (import satırı, dosya sonu)
- Modify: `test/main.smoke.test.js` (import satırları, dosya sonu)
- Modify: `src/content/main.js` (JSDoc, `main` parametreleri, tıklama işleyicisi, `startStories`)
- Modify: `docs/superpowers/specs/2026-09-14-eksi-stories-design.md` (baştaki notlar)
- Modify: `docs/superpowers/specs/2026-09-16-sayfa-gostergesi-design.md` (baştaki `Durum:` satırının altı)

**Interfaces:**
- Consumes:
  - Görev 1'in `createPageQueue(...)` → `{ run, pace }` ve `createPageSource(...).dispose()`
  - `test/story-feed.test.js` yardımcıları: `entry(id, imageIds)`, `fakeResolver()`
  - `test/main.smoke.test.js` yardımcıları: `setup(entries, { count, pages })` (sayfa isteği adresi `${PAGE_URL}?p=N`), `pageEntries(page)` (sayfa başına 4 entry, her birinde 1 görsel, yazar `sayfa N yazarı`), `PAGE_URL`, `CSS_URL`
  - `test/helpers/async.js`: `deferred()` → `{ promise, resolve, reject }`, `flush()`
- Produces:
  - `main({ cssUrl, doc, fetchImpl, navigate, pageQueue = createPageQueue() })`
  - `startStories({ doc, fetchImpl, cssText, resolver, pageQueue, onClose })`; kapatınca sırayla `feed.dispose()`, `pageSource.dispose()`, `onClose(lastEntryId)`

- [ ] **Step 1: Story akışı testini yaz**

`test/story-feed.test.js` içinde:

```js
import { flush } from './helpers/async.js';
```

→

```js
import { deferred, flush } from './helpers/async.js';
```

Dosyanın sonuna ekle:

```js

test('kapatıldıktan sonra reddedilen sayfa isteği hata durumu yaratmaz', async () => {
  const background = deferred();
  const jump = deferred();
  const pageSource = { hasNext: () => true, next: () => background.promise, load: () => jump.promise };
  const loading = createStoryFeed({ entries: [entry('1', ['a'])], page: 1, pageCount: 9, pageSource, resolver: fakeResolver() });
  const jumping = createStoryFeed({ entries: [entry('2', ['b', 'c', 'd', 'e'])], page: 1, pageCount: 9, pageSource, resolver: fakeResolver() });
  loading.start();
  jumping.start();
  jumping.goToPage(7);
  assert.equal(loading.state.loading, true, 'arka planda sonraki sayfa isteniyor');
  assert.equal(jumping.state.jumping, true, '7. sayfaya atlanıyor');

  loading.dispose();
  jumping.dispose();
  background.reject(new DOMException('iptal', 'AbortError'));
  jump.reject(new DOMException('iptal', 'AbortError'));
  await flush();
  assert.equal(loading.state.errorKind, null);
  assert.equal(jumping.state.errorKind, null);
});
```

- [ ] **Step 2: Testi çalıştır**

Run: `node --test test/story-feed.test.js`
Expected: PASS: `ℹ tests 27`, `ℹ pass 27`, `ℹ fail 0`

Story akışının kodu değişmediği için bu test baştan geçer. `fetchNextPage` ve `runJump` içindeki `disposed` korumalarını sabitler: ikisinden biri kaldırılırsa düşer.

- [ ] **Step 3: Kapatıp yeniden açma smoke testini yaz**

`test/main.smoke.test.js` içinde:

```js
import { main } from '../src/content/main.js';
import { flush } from './helpers/async.js';
```

→

```js
import { main } from '../src/content/main.js';
import { createPageQueue } from '../src/core/page-source.js';
import { deferred, flush } from './helpers/async.js';
```

Dosyanın sonuna ekle:

```js

test('kapatıp hemen yeniden açınca kapanan oturumun sayfası istenmez, sayfa istekleri üst üste binmez', async () => {
  const { dom, doc, fetchImpl } = setup([pageEntries(1)[0]], { count: 9, pages: { 2: pageEntries(2), 7: pageEntries(7) } });
  const clock = { t: 0, sleeps: [] };
  const pageQueue = createPageQueue({
    now: () => clock.t,
    sleep: async (ms) => {
      clock.sleeps.push(ms);
      clock.t += ms;
    },
  });
  const pageRequests = [];
  const heldResponses = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const slowFetch = async (url, init) => {
    if (!url.startsWith(`${PAGE_URL}?`)) return fetchImpl(url, init);
    pageRequests.push(url);
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    const held = deferred();
    heldResponses.push(held);
    await held.promise;
    inFlight -= 1;
    return fetchImpl(url, init);
  };
  const navigations = [];
  await main({ cssUrl: CSS_URL, doc, fetchImpl: slowFetch, navigate: (url) => navigations.push(url), pageQueue });

  doc.querySelector('.eksi-stories-button').click();
  await flush();
  await flush();
  assert.deepEqual(pageRequests, [`${PAGE_URL}?p=2`], 'tek görselli sayfada sonraki sayfa arka planda istenir');

  const select = doc.querySelector('eksi-stories-viewer').shadowRoot.querySelector('.es-pager-select');
  select.value = '7';
  select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(doc.querySelector('eksi-stories-viewer'), null);
  doc.querySelector('.eksi-stories-button').click();
  for (let i = 0; i < 4; i += 1) await flush();
  assert.deepEqual(pageRequests, [`${PAGE_URL}?p=2`], 'eski yanıt gelmeden yeni sayfa isteği başlamaz');

  heldResponses[0].resolve();
  for (let i = 0; i < 4; i += 1) await flush();
  assert.deepEqual(pageRequests, [`${PAGE_URL}?p=2`, `${PAGE_URL}?p=2`], 'yeni oturum sırayı devralır');
  assert.deepEqual(clock.sleeps, [1500]);

  heldResponses[1].resolve();
  for (let i = 0; i < 4; i += 1) await flush();
  assert.deepEqual(pageRequests, [`${PAGE_URL}?p=2`, `${PAGE_URL}?p=2`], 'kapanan oturumun 7. sayfası istenmez');
  assert.equal(maxInFlight, 1);
  assert.deepEqual(navigations, []);
  const shadow = doc.querySelector('eksi-stories-viewer').shadowRoot;
  assert.equal(shadow.querySelector('.es-author-name').textContent, 'sayfa 1 yazarı');
  assert.equal(shadow.querySelector('.es-counter').textContent, '1/1');
});
```

Akış:
1. İlk sayfada tek görsel olduğu için açılışta `?p=2` arka planda istenir ve yanıtı test bırakana kadar bekler.
2. Seçim kutusundan 7 seçilince `load(7)` sıraya girer. Esc ile kapatılır, hemen yeniden açılır ve yeni oturumun `next()`'i sıraya girer.
3. İlk yanıt bırakılınca kapanan oturumun yanıtı atılır, `load(7)` istek atmadan düşer. Yeni oturum 1500 ms bekleyip `?p=2` ister.
4. Kapanırken son bakılan entry (`101`) açık sayfada olduğu için `navigate` çağrılmaz.

- [ ] **Step 4: Smoke testinin başarısız olduğunu gör**

Run: `node --test test/main.smoke.test.js`
Expected: FAIL. Bu test düşer (`ℹ tests 10`, `ℹ pass 9`, `ℹ fail 1`), hata:

```
AssertionError [ERR_ASSERTION]: eski yanıt gelmeden yeni sayfa isteği başlamaz
```

`actual` listesinde iki `?p=2` vardır: `main` henüz `pageQueue`'yu kullanmıyor, yeniden açılan oturum kendi sırasıyla hemen istek atıyor.

- [ ] **Step 5: Sırayı sekmeye taşı, kapatınca sayfa kaynağını durdur**

`src/content/main.js` içinde üç değişiklik:

(a) JSDoc ve parametreler:

```js
/**
 * Content script giriş noktası; loader.js çağırır. chrome.* API'sine bağımlı değildir.
 * @param {{ cssUrl: string, doc?: Document, fetchImpl?: (url: string, init?: object) => Promise<Response>, navigate?: (url: string) => void }} options
 */
export async function main({
  cssUrl,
  doc = document,
  fetchImpl = (url, init) => globalThis.fetch(url, init),
  navigate = (url) => doc.defaultView.location.assign(url),
}) {
```

→

```js
/**
 * Content script giriş noktası; loader.js çağırır. chrome.* API'sine bağımlı değildir.
 * `pageQueue` sekmenin ortak sayfa isteği sırasıdır: story ekranı kapatılıp açılsa da aynı anda tek sayfa istenir.
 * @param {{ cssUrl: string, doc?: Document, fetchImpl?: (url: string, init?: object) => Promise<Response>, navigate?: (url: string) => void, pageQueue?: ReturnType<typeof createPageQueue> }} options
 */
export async function main({
  cssUrl,
  doc = document,
  fetchImpl = (url, init) => globalThis.fetch(url, init),
  navigate = (url) => doc.defaultView.location.assign(url),
  pageQueue = createPageQueue(),
}) {
```

(b) Tıklama işleyicisindeki `startStories` çağrısı:

```js
        cssText,
        resolver,
        onClose: (lastEntryId) => {
```

→

```js
        cssText,
        resolver,
        pageQueue,
        onClose: (lastEntryId) => {
```

(c) `startStories`:

```js
function startStories({ doc, fetchImpl, cssText, resolver, onClose }) {
  const { topic, page, entries } = parseTopicPage(doc);
  const parseHtml = (html) => new doc.defaultView.DOMParser().parseFromString(html, 'text/html');
  const pageSource = createPageSource({
    fetch: fetchImpl,
    parseHtml,
    baseUrl: doc.location.href,
    current: page.current,
    count: page.count,
    queue: createPageQueue(),
  });
  const feed = createStoryFeed({ entries, page: page.current, pageCount: page.count, pageSource, resolver });
  openViewer({
    feed,
    topic,
    cssText,
    doc,
    onClose: (lastEntryId) => {
      feed.dispose();
      onClose(lastEntryId);
    },
  });
```

→

```js
function startStories({ doc, fetchImpl, cssText, resolver, pageQueue, onClose }) {
  const { topic, page, entries } = parseTopicPage(doc);
  const parseHtml = (html) => new doc.defaultView.DOMParser().parseFromString(html, 'text/html');
  const pageSource = createPageSource({
    fetch: fetchImpl,
    parseHtml,
    baseUrl: doc.location.href,
    current: page.current,
    count: page.count,
    queue: pageQueue,
  });
  const feed = createStoryFeed({ entries, page: page.current, pageCount: page.count, pageSource, resolver });
  openViewer({
    feed,
    topic,
    cssText,
    doc,
    onClose: (lastEntryId) => {
      feed.dispose();
      // Bu oturumun sıradaki sayfa işleri istek atmadan düşer; yeniden açılan oturum aynı sırada bekler.
      pageSource.dispose();
      onClose(lastEntryId);
    },
  });
```

`feed.start();` satırı ve dosyanın geri kalanı aynı kalır.

- [ ] **Step 6: Testleri çalıştır**

Run: `node --test test/main.smoke.test.js`
Expected: PASS: `ℹ tests 10`, `ℹ pass 10`, `ℹ fail 0`

Run: `npm test`
Expected: PASS: `ℹ tests 87`, `ℹ pass 87`, `ℹ fail 0`

- [ ] **Step 7: Eski spec'lere not ekle**

`docs/superpowers/specs/2026-09-14-eksi-stories-design.md` içinde şu satırın:

```markdown
Not: §5 kapatma ve §6 üst bar maddeleri 2026-09-16-sayfa-gostergesi-design.md ile güncellendi.
```

hemen altına ekle:

```markdown
Not: §4 `createPageSource` imzası 2026-09-17-ortak-istek-sirasi-design.md ile güncellendi: sayfa istekleri sekme başına ortak sırada, sayfa kaynağında `dispose()` var.
```

`docs/superpowers/specs/2026-09-16-sayfa-gostergesi-design.md` içinde `Durum: Onaylandı.` ile başlayan satırın hemen altına ekle:

```markdown
Not: §6 sayfa kaynağının sırası ve istek aralığı 2026-09-17-ortak-istek-sirasi-design.md ile sekme başına ortak sıraya taşındı.
```

Başka belgeye dokunma: README, PRIVACY, `store/` ve CHANGELOG değişmez.

- [ ] **Step 8: Gerçek zamanlayıcılarla doğrula**

Bu betik repoya eklenmez. Repo dışında geçici bir dosyaya yaz (ör. oturumun scratchpad klasörüne `verify-overlap.mjs`):

```js
// Gerçek zamanlayıcılarla kapat → hemen yeniden aç denemesi. Repo kökünden çalıştır: node <bu dosya>
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const { JSDOM } = createRequire(`${root}/package.json`)('jsdom');
const { main } = await import(pathToFileURL(`${root}/src/content/main.js`).href);
const { link, topicPageHtml } = await import(pathToFileURL(`${root}/test/helpers/eksi-html.js`).href);

const PAGE_URL = 'https://eksisozluk.com/deneme-basligi--1000001';
const CSS_URL = 'chrome-extension://test/viewer.css';
const entries = (page) => [{ id: `${page}01`, content: link(`https://example.com/p${page}.jpg`) }];
const dom = new JSDOM(topicPageHtml({ count: 9, entries: entries(1) }), { url: PAGE_URL });
const doc = dom.window.document;
const startedAt = Date.now();
const elapsed = () => Date.now() - startedAt;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const starts = [];
let inFlight = 0;
let maxInFlight = 0;

const fetchImpl = async (url) => {
  if (url === CSS_URL) return { ok: true, status: 200, text: async () => '' };
  const page = Number(new URL(url).searchParams.get('p'));
  starts.push({ page, at: elapsed() });
  inFlight += 1;
  maxInFlight = Math.max(maxInFlight, inFlight);
  console.log(`${elapsed()} ms başla p=${page} (uçuşta ${inFlight})`);
  await wait(300);
  inFlight -= 1;
  console.log(`${elapsed()} ms bitti p=${page}`);
  return { ok: true, status: 200, text: async () => topicPageHtml({ current: page, count: 9, entries: entries(page) }) };
};

await main({ cssUrl: CSS_URL, doc, fetchImpl, navigate: () => {} });
doc.querySelector('.eksi-stories-button').click();
await wait(50);
const select = doc.querySelector('eksi-stories-viewer').shadowRoot.querySelector('.es-pager-select');
select.value = '7';
select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
console.log(`${elapsed()} ms sayfa 7 seçildi`);
await wait(50);
dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }));
console.log(`${elapsed()} ms esc`);
await wait(100);
doc.querySelector('.eksi-stories-button').click();
console.log(`${elapsed()} ms yeniden açıldı`);
await wait(4000);

const gaps = starts.slice(1).map((start, i) => start.at - starts[i].at);
console.log(`sayfalar: ${starts.map((start) => start.page).join(', ')}`);
console.log(`en çok uçuşta: ${maxInFlight}`);
console.log(`en kısa aralık: ${Math.min(...gaps)} ms`);
process.exit(0);
```

Run (repo kökünden, yaklaşık 4,5 sn sürer): `node <betiğin yolu>`
Expected: zamanlar birkaç ms oynayabilir. `sayfalar` ve `en çok uçuşta` satırları aynı olur, `en kısa aralık` en az 1500 ms olur (denemelerde 1500 ve 1501 ms çıktı):

```
12 ms başla p=2 (uçuşta 1)
60 ms sayfa 7 seçildi
112 ms esc
216 ms yeniden açıldı
313 ms bitti p=2
1512 ms başla p=2 (uçuşta 1)
1813 ms bitti p=2
3013 ms başla p=3 (uçuşta 1)
3315 ms bitti p=3
sayfalar: 2, 2, 3
en çok uçuşta: 1
en kısa aralık: 1500 ms
```

Düzeltmeden önce aynı betik `sayfalar: 2, 2, 7, 3, 4`, `en çok uçuşta: 2`, `en kısa aralık: 204 ms` civarı verir. Sonuç beklenenden farklıysa dur ve raporla.

- [ ] **Step 9: Commit**

```bash
git add src/content/main.js test/story-feed.test.js test/main.smoke.test.js docs/superpowers/specs/2026-09-14-eksi-stories-design.md docs/superpowers/specs/2026-09-16-sayfa-gostergesi-design.md
git commit -m "$(cat <<'EOF'
fix: kapatıp hemen açınca sayfa isteklerini sekmede tek sırada tut

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Teslim (görevlerden sonra; alt ajana verilmez)

Kullanıcıya soruları AskUserQuestion ile sor.

1. Bütün dalın son incelemesi (superpowers:requesting-code-review), bulgular için düzeltme turu.
2. İsteğe bağlı canlı kontrol. AskUserQuestion: "chrome'da canlı kontrol yapalım mı? eklentiyi yenileyip ekşi sekmesini de yenilemen gerekecek." Seçenekler: "Yapalım" / "Gerek yok". "Yapalım" seçilirse:
   - Claude in Chrome araçlarını tek seferde yükle: ToolSearch sorgusu `select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__read_console_messages,mcp__claude-in-chrome__find`.
   - Not: bu araçta sorgu parametreli adres içeren JS çıktıları engellenir; aşağıdaki fonksiyon adres döndürmez.
   - `https://eksisozluk.com/anin-fotografi--6459985` adresini aç, story butonuna tıkla (`find` ile `story ·` butonunu bul, `computer` ile tıkla), iki saniye bekle ve çalıştır:

   ```js
   (async () => {
     const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
     const pick = (value) => {
       const select = document.querySelector('eksi-stories-viewer').shadowRoot.querySelector('.es-pager-select');
       select.value = String(value);
       select.dispatchEvent(new Event('change', { bubbles: true }));
     };
     const close = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
     const reopen = () => document.querySelector('.eksi-stories-button').click();
     const total = document.querySelector('eksi-stories-viewer').shadowRoot.querySelector('.es-pager-select').options.length;
     const first = Math.max(3, Math.floor(total / 2));
     const before = performance.getEntriesByType('resource').length;
     pick(first);
     await sleep(30);
     close();
     await sleep(30);
     reopen();
     await sleep(30);
     pick(first + 1);
     await sleep(30);
     close();
     await sleep(30);
     reopen();
     await sleep(30);
     pick(first + 2);
     await sleep(8000);
     const pages = performance.getEntriesByType('resource').slice(before)
       .filter((entry) => {
         const url = new URL(entry.name);
         return url.pathname === location.pathname && url.searchParams.has('p');
       })
       .sort((a, b) => a.startTime - b.startTime);
     const gaps = pages.slice(1).map((entry, i) => Math.round(entry.startTime - pages[i].startTime));
     return {
       first,
       pageNumbers: pages.map((entry) => Number(new URL(entry.name).searchParams.get('p'))),
       overlaps: pages.slice(1).filter((entry, i) => entry.startTime < pages[i].responseEnd).length,
       minGap: gaps.length ? Math.min(...gaps) : null,
       viewerOpen: Boolean(document.querySelector('eksi-stories-viewer')),
     };
   })()
   ```

   Expected: `pageNumbers` `[first, first + 2]`. İkinci oturumun `first + 1` isteği sırada beklerken düştüğü için listede olmaz. Hedef sayfalarda 4'ten az görsel varsa sonlarına en az 1,5 sn arayla sonraki sayfalar eklenebilir. `overlaps` `0`, `minGap` en az `1500` (tarayıcı ölçümünde 1-2 ms eksik görünebilir), `viewerOpen` `true` olmalı. İlk istek 30 ms içinde yanıtlanırsa ekran `focusto` adresine gidebilir; o zaman sayfa yeniden yüklenir ve fonksiyon sonuç döndürmez, bekleme sürelerini 10 ms yapıp tekrarla. `pageNumbers` boş dönerse eklentinin istekleri bu listede görünmüyor demektir: `read_console_messages` ile hata olmadığını kontrol et, istekleri kullanıcıdan devtools network sekmesinde doğrulamasını iste.
3. Birleştirme ve push kararı kullanıcıda (superpowers:finishing-a-development-branch). Push yalnızca açık onayla yapılır.
