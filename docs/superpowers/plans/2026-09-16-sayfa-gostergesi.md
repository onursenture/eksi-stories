# sayfa göstergesi, sayaç ve avatar: uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Story ekranına ekşi'nin koyu temadaki sayfa göstergesini (sayfa atlamalı), sayfa içi story sayacını ve "avatar - isim" üst barını eklemek; kapatınca son bakılan entry'ye gitmek.

**Architecture:** Sayfa kaynağı istenen sayfayı sıralı istek kuyruğuyla yükleyebilir hale gelir (`load(page)`). Story akışı `goToPage(page)` ile tampondaki sayfaya istek atmadan geçer ya da tamponu hedef sayfadan yeniden kurar; atlamadan önce başlamış arka plan yüklemesini bir `epoch` sayacıyla yok sayar, art arda seçimlerde yalnızca en son hedefi yükler. Görüntüleyici göstergeyi ve sayacı `feed.state`'ten çizer; kapatma kararı `main.js`'tedir.

**Tech Stack:** Vanilla JS (MV3 Chrome eklentisi), Node.js 26 `node:test`, jsdom, Playwright MCP ve Claude in Chrome araçları (görsel ve canlı doğrulama).

**Spec:** [docs/superpowers/specs/2026-09-16-sayfa-gostergesi-design.md](../specs/2026-09-16-sayfa-gostergesi-design.md)

## Global Constraints

- İstek kuralları değişmez: sayfa istekleri arası en az 1500 ms; aynı anda tek sayfa isteği (`load` ve `next` dahil); 429/5xx/ağ hatasında 5000 ms sonra bir tekrar; art arda 5 görselsiz sayfada durma. Sayfa atlamada hedef sayfa boş sayfa sayacına dahil edilmez.
- Tek sayfalı başlıkta (`pageCount <= 1`) sayfa göstergesi ve üst şerit yoktur; görseller tam yüksekliği kullanır.
- Üst şerit: `--es-strip: 51px` (12 + 27 + 12). Gösterge `top: 12px; right: 12px`.
- Gösterge görünümü ekşi koyu tema ölçümüdür (16.09.2026) ve birebir kullanılır: font `"Source Sans Pro", sans-serif`, 14px, `line-height: 22.652px`, ayraç rengi `rgb(102, 102, 102)`; seçim kutusu `height: 26px; padding: 2px; margin: 0 5px; color: rgb(255, 255, 255); background-color: rgb(71, 71, 71); border: 1px solid rgb(73, 73, 73); border-radius: 4px; appearance: auto; color-scheme: normal`; kutular `height: 26.6484px; padding: 1px 8px; margin: 0 0 0 5px; color: rgb(189, 189, 189); background-color: transparent; border: 1px solid rgb(73, 73, 73); border-radius: 4px`, hover `background-color: rgb(31, 31, 31)`.
- Gösterge sırası: `«` (yalnızca sayfa > 1), seçim kutusu, `/`, son sayfa kutusu, `»` (yalnızca sayfa < toplam).
- Sayaç metni `k/n` (boşluksuz), sayfa içi; açılmayan görseller `n`'ye dahil.
- Avatar: 24px yuvarlak, `alt=""`, "avatar - isim" sırası, açık tema varsayılanı koyu sürüme çevrilir, yoksa `DEFAULT_AVATAR_URL = 'https://ekstat.com/img/default-profile-picture-dark.svg'`.
- Kapatma: entry açık sayfanın DOM'undaysa kaydır; değilse `${origin}${pathname}?focusto=<entry id>` adresine git.
- Yeni metinler ekşi arayüz dilindedir (küçük harf, kısa): `sayfa yükleniyor…`, `önceki sayfa`, `sonraki sayfa`, `son sayfa`, `sayfa`. Belgelere eklenecek metinler spec §8'de birebir verilmiştir.
- Playground ekşi'ye istek atmaz; üretilmiş avatarlar data adresidir.
- Store ekran görüntüleri 1280×800, duraklatma simgesi olmadan çekilir.
- Tüm commit mesajları şu satırla biter: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

## Dosya haritası

| dosya | değişiklik | görev |
|---|---|---|
| `src/core/constants.js` | `DEFAULT_AVATAR_URL` | 1 |
| `src/core/entry-parser.js` | `Entry.avatarUrl` | 1 |
| `test/helpers/eksi-html.js`, `test/entry-parser.test.js` | avatar yapısı ve testleri | 1 |
| `src/core/page-source.js`, `test/page-source.test.js` | `load(page)` ve sıralı istek kuyruğu | 2 |
| `src/core/story-feed.js`, `test/story-feed.test.js` | `goToPage`, `epoch`, yeni `state` alanları | 3 |
| `src/viewer/viewer.js`, `src/viewer/viewer.css`, `test/main.smoke.test.js` | avatar - isim, sayaç, gösterge, şerit | 4 |
| `src/content/main.js`, `test/main.smoke.test.js` | kapatınca `focusto` | 5 |
| `dev/playground.js` | `load`, avatarlar, üç sayfalı senaryo | 6 |
| `store/screenshots/*.png` | yeniden çekim | 6 |
| `README.md`, `PRIVACY.md`, `CHANGELOG.md`, `store/listing-tr.md`, eski spec | belge değişiklikleri | 7 |
| `dist/eksi-stories-0.1.0.zip` (git dışı) | paket; canlı kontrol ve push | 8 |

---

### Task 1: Entry avatarı

**Files:**
- Modify: `test/helpers/eksi-html.js` (`entryHtml`)
- Modify: `test/entry-parser.test.js`
- Modify: `src/core/constants.js`
- Modify: `src/core/entry-parser.js`

**Interfaces:**
- Consumes: yok
- Produces:
  - `DEFAULT_AVATAR_URL` (`src/core/constants.js`): `'https://ekstat.com/img/default-profile-picture-dark.svg'`
  - `Entry.avatarUrl: string` (her zaman dolu, mutlak adres)
  - Test yardımcısı `entryHtml({ id, author, date, content, avatar })`: `avatar` varsayılanı `'https://img.ekstat.com/profiles/deneme-1.jpg'`; `null` verilirse avatar öğesi eklenmez.

- [ ] **Step 1: Test yardımcısına gerçek avatar yapısını ekle**

`test/helpers/eksi-html.js` içinde:

```js
export function entryHtml({ id, author = 'deneme yazar', date = '01.01.2026 10:00', content = '' }) {
  const nick = author.replaceAll(' ', '-');
```

→

```js
export function entryHtml({ id, author = 'deneme yazar', date = '01.01.2026 10:00', content = '', avatar = 'https://img.ekstat.com/profiles/deneme-1.jpg' }) {
  const nick = author.replaceAll(' ', '-');
  const avatarHtml = avatar === null
    ? ''
    : `<div class="avatar-container"><a href="/biri/${escapeHtml(nick)}"><img class="avatar" src="${escapeHtml(avatar)}" data-default="//ekstat.com/img/default-profile-picture-dark.svg" alt="${escapeHtml(author)}" title="${escapeHtml(author)}"></a></div>`;
```

ve aynı fonksiyonda:

```js
          <div><a class="entry-date permalink" href="/entry/${id}">${escapeHtml(date)}</a></div>
        </div>
      </div>
```

→

```js
          <div><a class="entry-date permalink" href="/entry/${id}">${escapeHtml(date)}</a></div>
        </div>
        ${avatarHtml}
      </div>
```

- [ ] **Step 2: Başarısız testleri yaz**

`test/entry-parser.test.js` başındaki import'lara ekle:

```js
import { DEFAULT_AVATAR_URL } from '../src/core/constants.js';
```

`entry alanları ve görseli okunur` testindeki beklenen nesneye `authorUrl` satırının ardından ekle:

```js
    avatarUrl: 'https://img.ekstat.com/profiles/deneme-1.jpg',
```

Dosyanın sonuna yeni test ekle:

```js
test('avatar okunur, açık varsayılan koyuya çevrilir, yoksa varsayılan kullanılır', () => {
  const doc = parseHtml(topicPageHtml({
    entries: [
      { id: '201', content: 'a', avatar: 'https://img.ekstat.com/profiles/ornek-123.jpg' },
      { id: '202', content: 'b', avatar: '//ekstat.com/img/default-profile-picture-dark.svg' },
      { id: '203', content: 'c', avatar: '//ekstat.com/img/default-profile-picture-light.svg' },
      { id: '204', content: 'd', avatar: null },
    ],
  }));
  assert.deepEqual(parseTopicPage(doc).entries.map((entry) => entry.avatarUrl), [
    'https://img.ekstat.com/profiles/ornek-123.jpg',
    'https://ekstat.com/img/default-profile-picture-dark.svg',
    'https://ekstat.com/img/default-profile-picture-dark.svg',
    DEFAULT_AVATAR_URL,
  ]);
});
```

- [ ] **Step 3: Testlerin başarısız olduğunu gör**

Run: `node --test test/entry-parser.test.js`
Expected: FAIL, dosya yüklenemez: `The requested module '../src/core/constants.js' does not provide an export named 'DEFAULT_AVATAR_URL'`

- [ ] **Step 4: Sabiti ve ayrıştırmayı yaz**

`src/core/constants.js` sonuna ekle:

```js
export const DEFAULT_AVATAR_URL = 'https://ekstat.com/img/default-profile-picture-dark.svg';
```

`src/core/entry-parser.js` içinde:

```js
import { EKSI_ORIGIN } from './constants.js';
```

→

```js
import { DEFAULT_AVATAR_URL, EKSI_ORIGIN } from './constants.js';
```

```js
const BBCODE_RESIDUE = /\[\/?(?:url|img)(?:=[^\]]*)?\]/gi;
```

→

```js
const BBCODE_RESIDUE = /\[\/?(?:url|img)(?:=[^\]]*)?\]/gi;
const LIGHT_DEFAULT_AVATAR = /default-profile-picture-light\.svg$/;
```

`parseEntry` dönüşündeki:

```js
    authorUrl: new URL(authorLink?.getAttribute('href') ?? `/biri/${author.replaceAll(' ', '-')}`, EKSI_ORIGIN).href,
```

satırının ardına ekle:

```js
    avatarUrl: readAvatarUrl(li),
```

`collectText` fonksiyonunun hemen üstüne ekle:

```js
function readAvatarUrl(li) {
  const src = li.querySelector('footer .avatar-container img.avatar')?.getAttribute('src');
  if (!src) return DEFAULT_AVATAR_URL;
  try {
    return new URL(src, EKSI_ORIGIN).href.replace(LIGHT_DEFAULT_AVATAR, 'default-profile-picture-dark.svg');
  } catch {
    return DEFAULT_AVATAR_URL;
  }
}
```

- [ ] **Step 5: Testlerin geçtiğini gör**

Run: `node --test test/entry-parser.test.js`
Expected: `ℹ fail 0`

Run: `npm test`
Expected: `ℹ fail 0`

- [ ] **Step 6: Commit**

```bash
git add test/helpers/eksi-html.js test/entry-parser.test.js src/core/constants.js src/core/entry-parser.js
git commit -m "feat: entry avatarını oku, açık varsayılan çizimi koyuya çevir

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Sayfa kaynağında istenen sayfayı yükleme

> Uygulama notu (inceleme sonrası): `next()` sayfasını sırası gelince belirler ve art arda aynı sayfa tek istekle yüklenir; son kod `src/core/page-source.js` ve `test/page-source.test.js`'tedir.

**Files:**
- Modify: `src/core/page-source.js` (`createPageSource`)
- Modify: `test/page-source.test.js`

**Interfaces:**
- Consumes: yok
- Produces: `createPageSource(...)` artık `{ hasNext(): boolean, next(): Promise<{ page, count, entries }>, load(page: number): Promise<{ page, count, entries }> }` döner.
  - `load` ve `next` aynı sıralı kuyruğu kullanır: aynı anda tek istek, istekler arası `minGapMs`.
  - `load(page)` başarısında `lastPage = page`; `next()` bundan sonra `page + 1`'i ister.
  - `next()` eşzamanlı çağrılarda aynı sözü döndürmeye devam eder.
  - `load(page)`, sürmekte olan `next()` aynı sayfayı istiyorsa yeni istek atmaz, o sözü döndürür.

- [ ] **Step 1: Başarısız testleri yaz**

`test/page-source.test.js` başındaki import'lara ekle:

```js
import { deferred, flush } from './helpers/async.js';
```

Dosyanın sonuna ekle:

```js
test('load istenen sayfayı çeker, next ondan sonraki sayfadan devam eder', async () => {
  const requests = [];
  const { source } = makeSource(async (url) => {
    requests.push(url);
    const page = Number(new URL(url).searchParams.get('p'));
    return ok(pageBody(page, 6));
  }, { count: 6 });
  const loaded = await source.load(3);
  assert.equal(loaded.page, 3);
  assert.equal(loaded.count, 6);
  assert.deepEqual(loaded.entries.map((entry) => entry.id), ['301']);
  assert.equal(source.hasNext(), true);
  assert.equal((await source.next()).page, 4);
  assert.deepEqual(requests, [`${TOPIC_URL}?p=3`, `${TOPIC_URL}?p=4`]);
});

test('load son sayfayı yüklerse hasNext false olur', async () => {
  const { source } = makeSource(async () => ok(pageBody(5, 5)));
  await source.load(5);
  assert.equal(source.hasNext(), false);
});

test('load ve next aynı anda tek istek atar, aralarında 1500 ms beklenir', async () => {
  const requests = [];
  const firstResponse = deferred();
  const { source, clock } = makeSource(async (url) => {
    requests.push(url);
    const page = Number(new URL(url).searchParams.get('p'));
    if (page === 2) await firstResponse.promise;
    return ok(pageBody(page, 9));
  }, { count: 9 });
  const both = Promise.all([source.next(), source.load(7)]);
  await flush();
  assert.deepEqual(requests, [`${TOPIC_URL}?p=2`], 'ilk yanıt gelmeden ikinci istek başlamaz');
  firstResponse.resolve();
  await both;
  assert.deepEqual(requests, [`${TOPIC_URL}?p=2`, `${TOPIC_URL}?p=7`]);
  assert.deepEqual(clock.sleeps, [1500]);
});

test('load sürmekte olan next ile aynı sayfayı isterse ikinci istek atılmaz', async () => {
  const requests = [];
  const { source } = makeSource(async (url) => {
    requests.push(url);
    return ok(pageBody(2, 5));
  });
  const fromNext = source.next();
  const fromLoad = source.load(2);
  assert.equal(fromLoad, fromNext);
  await fromLoad;
  assert.deepEqual(requests, [`${TOPIC_URL}?p=2`]);
});

test('load 5xx hatasında 5 sn sonra bir kez tekrar dener', async () => {
  const responses = [failWith(502), ok(pageBody(4, 5))];
  const { source, clock } = makeSource(async () => responses.shift());
  assert.equal((await source.load(4)).page, 4);
  assert.deepEqual(clock.sleeps, [5000]);
});
```

- [ ] **Step 2: Testlerin başarısız olduğunu gör**

Run: `node --test test/page-source.test.js`
Expected: FAIL, yeni beş testte `TypeError: source.load is not a function`; mevcut 11 test geçer.

- [ ] **Step 3: Sıralı kuyruğu ve `load`'u yaz**

`src/core/page-source.js` içinde JSDoc ve fonksiyon gövdesini değiştir. Şu blok:

```js
/**
 * Başlığın sonraki sayfalarını siteye yük bindirmeden, sırayla çeker.
 * @returns {{ hasNext: () => boolean, next: () => Promise<{ page: number, count: number, entries: object[] }> }}
 */
```

→

```js
/**
 * Başlığın sayfalarını siteye yük bindirmeden, sırayla çeker.
 * @returns {{ hasNext: () => boolean, next: () => Promise<{ page: number, count: number, entries: object[] }>, load: (page: number) => Promise<{ page: number, count: number, entries: object[] }> }}
 */
```

```js
  let lastRequestAt = Number.NEGATIVE_INFINITY;
  let inFlight = null;
```

→

```js
  let lastRequestAt = Number.NEGATIVE_INFINITY;
  let queue = Promise.resolve();
  let nextInFlight = null;
  let nextInFlightPage = 0;
```

`request` fonksiyonundan sonra gelen bloğun tamamı (`async function load(page) {` satırından dosyanın sonuna kadar):

```js
  async function load(page) {
    const url = buildPageUrl(baseUrl, page);
    let result = await request(url);
    if (result.error && result.retryable) {
      await sleep(retryDelayMs);
      result = await request(url);
    }
    if (result.error) throw result.error;
    return parseTopicPage(parseHtml(result.html));
  }

  const hasNext = () => lastPage < pageCount;

  function next() {
    if (inFlight) return inFlight;
    if (!hasNext()) return Promise.reject(new Error('sonraki sayfa yok'));
    const page = lastPage + 1;
    inFlight = load(page)
      .then((parsed) => {
        lastPage = page;
        if (parsed.page.current !== page) {
          pageCount = page;
          return { page, count: pageCount, entries: [] };
        }
        pageCount = Math.max(parsed.page.count, page);
        return { page, count: pageCount, entries: parsed.entries };
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  }

  return { hasNext, next };
}
```

→

```js
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

  /** Sayfa isteklerini sıraya sokar: biri bitmeden sonraki başlamaz. */
  function enqueue(page) {
    const result = queue.then(async () => {
      const parsed = await fetchPage(page);
      lastPage = page;
      if (parsed.page.current !== page) {
        pageCount = page;
        return { page, count: pageCount, entries: [] };
      }
      pageCount = Math.max(parsed.page.count, page);
      return { page, count: pageCount, entries: parsed.entries };
    });
    queue = result.catch(() => {});
    return result;
  }

  const hasNext = () => lastPage < pageCount;

  function next() {
    if (nextInFlight) return nextInFlight;
    if (!hasNext()) return Promise.reject(new Error('sonraki sayfa yok'));
    nextInFlightPage = lastPage + 1;
    nextInFlight = enqueue(nextInFlightPage).finally(() => {
      nextInFlight = null;
    });
    return nextInFlight;
  }

  /** İstenen sayfayı yükler; aynı sayfa zaten `next()` ile isteniyorsa o sözü döndürür. */
  function load(page) {
    if (nextInFlight && nextInFlightPage === page) return nextInFlight;
    return enqueue(page);
  }

  return { hasNext, next, load };
}
```

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `node --test test/page-source.test.js`
Expected: `ℹ fail 0` (mevcut 11 test ve yeni 5 test)

Run: `npm test`
Expected: `ℹ fail 0`

- [ ] **Step 5: Commit**

```bash
git add src/core/page-source.js test/page-source.test.js
git commit -m "feat: sayfa kaynağına sıralı kuyrukla istenen sayfayı yükleme ekle

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Story akışında sayfa atlama ve sayfa içi sayaç

**Files:**
- Modify: `src/core/story-feed.js` (tamamı aşağıdaki içerikle değişir)
- Modify: `test/story-feed.test.js` (yeni yardımcı ve testler eklenir)

**Interfaces:**
- Consumes: Görev 2'nin `pageSource.load(page)`, mevcut `pageSource.next()` ve `hasNext()`
- Produces:
  - `feed.goToPage(page: number): void`
  - `feed.state` yeni alanları: `page: number`, `pagePosition: number | null`, `pageStoryCount: number | null`, `jumping: boolean`
  - `state.page`: aktif story'nin sayfası; aktif story yoksa atlanan sayfa (`jumping` iken), başarısız atlamanın sayfası ya da en son yüklenen sayfa
  - `goToPage` tamponun kapsadığı sayfalarda (görselsiz sayfalar dahil) istek atmaz; diğer sayfalarda tamponu temizler, `state.loading` ve `state.jumping` `true` olur
  - `feed.retry()`: başarısız atlama varsa aynı sayfaya yeniden atlar (yalnızca `errorKind === 'fetch'` iken)
  - Diğer metotlar ve olaylar (`start`, `next`, `prev`, `goTo`, `markFailed`, `continueSearching`, `dispose`, `on`, `current`, `peek`) değişmeden kalır.

- [ ] **Step 1: Başarısız testleri yaz**

`test/story-feed.test.js` içinde `makeFeed` fonksiyonunun hemen altına yardımcıları ekle:

```js
/** pages: { [sayfa]: entry dizisi }; failures: { [sayfa]: kaç kez ağ hatası }; structure: yapı hatası verecek sayfalar */
function fakeJumpSource({ count, pages = {}, failures = {}, structure = [] }) {
  let last = 1;
  const loads = [];
  const nexts = [];
  const respond = async (pageNumber) => {
    if (structure.includes(pageNumber)) throw new PageStructureError();
    if ((failures[pageNumber] ?? 0) > 0) {
      failures[pageNumber] -= 1;
      throw new Error('ağ');
    }
    last = pageNumber;
    return { page: pageNumber, count, entries: pages[pageNumber] ?? [] };
  };
  return {
    loads,
    nexts,
    hasNext: () => last < count,
    next() {
      nexts.push(last + 1);
      return respond(last + 1);
    },
    load(pageNumber) {
      loads.push(pageNumber);
      return respond(pageNumber);
    },
  };
}

function makeJumpFeed({ entries, count, pages, failures, structure }) {
  const pageSource = fakeJumpSource({ count, pages, failures, structure });
  const feed = createStoryFeed({ entries, page: 1, pageCount: count, pageSource, resolver: fakeResolver() });
  return { feed, pageSource };
}
```

Dosyanın sonuna testleri ekle:

```js
test('tampondaki sayfaya atlamak istek atmaz', async () => {
  const { feed, pageSource } = makeJumpFeed({
    entries: [entry('1', ['a', 'b'])],
    count: 3,
    pages: { 2: [entry('2', ['c', 'd'])], 3: [entry('3', ['e', 'f', 'g', 'h'])] },
  });
  feed.start();
  await flush();
  assert.deepEqual(pageSource.nexts, [2]);
  feed.goToPage(2);
  assert.equal(feed.current().ref.id, 'c');
  assert.equal(feed.state.page, 2);
  assert.deepEqual(pageSource.loads, []);
});

test('tampondaki görselsiz sayfaya atlamak istek atmaz, sonraki görsele geçer', async () => {
  const { feed, pageSource } = makeJumpFeed({
    entries: [entry('1', ['a', 'b', 'c', 'd'])],
    count: 3,
    pages: { 2: [entry('2')], 3: [entry('3', ['e'])] },
  });
  feed.start();
  feed.goTo(3);
  await flush();
  assert.deepEqual(pageSource.nexts, [2, 3]);
  feed.goToPage(2);
  assert.equal(feed.current().ref.id, 'e');
  assert.equal(feed.state.page, 3);
  assert.deepEqual(pageSource.loads, []);
});

test('tamponda olmayan sayfaya atlarken yalnızca o sayfa istenir', async () => {
  const { feed, pageSource } = makeJumpFeed({
    entries: [entry('1', ['a', 'b', 'c', 'd'])],
    count: 9,
    pages: { 6: [entry('6', ['x', 'y', 'z', 'w'])] },
  });
  feed.start();
  feed.goToPage(6);
  assert.equal(feed.current(), null);
  assert.equal(feed.state.jumping, true);
  assert.equal(feed.state.loading, true);
  assert.equal(feed.state.page, 6);
  await flush();
  assert.deepEqual(pageSource.loads, [6]);
  assert.deepEqual(pageSource.nexts, []);
  assert.equal(feed.state.jumping, false);
  assert.equal(feed.state.loading, false);
  assert.equal(feed.current().ref.id, 'x');
  assert.equal(feed.state.page, 6);
  assert.equal(feed.state.length, 4);
});

test('görselsiz hedef sayfadan sonra arama sürer ve hedef boş sayfa sayılmaz', async () => {
  const { feed, pageSource } = makeJumpFeed({ entries: [entry('1', ['a', 'b', 'c', 'd'])], count: 20 });
  feed.start();
  feed.goToPage(3);
  for (let i = 0; i < 8; i += 1) await flush();
  assert.deepEqual(pageSource.loads, [3]);
  assert.deepEqual(pageSource.nexts, [4, 5, 6, 7, 8]);
  assert.equal(feed.state.blocked, true);
});

test('atlamadan önce başlayan arka plan yüklemesinin sonucu yok sayılır', async () => {
  const { feed, pageSource } = makeJumpFeed({
    entries: [entry('1', ['a'])],
    count: 9,
    pages: { 2: [entry('2', ['b'])], 7: [entry('7', ['g', 'h', 'i', 'j'])] },
  });
  feed.start();
  assert.deepEqual(pageSource.nexts, [2]);
  feed.goToPage(7);
  await flush();
  assert.equal(feed.state.length, 4);
  assert.equal(feed.current().entry.id, '7');
  assert.equal(feed.state.page, 7);
  assert.equal(feed.state.loading, false);
});

test('art arda atlamada yalnızca sürmekte olan ve en son hedef istenir', async () => {
  const { feed, pageSource } = makeJumpFeed({
    entries: [entry('1', ['a', 'b', 'c', 'd'])],
    count: 9,
    pages: { 5: [entry('5', ['e', 'f', 'g', 'h'])] },
  });
  feed.start();
  feed.goToPage(3);
  feed.goToPage(4);
  feed.goToPage(5);
  for (let i = 0; i < 4; i += 1) await flush();
  assert.deepEqual(pageSource.loads, [3, 5]);
  assert.equal(feed.current().entry.id, '5');
  assert.equal(feed.state.page, 5);
});

test('atlama hatasında tekrar dene aynı sayfayı yeniden ister', async () => {
  const { feed, pageSource } = makeJumpFeed({
    entries: [entry('1', ['a', 'b', 'c', 'd'])],
    count: 9,
    pages: { 4: [entry('4', ['p', 'q', 'r', 's'])] },
    failures: { 4: 1 },
  });
  feed.start();
  feed.goToPage(4);
  await flush();
  assert.equal(feed.state.errorKind, 'fetch');
  assert.equal(feed.state.jumping, false);
  assert.equal(feed.state.page, 4);
  feed.retry();
  await flush();
  assert.deepEqual(pageSource.loads, [4, 4]);
  assert.equal(feed.state.errorKind, null);
  assert.equal(feed.current().entry.id, '4');
});

test('atlamada sayfa okunamazsa structure hatası verir ve tekrar dene etkisizdir', async () => {
  const { feed, pageSource } = makeJumpFeed({
    entries: [entry('1', ['a', 'b', 'c', 'd'])],
    count: 9,
    structure: [8],
  });
  feed.start();
  feed.goToPage(8);
  await flush();
  assert.equal(feed.state.errorKind, 'structure');
  feed.retry();
  await flush();
  assert.deepEqual(pageSource.loads, [8]);
});

test('sayaç sayfa içinde sayar ve yeni sayfada birden başlar', async () => {
  const { feed } = makeJumpFeed({
    entries: [entry('1', ['a', 'b']), entry('2', ['c'])],
    count: 2,
    pages: { 2: [entry('3', ['d'])] },
  });
  feed.start();
  await flush();
  const counter = () => [feed.state.pagePosition, feed.state.pageStoryCount, feed.state.page];
  assert.deepEqual(counter(), [1, 3, 1]);
  feed.next();
  assert.deepEqual(counter(), [2, 3, 1]);
  feed.next();
  assert.deepEqual(counter(), [3, 3, 1]);
  feed.next();
  assert.deepEqual(counter(), [1, 1, 2]);
  feed.next();
  assert.deepEqual([feed.state.pagePosition, feed.state.pageStoryCount, feed.state.page], [null, null, 2]);
});

test('sınır dışı sayfa numarası sayfa aralığına sıkıştırılır', async () => {
  const { feed, pageSource } = makeJumpFeed({
    entries: [entry('1', ['a', 'b', 'c', 'd'])],
    count: 5,
    pages: { 5: [entry('5', ['e'])] },
  });
  feed.start();
  feed.goToPage(99);
  await flush();
  assert.deepEqual(pageSource.loads, [5]);
  feed.goToPage(-3);
  await flush();
  assert.deepEqual(pageSource.loads, [5, 1]);
  feed.goToPage(Number.NaN);
  await flush();
  assert.deepEqual(pageSource.loads, [5, 1]);
});
```

- [ ] **Step 2: Testlerin başarısız olduğunu gör**

Run: `node --test test/story-feed.test.js`
Expected: FAIL, yeni 10 testin 9'unda `TypeError: feed.goToPage is not a function`, sayaç testinde `AssertionError` (`pagePosition` tanımsız); mevcut 16 test geçer.

- [ ] **Step 3: Story akışını yaz**

`src/core/story-feed.js` dosyasının tamamını şu içerikle değiştir. Değişenler: `firstLoadedPage`/`lastLoadedPage` (tamponun kapsadığı ardışık sayfalar), `epoch` (atlamadan önce başlamış arka plan yüklemesini yok sayar), `goToPage`, `runJump`, `retry` içindeki başarısız atlama dalı, `pageCounter`, `currentPage` ve `state` alanları. `moveTo`, `markFailed` ve diğer fonksiyonlar aynen kalır.

```js
import { EMPTY_PAGE_LIMIT, FETCH_AHEAD_THRESHOLD, RESOLVE_LOOKAHEAD } from './constants.js';
import { PageStructureError } from './entry-parser.js';

/**
 * Entry'leri story tamponuna çevirir; gezinme, önden çözümleme, ileri sayfa okuma ve sayfa atlama politikasını yürütür.
 * `index === stories.length` konumu "sonun ötesi"dir: viewer burada bitiş, yükleniyor ya da hata kartı gösterir.
 * Tampon `firstLoadedPage` ile `lastLoadedPage` arasındaki ardışık sayfaların story'lerini tutar.
 */
export function createStoryFeed({
  entries,
  page,
  pageCount,
  pageSource,
  resolver,
  lookahead = RESOLVE_LOOKAHEAD,
  fetchAheadThreshold = FETCH_AHEAD_THRESHOLD,
  emptyPageLimit = EMPTY_PAGE_LIMIT,
}) {
  const stories = [];
  const seenEntryIds = new Set();
  const resolving = new WeakSet();
  const announced = new WeakSet();
  const listeners = { change: new Set(), skipped: new Set() };
  let index = 0;
  let direction = 1;
  let knownPageCount = pageCount;
  let loading = false;
  let blocked = false;
  let emptyStreak = 0;
  let errorKind = null;
  let started = false;
  let disposed = false;
  let firstLoadedPage = page;
  let lastLoadedPage = page;
  // Her sayfa atlamasında artar; atlamadan önce başlamış arka plan yüklemesinin sonucu yok sayılır.
  let epoch = 0;
  let jumping = false;
  let jumpTarget = null;
  let jumpInFlight = false;
  let failedJump = null;

  appendEntries(entries, page);

  function emit(event, payload) {
    if (disposed) return;
    for (const listener of [...listeners[event]]) listener(payload);
  }

  function appendEntries(list, pageNumber) {
    let added = 0;
    for (const entry of list) {
      if (seenEntryIds.has(entry.id)) continue;
      seenEntryIds.add(entry.id);
      entry.images.forEach((ref, imageIndex) => {
        stories.push({
          entry,
          page: pageNumber,
          imageIndex,
          imageCount: entry.images.length,
          ref,
          resolvedUrl: null,
          status: 'pending',
        });
        added += 1;
      });
    }
    return added;
  }

  /** `start`tan `step` yönünde ilk başarısız olmayan index; geride yoksa -1, ileride yoksa >= length. */
  function playableFrom(start, step) {
    let i = start;
    while (i >= 0 && i < stories.length && stories[i].status === 'failed') i += step;
    return i;
  }

  function forwardFrom(start) {
    return Math.min(playableFrom(Math.max(start, 0), 1), stories.length);
  }

  function resolveStory(story) {
    if (story.status !== 'pending' || resolving.has(story)) return;
    resolving.add(story);
    resolver.resolve(story.ref).then(
      (url) => {
        if (disposed || story.status !== 'pending') return;
        story.resolvedUrl = url;
        story.status = 'ready';
        emit('change');
      },
      () => markFailed(story),
    );
  }

  function fetchNextPage() {
    if (loading || blocked || errorKind !== null || !pageSource.hasNext()) return;
    loading = true;
    const requestEpoch = epoch;
    pageSource.next().then(
      (result) => {
        if (disposed || requestEpoch !== epoch) return;
        loading = false;
        knownPageCount = result.count;
        lastLoadedPage = result.page;
        const added = appendEntries(result.entries, result.page);
        emptyStreak = added > 0 ? 0 : emptyStreak + 1;
        if (emptyStreak >= emptyPageLimit) blocked = true;
        ensureAhead();
        emit('change');
      },
      (error) => {
        if (disposed || requestEpoch !== epoch) return;
        loading = false;
        errorKind = error instanceof PageStructureError ? 'structure' : 'fetch';
        emit('change');
      },
    );
  }

  function ensureAhead() {
    if (disposed || !started) return;
    const end = Math.min(stories.length, index + 1 + lookahead);
    for (let i = index; i < end; i += 1) resolveStory(stories[i]);
    if (stories.length - index - 1 < fetchAheadThreshold) fetchNextPage();
  }

  function moveTo(newIndex, isNavigationMove = false) {
    const oldIdx = index;
    index = newIndex;

    // Check for crossed failed stories (only for navigation moves, not start)
    if (isNavigationMove) {
      const step = newIndex > oldIdx ? 1 : -1;
      const crossedFailed = [];
      if (step > 0) {
        for (let i = oldIdx + 1; i < newIndex; i++) {
          if (stories[i].status === 'failed') crossedFailed.push(stories[i]);
        }
      } else if (step < 0) {
        for (let i = oldIdx - 1; i > newIndex; i--) {
          if (stories[i].status === 'failed') crossedFailed.push(stories[i]);
        }
      }

      // Emit skipped for first unannnounced crossed failed story
      const unannounced = crossedFailed.find(s => !announced.has(s));
      if (unannounced) {
        for (const s of crossedFailed) announced.add(s);
        emit('skipped', unannounced);
      }
    }

    ensureAhead();
    emit('change');
  }

  function start() {
    if (started) return;
    started = true;
    moveTo(forwardFrom(0), false);
  }

  function next() {
    direction = 1;
    moveTo(forwardFrom(index + 1), true);
  }

  function prev() {
    direction = -1;
    const previous = playableFrom(index - 1, -1);
    moveTo(previous >= 0 ? previous : index, true);
  }

  function goTo(target) {
    direction = 1;
    moveTo(forwardFrom(Math.min(target, stories.length)), true);
  }

  /** Sayfa tampondaysa istek atmadan oraya geçer; değilse tamponu o sayfadan yeniden kurar. */
  function goToPage(requested) {
    if (disposed || !Number.isFinite(requested)) return;
    const target = Math.min(Math.max(1, Math.trunc(requested)), Math.max(1, knownPageCount));
    if (target >= firstLoadedPage && target <= lastLoadedPage) {
      // Sayfa görselsizse sonraki sayfaların ilk story'sine geçilir.
      const first = stories.findIndex((story) => story.page >= target);
      direction = 1;
      moveTo(forwardFrom(first === -1 ? stories.length : first), false);
      return;
    }
    epoch += 1;
    jumping = true;
    jumpTarget = target;
    loading = true;
    blocked = false;
    errorKind = null;
    emptyStreak = 0;
    failedJump = null;
    stories.length = 0;
    seenEntryIds.clear();
    index = 0;
    firstLoadedPage = target;
    lastLoadedPage = target - 1;
    emit('change');
    if (!jumpInFlight) runJump();
  }

  /** Aynı anda tek atlama isteği; beklerken başka sayfa seçildiyse biten istekten sonra en son seçilen yüklenir. */
  function runJump() {
    const target = jumpTarget;
    jumpInFlight = true;
    const settle = (apply) => (value) => {
      jumpInFlight = false;
      if (disposed) return;
      if (target !== jumpTarget) {
        runJump();
        return;
      }
      jumping = false;
      loading = false;
      apply(value);
      emit('change');
    };
    pageSource.load(target).then(
      settle((result) => {
        knownPageCount = result.count;
        lastLoadedPage = result.page;
        appendEntries(result.entries, result.page);
        index = forwardFrom(0);
        ensureAhead();
      }),
      settle((error) => {
        errorKind = error instanceof PageStructureError ? 'structure' : 'fetch';
        failedJump = target;
      }),
    );
  }

  function markFailed(story) {
    if (disposed || story.status === 'failed') return;
    story.status = 'failed';
    story.resolvedUrl = null;
    if (stories[index] === story) {
      const oldIdx = index;
      const behind = direction < 0 ? playableFrom(index - 1, -1) : -1;
      index = behind >= 0 ? behind : forwardFrom(index + 1);

      // Collect crossed failed stories (including the active story itself)
      const step = index > oldIdx ? 1 : -1;
      const crossedFailed = [story];
      if (step > 0) {
        for (let i = oldIdx + 1; i < index; i++) {
          if (stories[i].status === 'failed') crossedFailed.push(stories[i]);
        }
      } else if (step < 0) {
        for (let i = oldIdx - 1; i > index; i--) {
          if (stories[i].status === 'failed') crossedFailed.push(stories[i]);
        }
      }

      // Mark all crossed failed as announced
      for (const s of crossedFailed) announced.add(s);

      emit('skipped', story);
    }
    ensureAhead();
    emit('change');
  }

  function continueSearching() {
    if (!blocked) return;
    blocked = false;
    emptyStreak = 0;
    ensureAhead();
    emit('change');
  }

  function retry() {
    if (errorKind !== 'fetch') return;
    if (failedJump !== null) {
      goToPage(failedJump);
      return;
    }
    errorKind = null;
    ensureAhead();
    emit('change');
  }

  function dispose() {
    disposed = true;
    listeners.change.clear();
    listeners.skipped.clear();
  }

  function on(event, listener) {
    listeners[event].add(listener);
    return () => listeners[event].delete(listener);
  }

  /** Aktif story'nin kendi sayfasındaki sırası ve o sayfanın tampondaki story sayısı. */
  function pageCounter(story) {
    if (!story) return { pagePosition: null, pageStoryCount: null };
    let pagePosition = 0;
    let pageStoryCount = 0;
    stories.forEach((other, i) => {
      if (other.page !== story.page) return;
      pageStoryCount += 1;
      if (i <= index) pagePosition += 1;
    });
    return { pagePosition, pageStoryCount };
  }

  function currentPage(story) {
    if (story) return story.page;
    if (jumping) return jumpTarget;
    return failedJump ?? lastLoadedPage;
  }

  return {
    start,
    next,
    prev,
    goTo,
    goToPage,
    markFailed,
    continueSearching,
    retry,
    dispose,
    on,
    current: () => stories[index] ?? null,
    peek: (offset = 1) => stories[index + offset] ?? null,
    get state() {
      const story = stories[index] ?? null;
      return {
        index,
        length: stories.length,
        page: currentPage(story),
        ...pageCounter(story),
        pageCount: knownPageCount,
        loading,
        jumping,
        blocked,
        errorKind,
        ended: index >= stories.length && !loading && !blocked && errorKind === null && !pageSource.hasNext(),
      };
    },
  };
}
```

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `node --test test/story-feed.test.js`
Expected: `ℹ fail 0` (mevcut 16 test ve yeni 10 test)

Run: `npm test`
Expected: `ℹ fail 0`

- [ ] **Step 5: Commit**

```bash
git add src/core/story-feed.js test/story-feed.test.js
git commit -m "feat: story akışına sayfa atlama ve sayfa içi sayaç ekle

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Story ekranında avatar - isim, sayaç ve sayfa göstergesi

> Uygulama notu (kullanıcı isteği, 17.09.2026): üst bardaki yazılar ortak taban çizgisine oturur, avatar `vertical-align: middle` ile yazının içinde ortalanır; son CSS `src/viewer/viewer.css`'tedir.

**Files:**
- Modify: `test/main.smoke.test.js`
- Modify: `src/viewer/viewer.js` (tamamı aşağıdaki içerikle değişir)
- Modify: `src/viewer/viewer.css` (tamamı aşağıdaki içerikle değişir)

**Interfaces:**
- Consumes:
  - Görev 1: `Entry.avatarUrl`, `DEFAULT_AVATAR_URL`
  - Görev 3: `feed.goToPage(page)`, `feed.state.page`, `pagePosition`, `pageStoryCount`, `pageCount`, `jumping`
- Produces (story ekranı DOM'u, gölge kök içinde):
  - `a.es-author` > `img.es-avatar` + `span.es-author-name`
  - `span.es-counter` (`k/n`), eski `span.es-page` kalkar
  - `div.es-pager` > `button.es-pager-prev` + `select.es-pager-select` + `span.es-pager-sep` + `button.es-pager-last` + `button.es-pager-next`; tek sayfalı başlıkta `hidden`
  - `.es-root.has-pager` sınıfı ve CSS değişkeni `--es-strip`
  - Test yardımcısı `setup(entries, { count, pages })` ve `pageEntries(page)` (Görev 5 kullanır)

- [ ] **Step 1: Başarısız testleri yaz**

`test/main.smoke.test.js` içinde:

```js
function setup(entries) {
  const dom = new JSDOM(topicPageHtml({ entries }), { url: PAGE_URL });
```

→

```js
/** Sayfa başına dört görsel: açılışta ve sayfa atlamada önden sayfa istenmez. */
const pageEntries = (page) => [1, 2, 3, 4].map((n) => ({
  id: `${page}0${n}`,
  author: `sayfa ${page} yazarı`,
  content: link(`https://soz.lk/i/p${page}n${n}`),
}));

function setup(entries, { count = 1, pages = {} } = {}) {
  const dom = new JSDOM(topicPageHtml({ count, entries }), { url: PAGE_URL });
```

```js
      return { ok: true, status: 200, text: async () => imagePageHtml({ ogImage: `https://cdn.eksisozluk.com/${id}.jpg` }) };
    }
    return { ok: false, status: 404, text: async () => '' };
```

→

```js
      return { ok: true, status: 200, text: async () => imagePageHtml({ ogImage: `https://cdn.eksisozluk.com/${id}.jpg` }) };
    }
    const page = Number(new URL(url).searchParams.get('p'));
    if (url.startsWith(`${PAGE_URL}?`) && pages[page]) {
      return { ok: true, status: 200, text: async () => topicPageHtml({ current: page, count, entries: pages[page] }) };
    }
    return { ok: false, status: 404, text: async () => '' };
```

```js
  assert.equal(shadow.querySelector('.es-author').textContent, 'ilk yazar');
```

→

```js
  assert.equal(shadow.querySelector('.es-author-name').textContent, 'ilk yazar');
  assert.equal(shadow.querySelector('.es-avatar').getAttribute('src'), 'https://img.ekstat.com/profiles/deneme-1.jpg');
```

```js
  assert.equal(shadow.querySelector('.es-page').textContent, 'sayfa 1/1');
```

→

```js
  assert.equal(shadow.querySelector('.es-counter').textContent, '1/1');
  assert.equal(shadow.querySelector('.es-pager').hidden, true, 'tek sayfalı başlıkta sayfa kutusu yok');
  assert.equal(shadow.querySelector('.es-root').classList.contains('has-pager'), false);
```

Dosyanın sonuna ekle:

```js
test('çok sayfalı başlıkta sayfa kutusu görünür, » sonraki sayfayı açar', async () => {
  const { doc, requests, fetchImpl } = setup(pageEntries(1), { count: 3, pages: { 2: pageEntries(2) } });
  await main({ cssUrl: CSS_URL, doc, fetchImpl });
  doc.querySelector('.eksi-stories-button').click();
  await flush();
  await flush();

  const shadow = doc.querySelector('eksi-stories-viewer').shadowRoot;
  const pageRequests = () => requests.filter((url) => url.startsWith(`${PAGE_URL}?`));
  assert.equal(shadow.querySelector('.es-pager').hidden, false);
  assert.equal(shadow.querySelector('.es-root').classList.contains('has-pager'), true);
  assert.deepEqual([...shadow.querySelectorAll('.es-pager-select option')].map((option) => option.textContent), ['1', '2', '3']);
  assert.equal(shadow.querySelector('.es-pager-select').value, '1');
  assert.equal(shadow.querySelector('.es-pager-last').textContent, '3');
  assert.equal(shadow.querySelector('.es-pager-prev').hidden, true);
  assert.equal(shadow.querySelector('.es-pager-next').hidden, false);
  assert.equal(shadow.querySelector('.es-counter').textContent, '1/4');
  assert.deepEqual(pageRequests(), [], 'açılışta sayfa istenmez');

  shadow.querySelector('.es-pager-next').click();
  assert.equal(shadow.querySelector('.es-card-text').textContent, 'sayfa yükleniyor…');
  for (let i = 0; i < 4; i += 1) await flush();

  assert.deepEqual(pageRequests(), [`${PAGE_URL}?p=2`]);
  assert.equal(shadow.querySelector('.es-author-name').textContent, 'sayfa 2 yazarı');
  assert.equal(shadow.querySelector('.es-pager-select').value, '2');
  assert.equal(shadow.querySelector('.es-pager-prev').hidden, false);
  assert.equal(shadow.querySelector('.es-counter').textContent, '1/4');
});
```

- [ ] **Step 2: Testlerin başarısız olduğunu gör**

Run: `node --test test/main.smoke.test.js`
Expected: FAIL, 2 test: `butona tıklayınca viewer açılır…` (`TypeError: Cannot read properties of null (reading 'textContent')`) ve `çok sayfalı başlıkta sayfa kutusu görünür…` (`TypeError: Cannot read properties of null (reading 'hidden')`); diğer 3 test geçer.

- [ ] **Step 3: Görüntüleyiciyi yaz**

`src/viewer/viewer.js` dosyasının tamamını şu içerikle değiştir. Değişenler:
- yazar linkinin içi avatar ve isim
- `.es-page` yerine `.es-counter`
- `.es-stage`'in kardeşi olarak `.es-pager`; dokunma ve basılı tutma olayları ona ulaşmaz
- `renderPager`: seçenekler yalnızca sayfa sayısı değişince kurulur, `select.value` yalnızca sayfa değişince yazılır
- `changePage`: sayfa değişince odak `.es-root`'a döner, ← → ve boşluk hemen çalışır
- klavye kısayolları olay yolunda `select` varken çalışmaz (Esc hariç)
- avatar hatasında bir kez `DEFAULT_AVATAR_URL`, o da yüklenmezse avatar gizlenir
- atlama kartı `sayfa yükleniyor…`

```js
import {
  DEFAULT_AVATAR_URL,
  EMPTY_PAGE_LIMIT,
  HOLD_THRESHOLD_MS,
  LEFT_TAP_RATIO,
  STORY_DURATION_MS,
  TOAST_MS,
} from '../core/constants.js';

const INTERACTIVE_SELECTOR = 'a, button, .es-caption, .es-card';

/**
 * Tam ekran story görüntüleyicisini açar. Durum feed'dedir; viewer yalnızca çizer ve girdi toplar.
 * @param {{ feed: object, topic: { title: string }, cssText: string, onClose?: (lastEntryId: string | null) => void, doc?: Document }} options
 * @returns {{ close: () => void }}
 */
export function openViewer({ feed, topic, cssText, onClose, doc = document }) {
  const win = doc.defaultView;
  const el = (tag, attrs = {}, children = []) => {
    const node = doc.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'text') node.textContent = value;
      else node.setAttribute(key, value);
    }
    node.append(...children);
    return node;
  };

  // --- DOM ---
  const progress = el('div', { class: 'es-progress' });
  const avatar = el('img', { class: 'es-avatar', alt: '', draggable: 'false' });
  const authorName = el('span', { class: 'es-author-name' });
  const author = el('a', { class: 'es-author', target: '_blank', rel: 'noopener' }, [avatar, authorName]);
  const date = el('span', { class: 'es-date' });
  const permalink = el('a', { class: 'es-permalink', target: '_blank', rel: 'noopener', text: "entry'ye git" });
  const counter = el('span', { class: 'es-counter' });
  const pausedBadge = el('span', { class: 'es-paused', title: 'durdu', text: '❚❚' });
  const closeButton = el('button', { class: 'es-close', type: 'button', 'aria-label': 'kapat', text: '✕' });
  const top = el('div', { class: 'es-top' }, [
    progress,
    el('div', { class: 'es-meta' }, [
      el('div', { class: 'es-info' }, [author, date, permalink]),
      el('div', { class: 'es-controls' }, [counter, pausedBadge, closeButton]),
    ]),
  ]);
  const image = el('img', { class: 'es-image', alt: '', draggable: 'false' });
  const caption = el('div', { class: 'es-caption' });
  const frame = el('div', { class: 'es-frame' }, [image, top, caption]);
  const spinner = el('div', { class: 'es-spinner', role: 'progressbar', 'aria-label': 'yükleniyor' });
  const cardSpinner = el('div', { class: 'es-spinner', 'aria-hidden': 'true' });
  const cardText = el('p', { class: 'es-card-text' });
  const cardActions = el('div', { class: 'es-card-actions' });
  const card = el('div', { class: 'es-card' }, [cardSpinner, cardText, cardActions]);
  const stage = el('div', { class: 'es-stage' }, [frame, spinner, card]);
  const backdrop = el('img', { class: 'es-backdrop', alt: '', 'aria-hidden': 'true' });
  const pagerPrev = el('button', { class: 'es-pager-prev', type: 'button', title: 'önceki sayfa', text: '«' });
  const pagerSelect = el('select', { class: 'es-pager-select', 'aria-label': 'sayfa' });
  const pagerLast = el('button', { class: 'es-pager-last', type: 'button', title: 'son sayfa' });
  const pagerNext = el('button', { class: 'es-pager-next', type: 'button', title: 'sonraki sayfa', text: '»' });
  const pager = el('div', { class: 'es-pager' }, [
    pagerPrev,
    pagerSelect,
    el('span', { class: 'es-pager-sep', text: '/' }),
    pagerLast,
    pagerNext,
  ]);
  const toast = el('div', { class: 'es-toast', role: 'status' });
  const root = el('div', {
    class: 'es-root',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': `story: ${topic.title}`,
    tabindex: '-1',
  }, [backdrop, stage, pager, toast]);
  root.style.setProperty('--es-duration', `${STORY_DURATION_MS}ms`);
  for (const node of [pausedBadge, spinner, card, pager, toast]) node.hidden = true;

  const host = doc.createElement('eksi-stories-viewer');
  host.attachShadow({ mode: 'open' }).append(el('style', { text: cssText }), root);
  const preloader = doc.createElement('img');

  // --- durum ---
  const pauseReasons = new Set();
  let shownKey = null;
  let loadingUrl = null;
  let imageLoaded = false;
  let lastEntryId = null;
  let expanded = false;
  let cardKey = null;
  let pressTimer = null;
  let held = false;
  let toastTimer = null;
  let closed = false;
  let pagerCount = null;

  const storyKey = (story) => `${story.entry.id}:${story.imageIndex}`;
  const referrerPolicyFor = (story) => (story.ref.kind === 'direct' ? 'no-referrer' : '');
  const isOnControl = (event, selector) =>
    event.composedPath().some((node) => node.nodeType === 1 && node.matches(selector));

  function setPaused(reason, paused) {
    if (paused) pauseReasons.add(reason);
    else pauseReasons.delete(reason);
    const isPaused = pauseReasons.size > 0;
    root.classList.toggle('is-paused', isPaused);
    pausedBadge.hidden = !isPaused;
  }

  function setExpanded(value) {
    expanded = value;
    caption.classList.toggle('is-expanded', value);
    setPaused('caption', value);
  }

  function renderProgress(story, running) {
    const segments = [];
    for (let i = 0; i < story.imageCount; i += 1) {
      const segment = el('div', { class: 'es-seg' }, [el('div', { class: 'es-seg-fill' })]);
      if (i < story.imageIndex) segment.classList.add('is-done');
      if (i === story.imageIndex && running) segment.classList.add('is-active');
      segments.push(segment);
    }
    progress.replaceChildren(...segments);
  }

  function showStory(story, key) {
    shownKey = key;
    loadingUrl = null;
    imageLoaded = false;
    lastEntryId = story.entry.id;
    image.removeAttribute('src');
    frame.classList.add('is-loading');
    avatar.hidden = false;
    avatar.src = story.entry.avatarUrl ?? DEFAULT_AVATAR_URL;
    authorName.textContent = story.entry.author;
    author.href = story.entry.authorUrl;
    date.textContent = story.entry.date;
    permalink.href = story.entry.permalink;
    caption.textContent = story.entry.text;
    caption.hidden = story.entry.text === '';
    setExpanded(false);
    renderProgress(story, false);
  }

  function preloadNext() {
    const upcoming = feed.peek(1);
    if (upcoming?.status !== 'ready') return;
    preloader.referrerPolicy = referrerPolicyFor(upcoming);
    preloader.src = upcoming.resolvedUrl;
  }

  function loadImage(story, key) {
    const url = story.resolvedUrl;
    loadingUrl = url;
    image.referrerPolicy = referrerPolicyFor(story);
    image.onload = () => {
      if (closed || shownKey !== key || loadingUrl !== url) return;
      imageLoaded = true;
      frame.classList.remove('is-loading');
      spinner.hidden = true;
      backdrop.referrerPolicy = referrerPolicyFor(story);
      backdrop.src = url;
      renderProgress(story, true);
      preloadNext();
    };
    image.onerror = () => {
      if (closed || shownKey !== key || loadingUrl !== url) return;
      feed.markFailed(story);
    };
    image.src = url;
  }

  function actionButton(label, onClick) {
    const button = el('button', { type: 'button', text: label });
    button.addEventListener('click', onClick);
    return button;
  }

  function renderCard(state) {
    shownKey = null;
    frame.hidden = true;
    spinner.hidden = true;
    card.hidden = false;
    cardSpinner.hidden = !state.loading;
    backdrop.removeAttribute('src');

    let text;
    const actions = [];
    if (state.loading) {
      text = state.jumping ? 'sayfa yükleniyor…' : 'sonraki sayfa yükleniyor…';
    } else if (state.blocked) {
      text = `${EMPTY_PAGE_LIMIT} sayfadır görsel yok`;
      actions.push(actionButton('aramaya devam', () => feed.continueSearching()));
    } else if (state.errorKind === 'fetch') {
      text = 'sayfa gelmedi';
      actions.push(actionButton('tekrar dene', () => feed.retry()));
    } else if (state.errorKind === 'structure') {
      text = 'sayfa okunamadı';
    } else if (state.length === 0) {
      text = 'görsel yok';
    } else {
      text = 'başlıkta başka görsel yok';
      actions.push(actionButton('başa dön', () => feed.goTo(0)));
    }
    if (cardKey === text) return;
    cardKey = text;
    actions.push(actionButton('kapat', close));
    cardText.textContent = text;
    cardActions.replaceChildren(...actions);
  }

  /** Ekşi'nin sayfa göstergesi: « [seçim] / son » — tek sayfalı başlıkta gizli. */
  function renderPager(state) {
    const visible = state.pageCount > 1;
    pager.hidden = !visible;
    root.classList.toggle('has-pager', visible);
    if (!visible) return;
    if (pagerCount !== state.pageCount) {
      pagerCount = state.pageCount;
      const options = doc.createDocumentFragment();
      for (let n = 1; n <= pagerCount; n += 1) options.append(el('option', { value: String(n), text: String(n) }));
      pagerSelect.replaceChildren(options);
      pagerLast.textContent = String(pagerCount);
    }
    // Açık seçim listesini gereksiz yere sıfırlamamak için yalnızca sayfa değişince yazılır.
    if (pagerSelect.value !== String(state.page)) pagerSelect.value = String(state.page);
    pagerPrev.hidden = state.page <= 1;
    pagerNext.hidden = state.page >= state.pageCount;
  }

  function render() {
    if (closed) return;
    const story = feed.current();
    const state = feed.state;
    renderPager(state);
    if (!story) {
      renderCard(state);
      return;
    }
    cardKey = null;
    card.hidden = true;
    frame.hidden = false;
    const key = storyKey(story);
    if (key !== shownKey) showStory(story, key);
    if (story.status === 'ready' && loadingUrl !== story.resolvedUrl) loadImage(story, key);
    spinner.hidden = imageLoaded;
    counter.textContent = `${state.pagePosition}/${state.pageStoryCount}`;
    if (imageLoaded) preloadNext();
  }

  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    win.clearTimeout(toastTimer);
    toastTimer = win.setTimeout(() => {
      toast.hidden = true;
    }, TOAST_MS);
  }

  // --- girdiler ---
  function onPointerDown(event) {
    if (event.button !== 0 || isOnControl(event, INTERACTIVE_SELECTOR)) return;
    stage.setPointerCapture?.(event.pointerId);
    held = false;
    win.clearTimeout(pressTimer);
    pressTimer = win.setTimeout(() => {
      held = true;
      setPaused('hold', true);
    }, HOLD_THRESHOLD_MS);
  }

  function onPointerUp(event) {
    if (pressTimer === null) return;
    win.clearTimeout(pressTimer);
    pressTimer = null;
    if (held) {
      held = false;
      setPaused('hold', false);
      return;
    }
    if (event.clientX / Math.max(1, stage.clientWidth) < LEFT_TAP_RATIO) feed.prev();
    else feed.next();
  }

  function onPointerCancel() {
    win.clearTimeout(pressTimer);
    pressTimer = null;
    if (held) {
      held = false;
      setPaused('hold', false);
    }
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') close();
    else if (isOnControl(event, 'select')) return;
    else if (event.key === 'ArrowRight') {
      if (!event.repeat) feed.next();
    } else if (event.key === 'ArrowLeft') {
      if (!event.repeat) feed.prev();
    } else if (event.key === ' ' && !isOnControl(event, 'a, button')) {
      if (!event.repeat) setPaused('user', !pauseReasons.has('user'));
    } else return;
    event.preventDefault();
    event.stopPropagation();
  }

  const onVisibilityChange = () => setPaused('hidden', doc.hidden);

  /** Sayfa değişince odak story ekranına döner; ← → ve boşluk hemen çalışır. */
  function changePage(pageNumber) {
    feed.goToPage(pageNumber);
    root.focus({ preventScroll: true });
  }

  function close() {
    if (closed) return;
    closed = true;
    offChange();
    offSkipped();
    win.removeEventListener('keydown', onKeyDown, true);
    doc.removeEventListener('visibilitychange', onVisibilityChange);
    win.clearTimeout(pressTimer);
    win.clearTimeout(toastTimer);
    image.onload = null;
    image.onerror = null;
    host.remove();
    doc.documentElement.style.overflow = previousOverflow;
    onClose?.(lastEntryId);
  }

  stage.addEventListener('pointerdown', onPointerDown);
  stage.addEventListener('pointerup', onPointerUp);
  stage.addEventListener('pointercancel', onPointerCancel);
  caption.addEventListener('click', () => setExpanded(!expanded));
  avatar.addEventListener('error', () => {
    if (avatar.src !== DEFAULT_AVATAR_URL) avatar.src = DEFAULT_AVATAR_URL;
    else avatar.hidden = true;
  });
  pagerSelect.addEventListener('change', () => changePage(Number(pagerSelect.value)));
  pagerPrev.addEventListener('click', () => changePage(feed.state.page - 1));
  pagerNext.addEventListener('click', () => changePage(feed.state.page + 1));
  pagerLast.addEventListener('click', () => changePage(feed.state.pageCount));
  closeButton.addEventListener('click', close);
  progress.addEventListener('animationend', (event) => {
    if (event.animationName === 'es-fill') feed.next();
  });
  win.addEventListener('keydown', onKeyDown, true);
  doc.addEventListener('visibilitychange', onVisibilityChange);
  const offChange = feed.on('change', render);
  const offSkipped = feed.on('skipped', () => showToast('görsel açılmadı, geçildi'));

  const previousOverflow = doc.documentElement.style.overflow;
  doc.documentElement.style.overflow = 'hidden';
  doc.body.append(host);
  root.focus({ preventScroll: true });
  render();

  return { close };
}
```

- [ ] **Step 4: Stilleri yaz**

`src/viewer/viewer.css` dosyasının tamamını şu içerikle değiştir. Değişenler:
- `--es-strip` (0px; `.has-pager` ile 51px)
- `.es-stage`, `.es-frame.is-loading` ve `.es-image` şeridin altına sığar
- `.es-info` `align-items: center`
- `.es-author`, `.es-avatar`, `.es-author-name`
- `.es-page` → `.es-counter`
- dosyanın sonuna yakın `.es-pager` blokları (ekşi ölçümü)

```css
:host {
  all: initial;
}

[hidden] {
  display: none !important;
}

.es-root {
  --es-strip: 0px;
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  overflow: hidden;
  background: #000;
  color: #fff;
  font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  outline: none;
  user-select: none;
  -webkit-user-select: none;
}

.es-root.has-pager {
  --es-strip: 51px;
}

.es-backdrop {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(40px) brightness(0.4);
  transform: scale(1.15);
  pointer-events: none;
}

.es-backdrop:not([src]) {
  display: none;
}

.es-stage {
  position: absolute;
  inset: var(--es-strip) 0 0;
  display: grid;
  place-items: center;
  touch-action: none;
}

.es-stage > * {
  grid-area: 1 / 1;
}

.es-frame {
  position: relative;
}

.es-frame.is-loading {
  width: min(100vw, calc((100vh - var(--es-strip)) * 9 / 16));
  height: calc(100vh - var(--es-strip));
}

.es-image {
  display: block;
  max-width: 100vw;
  max-height: calc(100vh - var(--es-strip));
  -webkit-user-drag: none;
}

.es-frame.is-loading .es-image {
  display: none;
}

.es-top,
.es-caption {
  position: absolute;
  right: 0;
  left: 0;
  box-sizing: border-box;
}

.es-top {
  top: 0;
  padding: 10px 12px 28px;
  background: linear-gradient(rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0));
}

.es-progress {
  display: flex;
  gap: 4px;
}

.es-seg {
  flex: 1;
  height: 3px;
  overflow: hidden;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.35);
}

.es-seg-fill {
  width: 100%;
  height: 100%;
  background: #fff;
  transform: scaleX(0);
  transform-origin: left center;
}

.es-seg.is-done .es-seg-fill {
  transform: scaleX(1);
}

.es-seg.is-active .es-seg-fill {
  animation: es-fill var(--es-duration, 5000ms) linear forwards;
}

.es-root.is-paused .es-seg.is-active .es-seg-fill {
  animation-play-state: paused;
}

@keyframes es-fill {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}

.es-meta {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 10px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}

.es-info {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  align-content: center;
  align-items: center;
  gap: 2px 10px;
  min-width: 0;
  min-height: 32px;
}

.es-info > * {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.es-controls {
  display: flex;
  flex: none;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
}

.es-meta a {
  color: inherit;
  text-decoration: none;
}

.es-meta a:hover,
.es-meta a:focus-visible {
  text-decoration: underline;
}

.es-author {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-weight: 600;
}

.es-avatar {
  width: 24px;
  height: 24px;
  flex: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  object-fit: cover;
}

.es-author-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.es-date,
.es-counter,
.es-permalink {
  font-size: 12px;
}

.es-date,
.es-counter {
  opacity: 0.75;
}

.es-paused {
  font-size: 11px;
  letter-spacing: 1px;
}

.es-close {
  width: 32px;
  height: 32px;
  flex: none;
  border: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
  font: inherit;
  font-size: 16px;
  line-height: 32px;
  cursor: pointer;
}

.es-close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.es-caption {
  bottom: 0;
  display: -webkit-box;
  max-height: 60vh;
  padding: 32px 16px 0;
  border-bottom: 14px solid transparent;
  overflow: hidden;
  background: linear-gradient(rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.7) 40%);
  background-origin: border-box;
  white-space: pre-line;
  cursor: pointer;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.es-caption.is-expanded {
  display: block;
  overflow-y: auto;
  -webkit-line-clamp: unset;
}

.es-spinner {
  width: 36px;
  height: 36px;
  box-sizing: border-box;
  border: 3px solid rgba(255, 255, 255, 0.25);
  border-top-color: #fff;
  border-radius: 50%;
  animation: es-spin 800ms linear infinite;
  pointer-events: none;
}

@keyframes es-spin {
  to {
    transform: rotate(360deg);
  }
}

.es-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  max-width: min(90vw, 420px);
  padding: 24px;
  text-align: center;
}

.es-card-text {
  margin: 0;
  font-size: 16px;
}

.es-card-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.es-card button {
  padding: 8px 16px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 999px;
  background: transparent;
  color: #fff;
  font: inherit;
  cursor: pointer;
}

.es-card button:first-child {
  border-color: #fff;
  background: #fff;
  color: #000;
}

.es-card button:focus-visible,
.es-close:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

/* ekşi sözlük koyu tema sayfa göstergesi, ölçüm 16.09.2026 */
.es-pager {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  color: rgb(102, 102, 102);
  font-family: "Source Sans Pro", sans-serif;
  font-size: 14px;
  line-height: 22.652px;
  white-space: nowrap;
}

.es-pager-select {
  box-sizing: border-box;
  height: 26px;
  margin: 0 5px;
  padding: 2px;
  border: 1px solid rgb(73, 73, 73);
  border-radius: 4px;
  background-color: rgb(71, 71, 71);
  color: rgb(255, 255, 255);
  font: inherit;
  font-size: 14px;
  appearance: auto;
  color-scheme: normal;
}

.es-pager-prev,
.es-pager-last,
.es-pager-next {
  box-sizing: border-box;
  height: 26.6484px;
  margin: 0 0 0 5px;
  padding: 1px 8px;
  border: 1px solid rgb(73, 73, 73);
  border-radius: 4px;
  background-color: transparent;
  color: rgb(189, 189, 189);
  font: inherit;
  font-size: 14px;
  line-height: 22.652px;
  cursor: pointer;
}

.es-pager-prev:hover,
.es-pager-last:hover,
.es-pager-next:hover {
  background-color: rgb(31, 31, 31);
}

.es-pager button:focus-visible,
.es-pager-select:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

.es-toast {
  position: absolute;
  bottom: 24px;
  left: 50%;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.75);
  font-size: 13px;
  transform: translateX(-50%);
  pointer-events: none;
}
```

- [ ] **Step 5: Testlerin geçtiğini gör**

Run: `node --test test/main.smoke.test.js`
Expected: `ℹ fail 0` (5 test)

Run: `npm test`
Expected: `ℹ fail 0`

- [ ] **Step 6: Commit**

```bash
git add test/main.smoke.test.js src/viewer/viewer.js src/viewer/viewer.css
git commit -m "feat: story ekranına avatar, sayfa içi sayaç ve ekşi sayfa kutusu ekle

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Kapatınca son bakılan entry'ye git

**Files:**
- Modify: `test/main.smoke.test.js`
- Modify: `src/content/main.js`

**Interfaces:**
- Consumes: Görev 4'ün `setup(entries, { count, pages })`, `pageEntries(page)` test yardımcıları ve `.es-pager-next` butonu; görüntüleyicinin `onClose(lastEntryId)` çağrısı
- Produces: `main({ cssUrl, doc, fetchImpl, navigate })`; `navigate` varsayılanı `(url) => doc.defaultView.location.assign(url)`

- [ ] **Step 1: Testleri yaz**

`test/main.smoke.test.js` sonuna ekle:

```js
test('başka sayfadayken kapatınca son bakılan entry focusto adresiyle açılır', async () => {
  const { dom, doc, fetchImpl } = setup(pageEntries(1), { count: 3, pages: { 2: pageEntries(2) } });
  const navigations = [];
  await main({ cssUrl: CSS_URL, doc, fetchImpl, navigate: (url) => navigations.push(url) });
  doc.querySelector('.eksi-stories-button').click();
  await flush();
  await flush();
  doc.querySelector('eksi-stories-viewer').shadowRoot.querySelector('.es-pager-next').click();
  for (let i = 0; i < 4; i += 1) await flush();

  dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(doc.querySelector('eksi-stories-viewer'), null);
  assert.deepEqual(navigations, [`${PAGE_URL}?focusto=201`]);
});

test("açılış sayfasındaki entry'de kapatınca başka adrese gidilmez", async () => {
  const { dom, doc, fetchImpl } = setup(pageEntries(1), { count: 3 });
  const navigations = [];
  await main({ cssUrl: CSS_URL, doc, fetchImpl, navigate: (url) => navigations.push(url) });
  doc.querySelector('.eksi-stories-button').click();
  await flush();
  await flush();

  dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.deepEqual(navigations, []);
  assert.equal(doc.activeElement, doc.querySelector('.eksi-stories-button'));
});
```

- [ ] **Step 2: Testlerin sonucunu gör**

Run: `node --test test/main.smoke.test.js`
Expected: FAIL, yalnızca `başka sayfadayken kapatınca…` testi (`AssertionError`: `navigations` boş). İkinci test bugünkü davranışı korur ve şimdiden geçer.

- [ ] **Step 3: Kapatma kararını yaz**

`src/content/main.js` içinde:

```js
 * @param {{ cssUrl: string, doc?: Document, fetchImpl?: (url: string, init?: object) => Promise<Response> }} options
 */
export async function main({ cssUrl, doc = document, fetchImpl = (url, init) => globalThis.fetch(url, init) }) {
```

→

```js
 * @param {{ cssUrl: string, doc?: Document, fetchImpl?: (url: string, init?: object) => Promise<Response>, navigate?: (url: string) => void }} options
 */
export async function main({
  cssUrl,
  doc = document,
  fetchImpl = (url, init) => globalThis.fetch(url, init),
  navigate = (url) => doc.defaultView.location.assign(url),
}) {
```

```js
        onClose: (lastEntryId) => {
          open = false;
          scrollToEntry(doc, lastEntryId);
          button.focus({ preventScroll: true });
        },
```

→

```js
        onClose: (lastEntryId) => {
          open = false;
          if (lastEntryId && !scrollToEntry(doc, lastEntryId)) {
            // Entry başka sayfada: ekşi o entry'nin sayfasını açıp ona kaydırır.
            navigate(`${doc.location.origin}${doc.location.pathname}?focusto=${encodeURIComponent(lastEntryId)}`);
            return;
          }
          button.focus({ preventScroll: true });
        },
```

```js
function scrollToEntry(doc, entryId) {
  if (!entryId) return;
  const items = doc.querySelectorAll('#entry-item-list > li[data-id]');
  const item = Array.from(items).find((li) => li.getAttribute('data-id') === entryId);
  item?.scrollIntoView?.({ block: 'center' });
}
```

→

```js
/** Entry açık sayfadaysa ona kaydırır ve true döner. */
function scrollToEntry(doc, entryId) {
  const items = doc.querySelectorAll('#entry-item-list > li[data-id]');
  const item = Array.from(items).find((li) => li.getAttribute('data-id') === entryId);
  if (!item) return false;
  item.scrollIntoView?.({ block: 'center' });
  return true;
}
```

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `node --test test/main.smoke.test.js`
Expected: `ℹ fail 0` (7 test)

Run: `npm test`
Expected: `ℹ fail 0` (toplam 76 test)

- [ ] **Step 5: Commit**

```bash
git add test/main.smoke.test.js src/content/main.js
git commit -m "feat: kapatınca son bakılan entry başka sayfadaysa focusto ile aç

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Playground ve Store ekran görüntüleri

**Files:**
- Modify: `dev/playground.js`
- Modify: `store/screenshots/01-dikey.png`, `02-panorama.png`, `03-coklu-gorsel.png` (yeniden çekilir)

**Interfaces:**
- Consumes: Görev 3'ün `pageSource.load` beklentisi, Görev 4'ün story ekranı DOM'u (`.es-pager`, `.es-counter`, `.es-avatar`)
- Produces: playground senaryo 0 üç sayfalı (sayfa başına iki şekil); her entry'de üretilmiş avatar; güncel Store ekran görüntüleri

- [ ] **Step 1: Playground'u güncelle**

`dev/playground.js` içinde:

```js
let entrySeq = 1;
function makeEntry(imageUrls, text = '') {
  const id = String(entrySeq++);
  return {
    id,
    author: `deneme yazar ${id}`,
    authorUrl: `https://eksisozluk.com/biri/deneme-yazar-${id}`,
```

→

```js
/** Tek harfli, renkli, yuvarlak avatar; ekşi'ye istek atılmaz. */
function avatarImage(name, hue) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
<circle cx="24" cy="24" r="24" fill="hsl(${hue} 45% 42%)"/>
<text x="50%" y="50%" fill="#fff" font-family="system-ui, sans-serif" font-size="24" text-anchor="middle" dominant-baseline="central">${name[0]}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

let entrySeq = 1;
function makeEntry(imageUrls, text = '') {
  const id = String(entrySeq++);
  const author = `deneme yazar ${id}`;
  return {
    id,
    author,
    authorUrl: `https://eksisozluk.com/biri/deneme-yazar-${id}`,
    avatarUrl: avatarImage(author, (Number(id) * 47) % 360),
```

```js
function fakePageSource(pages, delayMs = 300) {
  const queue = [...pages];
  const count = pages.filter((page) => !(page instanceof Error)).length + 1;
  let last = 1;
  return {
    count,
    hasNext: () => last < count,
    async next() {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      const item = queue.shift();
      if (item instanceof Error) throw item;
      last += 1;
      return { page: last, count, entries: item };
    },
  };
}
```

→

```js
/** Sayfa 1 senaryonun entry'leri, sonrakiler `pages`; `failOnce` sayfaları ilk istekte hata verir. */
function fakePageSource({ entries, pages = [], failOnce = [], delayMs = 300 }) {
  const all = [entries, ...pages];
  const failing = new Set(failOnce);
  let last = 1;
  async function load(page) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    if (failing.delete(page)) throw new Error('ağ hatası');
    last = page;
    return { page, count: all.length, entries: all[page - 1] ?? [] };
  }
  return {
    count: all.length,
    hasNext: () => last < all.length,
    next: () => load(last + 1),
    load,
  };
}
```

```js
  ['en-boy oranları', () => ({
    entries: SHAPES.map((shape, i) => makeEntry([svgImage(shape, i * 55)], shape.caption)),
    pages: [],
  })],
```

→

```js
  ['en-boy oranları', () => {
    const entries = SHAPES.map((shape, i) => makeEntry([svgImage(shape, i * 55)], shape.caption));
    return { entries: entries.slice(0, 2), pages: [entries.slice(2, 4), entries.slice(4, 6)] };
  }],
```

```js
    pages: [new Error('ağ hatası'), [makeEntry([svgImage(SHAPES[3], 240)], 'tekrar deneyince geldi')]],
```

→

```js
    pages: [[makeEntry([svgImage(SHAPES[3], 240)], 'tekrar deneyince geldi')]],
    failOnce: [2],
```

```js
    const pageSource = fakePageSource(scenario.pages, scenario.delayMs);
```

→

```js
    const pageSource = fakePageSource(scenario);
```

Run: `node --check dev/playground.js && npm test`
Expected: hata yok, `ℹ fail 0`

- [ ] **Step 2: Playground'da ölç ve gez**

Sunucuyu arka planda başlat: `npm run serve` (http://127.0.0.1:5173).

Playwright MCP araçlarını tek seferde yükle: ToolSearch sorgusu `select:mcp__plugin_playwright_playwright__browser_navigate,mcp__plugin_playwright_playwright__browser_resize,mcp__plugin_playwright_playwright__browser_take_screenshot,mcp__plugin_playwright_playwright__browser_evaluate,mcp__plugin_playwright_playwright__browser_close`.

Story'ler 5 saniyede bir kendiliğinden ilerler ve araç turları bu süreyi aşabilir. Bu yüzden aşağıdaki fonksiyonlar önce ilerleme süresini yalnızca o sayfa için uzatır, sonra başa sarar. Bu, görünümü değiştirmez.

Ölçüm fonksiyonu:

```js
async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  for (let t = 0; t < 80 && !document.querySelector('eksi-stories-viewer'); t += 1) await sleep(25);
  const shadow = document.querySelector('eksi-stories-viewer').shadowRoot;
  shadow.querySelector('.es-root').style.setProperty('--es-duration', '600000ms');
  const key = (name) => window.dispatchEvent(new KeyboardEvent('keydown', { key: name }));
  for (let t = 0; t < 20; t += 1) { key('ArrowLeft'); await sleep(40); }
  for (let t = 0; t < 80 && shadow.querySelector('.es-frame').classList.contains('is-loading'); t += 1) await sleep(25);
  await sleep(300);
  const rect = (selector) => {
    const node = shadow.querySelector(selector);
    if (!node || node.hidden) return null;
    const { x, y, width, height } = node.getBoundingClientRect();
    return { x: Math.round(x), y: Math.round(y), right: Math.round(x + width), width: Math.round(width), height: Math.round(height * 100) / 100 };
  };
  return {
    viewport: [innerWidth, innerHeight],
    hasPager: shadow.querySelector('.es-root').classList.contains('has-pager'),
    pager: rect('.es-pager'),
    select: rect('.es-pager-select'),
    last: rect('.es-pager-last'),
    stage: rect('.es-stage'),
    frame: rect('.es-frame'),
    top: rect('.es-top'),
    caption: rect('.es-caption'),
    avatar: rect('.es-avatar'),
    name: shadow.querySelector('.es-author-name').textContent,
    counter: shadow.querySelector('.es-counter').textContent,
  };
}
```

1. `browser_resize` 1280×800 → `browser_navigate` `http://127.0.0.1:5173/dev/playground.html?scenario=0` → ölçüm fonksiyonu. Beklenen: `hasPager: true`; `pager.y` 12, `pager.right` 1268; `select.height` 26; `last.height` 26.65; `stage.y` 51, `stage.height` 749; `frame.y` en az 51; `top.x` ve `top.width` `frame` ile aynı, `caption.x` ve `caption.width` de aynı; `avatar` 24×24; `name` `deneme yazar 1`; `counter` `1/2`.
2. `browser_resize` 2000×1000 → aynı adres → ölçüm fonksiyonu. Beklenen: `pager.right` 1988, `stage.y` 51, `stage.height` 949, katmanlar yine `frame` ile aynı.
3. Aynı boyutta `http://127.0.0.1:5173/dev/playground.html?scenario=1` → ölçüm fonksiyonu. Beklenen: `hasPager: false`, `pager: null`, `stage.y` 0, `stage.height` 1000, `counter` `1/4`.
4. `browser_resize` 1280×800 → `http://127.0.0.1:5173/dev/playground.html?scenario=0` → gezinme fonksiyonu:

```js
async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  for (let t = 0; t < 80 && !document.querySelector('eksi-stories-viewer'); t += 1) await sleep(25);
  const shadow = document.querySelector('eksi-stories-viewer').shadowRoot;
  shadow.querySelector('.es-root').style.setProperty('--es-duration', '600000ms');
  await sleep(1000);
  const snap = (label) => ({
    label,
    caption: shadow.querySelector('.es-caption').textContent.slice(0, 24),
    counter: shadow.querySelector('.es-counter').textContent,
    page: shadow.querySelector('.es-pager-select').value,
    prev: !shadow.querySelector('.es-pager-prev').hidden,
    next: !shadow.querySelector('.es-pager-next').hidden,
    focus: shadow.activeElement?.className ?? null,
  });
  const select = shadow.querySelector('.es-pager-select');
  const steps = [];
  select.focus();
  select.value = '3';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(700);
  steps.push(snap('seçim kutusundan 3'));
  const onSelect = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, composed: true, cancelable: true });
  select.focus();
  select.dispatchEvent(onSelect);
  await sleep(200);
  steps.push({ ...snap('seçim kutusundayken ←'), handled: onSelect.defaultPrevented });
  shadow.querySelector('.es-pager-prev').click();
  await sleep(700);
  steps.push(snap('«'));
  shadow.querySelector('.es-pager-last').click();
  await sleep(700);
  steps.push(snap('son sayfa'));
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
  await sleep(200);
  steps.push(snap('→'));
  return steps;
}
```

Beklenen sırayla:
- `seçim kutusundan 3`: `caption` `uzun bir ekran görüntüsü`, `counter` `1/2`, `page` `3`, `prev` `true`, `next` `false`, `focus` `es-root has-pager`
- `seçim kutusundayken ←`: aynı story, `handled` `false`
- `«`: `caption` `balkondaki sardunyalar.`, `counter` `1/2`, `page` `2`, `prev` ve `next` `true`
- `son sayfa`: `caption` `uzun bir ekran görüntüsü`, `page` `3`
- `→`: `caption` `eski telefondan kalma bi`, `counter` `2/2`, `page` `3`

Bir değer tutmazsa dur ve farkı bildir; CSS'i tahminle değiştirme.

- [ ] **Step 3: Store ekran görüntülerini yeniden çek**

Ekran görüntülerinde `scale: "css"` ve `type: "png"` kullan; `filename` repo köküne göre göreli yoldur.

1. `browser_resize` 1280×800 → `browser_navigate` `http://127.0.0.1:5173/dev/playground.html?scenario=0` → `browser_evaluate` aşağıdaki fonksiyonla (hedef yazı `sabah vapurundan.`) → `browser_take_screenshot` `filename: "store/screenshots/01-dikey.png"`.
2. `browser_navigate` `http://127.0.0.1:5173/dev/playground.html?scenario=0` → `browser_evaluate` (hedef yazı `tepeden bütün şehir, sis daha kalkmamış.`) → `browser_take_screenshot` `filename: "store/screenshots/02-panorama.png"`.
3. `browser_navigate` `http://127.0.0.1:5173/dev/playground.html?scenario=1` → `browser_evaluate` (hedef yazı `bayram sabahından üç kare.`) → `browser_take_screenshot` `filename: "store/screenshots/03-coklu-gorsel.png"`.

`browser_evaluate` fonksiyonu; `TARGET` yerine o adımın hedef yazısını koy:

```js
async () => {
  const TARGET = 'tepeden bütün şehir, sis daha kalkmamış.';
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  for (let t = 0; t < 80 && !document.querySelector('eksi-stories-viewer'); t += 1) await sleep(25);
  const shadow = document.querySelector('eksi-stories-viewer').shadowRoot;
  const root = shadow.querySelector('.es-root');
  root.style.setProperty('--es-duration', '600000ms');
  const caption = () => shadow.querySelector('.es-caption').textContent;
  const key = (name) => window.dispatchEvent(new KeyboardEvent('keydown', { key: name }));
  // Araç turu 5 saniyeyi aşarsa story hedefi geçmiş olabilir: önce başa sar, sonra ileri git.
  for (let t = 0; t < 20; t += 1) { key('ArrowLeft'); await sleep(40); }
  for (let t = 0; t < 40 && !caption().startsWith(TARGET); t += 1) { key('ArrowRight'); await sleep(120); }
  for (let t = 0; t < 80 && shadow.querySelector('.es-frame').classList.contains('is-loading'); t += 1) await sleep(25);
  await sleep(300);
  const shown = (selector) => !shadow.querySelector(selector).hidden;
  const pager = shown('.es-pager')
    ? `${shown('.es-pager-prev') ? '« ' : ''}[${shadow.querySelector('.es-pager-select').value}] / ${shadow.querySelector('.es-pager-last').textContent}${shown('.es-pager-next') ? ' »' : ''}`
    : null;
  return {
    caption: caption().slice(0, 40),
    counter: shadow.querySelector('.es-counter').textContent,
    pager,
    avatar: shown('.es-avatar'),
    paused: root.classList.contains('is-paused'),
  };
}
```

Beklenen `browser_evaluate` sonuçları (hepsinde `avatar: true`, `paused: false`):
- `01-dikey.png`: `caption` `sabah vapurundan.` ile başlar, `counter` `1/2`, `pager` `[1] / 3 »`
- `02-panorama.png`: `caption` `tepeden bütün şehir, sis daha kalkmamış.`, `counter` `2/2`, `pager` `« [2] / 3 »`
- `03-coklu-gorsel.png`: `caption` `bayram sabahından üç kare.`, `counter` `1/4`, `pager` `null`

Bitince `browser_close` çağır, sunucuyu PID ile durdur (`lsof -ti tcp:5173 -sTCP:LISTEN`, ardından `kill <pid>`) ve Playwright'ın ürettiği geçici klasörü sil: `rm -rf .playwright-mcp`.

- [ ] **Step 4: Görselleri doğrula**

```bash
for f in store/screenshots/*.png; do node -e "const b=require('node:fs').readFileSync(process.argv[1]); console.log(process.argv[1], b.readUInt32BE(16) + 'x' + b.readUInt32BE(20))" "$f"; done
```

Expected: üç dosya için `1280x800`.

Her görseli Read aracıyla aç ve kontrol et:
- `01-dikey.png`: sağ üstte `[1 ⌄] / 3 »` kutuları; dikey görsel şeridin altında başlar; üst barda yuvarlak avatar, `deneme yazar 1`, sağda `1/2`; alt yazı "sabah vapurundan." ile başlar, üç satırda "…" ile kırpılır; ❚❚ yok.
- `02-panorama.png`: sağ üstte `« [2 ⌄] / 3 »`; panorama dikeyde şeridin altındaki alanın ortasında; üst ve alt katmanlar görselin kenarlarına oturur; sayaç `2/2`; ❚❚ yok.
- `03-coklu-gorsel.png`: sayfa kutusu yok, görsel tam yükseklikte; üç parçalı ilerleme çubuğu; sayaç `1/4`; alt yazı "bayram sabahından üç kare."; ❚❚ yok.

- [ ] **Step 5: Commit**

```bash
git add dev/playground.js store/screenshots
git commit -m "docs: playground'a sayfa kutusu senaryosu ve avatarlar ekle, store görsellerini yenile

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Belgeler

**Files:**
- Modify: `README.md`
- Modify: `store/listing-tr.md`
- Modify: `PRIVACY.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/superpowers/specs/2026-09-14-eksi-stories-design.md` (başa not)

**Interfaces:**
- Consumes: Görev 1–6'da çıkan davranış (avatar, sayaç, sayfa kutusu, kapatınca entry'ye dönüş)
- Produces: yok (yalnızca belge)

Metinler spec §8'dekiyle birebir aynıdır; kelime değiştirme.

- [ ] **Step 1: README**

`README.md` içinde:

```markdown
- her görselde yazar, tarih ve entry'ye git linki var.
```

→

```markdown
- her görselde yazarın avatarı ve adı, tarih ve entry'ye git linki var.
- üstte o sayfada kaçıncı görselde olduğun yazar, mesela 5/12.
- sağ üstteki sayfa kutusuyla ekşi'deki gibi sayfa değiştirebilirsin.
- kapatınca son baktığın entry'ye gider.
```

```markdown
| kapat | esc ya da ✕ |
```

→

```markdown
| sayfa değiştir | sağ üstteki sayfa kutusu, « ya da » |
| kapat | esc ya da ✕ |
```

```markdown
- [ ] kapatınca son bakılan entry sayfadaysa oraya kayıyor.
```

→

```markdown
- [ ] kapatınca son bakılan entry sayfadaysa oraya kayıyor.
- [ ] başka sayfadayken kapatınca son bakılan entry açılıyor.
- [ ] çok sayfalı başlıkta sağ üstte ekşi'deki gibi sayfa kutusu var, sayfa değişiyor.
- [ ] sayaç sayfa içinde doğru sayıyor, sonraki sayfada 1'den başlıyor.
- [ ] avatarlar görünüyor, avatarı olmayan yazarda varsayılan çizim var.
```

- [ ] **Step 2: Store yazıları**

`store/listing-tr.md` içinde:

```text
• her görselde yazar, tarih ve entry'ye git linki var.
```

→

```text
• her görselde yazarın avatarı ve adı, tarih ve entry'ye git linki var.
• üstte o sayfada kaçıncı görselde olduğun yazar, mesela 5/12.
• sağ üstten istediğin sayfaya geç.
• kapatınca son baktığın entry'ye gidersin.
```

```text
açıklama: entry yazıları, yazar adları, tarihler ve görsel linkleri
```

→

```text
açıklama: entry yazıları, yazar adları ve avatarları, tarihler ve görsel linkleri
```

- [ ] **Step 3: Gizlilik, değişiklikler ve eski spec**

`PRIVACY.md` içinde:

```markdown
- açık başlık sayfasındaki entry yazılarını, yazar adlarını, tarihleri ve görsel linklerini okur, görselleri tam ekran gösterir.
```

→

```markdown
- açık başlık sayfasındaki entry yazılarını, yazar adlarını ve avatarlarını, tarihleri ve görsel linklerini okur, görselleri tam ekran gösterir. avatarlar ekşi'nin görsel sunucusundan yüklenir.
```

`CHANGELOG.md` içinde:

```markdown
- ilk sürüm. başlıklarda story butonu, görselleri kırpmadan tam ekran açan story ekranı, sonraki sayfalara yavaş geçiş, ekşi görselleri (`soz.lk`, `/img`) ve direkt görsel linkleri, her görselde yazar, tarih ve entry linki.
```

→

```markdown
- ilk sürüm. başlıklarda story butonu, görselleri kırpmadan tam ekran açan story ekranı, sonraki sayfalara yavaş geçiş, sağ üstte ekşi'deki gibi sayfa kutusu, sayfa içi sayaç, ekşi görselleri (`soz.lk`, `/img`) ve direkt görsel linkleri, her görselde avatar, yazar, tarih ve entry linki, kapatınca son bakılan entry'ye dönüş.
```

`docs/superpowers/specs/2026-09-14-eksi-stories-design.md` içinde:

```markdown
Durum: Onaylandı (brainstorming sonucu)
```

→

```markdown
Durum: Onaylandı (brainstorming sonucu)
Not: §5 kapatma ve §6 üst bar maddeleri 2026-09-16-sayfa-gostergesi-design.md ile güncellendi.
```

- [ ] **Step 4: Metinleri kontrol et**

```bash
grep -c "avatarı ve adı" README.md store/listing-tr.md
grep -c "sayfa değiştir |" README.md
grep -c "avatarlar ekşi'nin görsel sunucusundan yüklenir." PRIVACY.md
grep -c "sayfa içi sayaç" CHANGELOG.md
grep -c "sayfa-gostergesi-design.md ile güncellendi" docs/superpowers/specs/2026-09-14-eksi-stories-design.md
grep -n "yazar, tarih ve entry'ye git" README.md store/listing-tr.md || echo "eski madde yok"
```

Expected: ilk satır `README.md:1` ve `store/listing-tr.md:1`, sonraki dört komut `1`, son komut `eski madde yok`.

Run: `npm test`
Expected: `ℹ fail 0`

- [ ] **Step 5: Commit**

```bash
git add README.md store/listing-tr.md PRIVACY.md CHANGELOG.md docs/superpowers/specs/2026-09-14-eksi-stories-design.md
git commit -m "docs: sayfa kutusu, sayaç, avatar ve kapatınca dönüşü belgelere ekle

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Canlı kontrol, paket ve push

**Files:**
- Modify: yok (doğrulama ve yayın)

**Interfaces:**
- Consumes: Görev 1–7'nin commit'leri
- Produces: güncel `dist/eksi-stories-0.1.0.zip`, GitHub'da güncel `main`

Bu görevi alt ajana verme: kullanıcının Chrome'u ve onayı gerekir. Kullanıcıya soruları AskUserQuestion ile sor.

- [ ] **Step 1: Testler ve paket**

Run: `npm test`
Expected: `ℹ fail 0` (toplam 76 test)

Run: `npm run package`
Expected: `dist/eksi-stories-0.1.0.zip` oluşur, komut hatasız biter.

- [ ] **Step 2: Kullanıcıdan eklentiyi yenilemesini iste**

AskUserQuestion: "chrome://extensions sayfasında stories for ekşi sözlük eklentisini yenileyip açık ekşi sekmesini de yeniledin mi?" Seçenekler: "Yeniledim" / "Nasıl yapacağımı anlat". İkincisinde adımları anlat, sonra yeniden sor.

- [ ] **Step 3: Sayfa kutusunu ekşi'ninkiyle karşılaştır**

Claude in Chrome araçlarını tek seferde yükle: ToolSearch sorgusu `select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__read_console_messages,mcp__claude-in-chrome__find`.

Not: bu araçta sorgu parametreli adres içeren JS çıktıları engellenir. Fonksiyonlar adres döndürmez, yalnızca sayı, sayfa numarası ve true/false döndürür.

`https://eksisozluk.com/anin-fotografi--6459985` adresini aç ve çalıştır:

```js
(() => {
  const pick = (node) => {
    const cs = getComputedStyle(node);
    return { height: cs.height, padding: cs.padding, margin: cs.margin, color: cs.color, background: cs.backgroundColor, border: cs.border, radius: cs.borderRadius, font: cs.fontFamily.split(',')[0], size: cs.fontSize };
  };
  const pager = document.querySelector('.pager');
  return { select: pick(pager.querySelector('select')), last: pick(pager.querySelector('a.last')), next: pager.querySelector('a.next') ? pick(pager.querySelector('a.next')) : null };
})()
```

Sonra story butonuna tıkla (`find` ile `story ·` butonunu bul, `computer` ile tıkla), iki saniye bekle ve çalıştır:

```js
(() => {
  const pick = (node) => {
    const cs = getComputedStyle(node);
    return { height: cs.height, padding: cs.padding, margin: cs.margin, color: cs.color, background: cs.backgroundColor, border: cs.border, radius: cs.borderRadius, font: cs.fontFamily.split(',')[0], size: cs.fontSize };
  };
  const shadow = document.querySelector('eksi-stories-viewer').shadowRoot;
  return { select: pick(shadow.querySelector('.es-pager-select')), last: pick(shadow.querySelector('.es-pager-last')), next: pick(shadow.querySelector('.es-pager-next')) };
})()
```

Expected: iki sonuçta `select`, `last` ve `next` alanları birebir aynı. `computer` ile ekran görüntüsü al: sağ üstte `[1 ⌄] / N »`, üst barda avatar ve isim, sayaç `1/n`. Fark varsa kullanıcıya göster ve dur.

- [ ] **Step 4: Sayfa atla ve istekleri say**

```js
(async () => {
  const shadow = document.querySelector('eksi-stories-viewer').shadowRoot;
  const select = shadow.querySelector('.es-pager-select');
  const target = Math.max(3, Math.floor(select.options.length / 2));
  const before = performance.getEntriesByType('resource').length;
  select.value = String(target);
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 4000));
  const pages = performance.getEntriesByType('resource').slice(before)
    .map((entry) => new URL(entry.name))
    .filter((url) => url.pathname === location.pathname)
    .map((url) => Number(url.searchParams.get('p')));
  const card = shadow.querySelector('.es-card');
  return { target, pages, selectValue: Number(select.value), card: card.hidden ? null : shadow.querySelector('.es-card-text').textContent, counter: shadow.querySelector('.es-counter').textContent };
})()
```

Expected: `pages` `[target]` ya da `[target, target + 1]` (hedef sayfada 4'ten az görsel varsa sonraki sayfa en az 1,5 sn sonra istenir); başka sayfa numarası yok. `selectValue` hedef sayfa ya da ondan sonraki görselli sayfa; `card` `null`; `counter` `1/n`. `pages` boş dönerse eklentinin istekleri bu listede görünmüyor demektir: `read_console_messages` ile hata olmadığını kontrol et ve istekleri kullanıcıdan devtools network sekmesinde doğrulamasını iste.

- [ ] **Step 5: Başka sayfadayken kapat**

```js
(() => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  return true;
})()
```

Üç saniye bekle, sonra çalıştır:

```js
(() => {
  const id = new URLSearchParams(location.search).get('focusto');
  const item = id ? document.querySelector(`#entry-item-list > li[data-id="${id}"]`) : null;
  const rect = item?.getBoundingClientRect();
  return {
    hasFocusto: Boolean(id),
    entryOnPage: Boolean(item),
    entryVisible: Boolean(rect && rect.top < innerHeight && rect.bottom > 0),
    page: Number(document.querySelector('.pager')?.dataset.currentpage ?? 1),
  };
})()
```

Expected: `hasFocusto`, `entryOnPage` ve `entryVisible` `true`; `page` Adım 4'teki hedef sayfa ya da sonrası.

- [ ] **Step 6: Push için onay al ve gönder**

AskUserQuestion: "Canlı kontroller geçti. main GitHub'a gönderilsin mi?" Seçenekler: "Evet, push et" / "Şimdilik yerelde kalsın". Onay gelirse:

```bash
git push origin main
git status -sb
```

Expected: `## main...origin/main` (önde commit yok).
