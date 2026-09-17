# açılmayan görsellerde sayfa sınırı: uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ekranın başında kimse yokken görseller açılmadığında sayfa ve `/img/` isteklerinin sınırsız sürmesini engellemek. Görselleri açılmayan sayfalar da 5 sayfa sınırına sayılacak.

**Architecture:**
- Story akışı (`src/core/story-feed.js`) `blocked` ve `emptyStreak` yerine iki sayı tutar: sayımın başladığı sayfa (`searchFromPage`) ve görseli açılan en ileri sayfa (`lastOpenedPage`).
- Önden okuma, bu iki sayfanın büyüğünden sonra `EMPTY_PAGE_LIMIT` sayfa yüklenince durur. `state.blocked` bu koşuldan hesaplanır.
- Görüntüleyici (`src/viewer/viewer.js`) aktif görsel açılınca `feed.markOpened(story)` çağırır. Sınır kartının metni `5 sayfadır açılan görsel yok` olur.
- Playground'a görselleri açılmayan sayfalar için bir senaryo, README'ye yeni kural, eski spec'lere not eklenir.

**Tech Stack:** Vanilla JS (MV3 Chrome eklentisi, build yok), Node.js `node:test`, jsdom.

**Spec:** [docs/superpowers/specs/2026-09-17-acilmayan-gorsel-siniri-design.md](../specs/2026-09-17-acilmayan-gorsel-siniri-design.md)

## Global Constraints

- İstek kuralları ve sabitler değişmez. `src/core/constants.js`'e dokunulmaz.
  - aynı anda tek sayfa isteği;
  - istek başlangıçları arasında en az `PAGE_MIN_GAP_MS` = 1500 ms;
  - 429/5xx/ağ hatasında `PAGE_RETRY_DELAY_MS` = 5000 ms sonra bir tekrar;
  - görsel çözümleme eşzamanlılığı `RESOLVE_CONCURRENCY` = 2;
  - `EMPTY_PAGE_LIMIT` = 5, adı da değeri de aynı kalır.
- Şu dosyalar değişmez: `src/core/page-source.js`, `src/core/image-resolver.js`, `src/core/entry-parser.js`, `src/core/image-links.js`, `src/content/*`, `src/viewer/viewer.css`.
- Kural (spec §3):
  - Önden sayfa okuma, son açılan görselin sayfasından sonra `EMPTY_PAGE_LIMIT` sayfa yüklenince durur. Henüz görsel açılmadıysa sayım başlangıç sayfasından yapılır.
  - "Açıldı" demek, görüntüleyicide aktif story'nin `<img>` elemanı için `load` olayının gelmesi demek.
  - Sayımın başladığı sayfa: açılış sayfası, tamponda olmayan bir sayfaya atlanınca hedef sayfa, "aramaya devam"a basılınca o an son yüklenen sayfa.
- Şunlar yazılmaz (spec §3, kullanıcı kararı 17.09.2026):
  - gizli ya da durdurulmuş ekranda açılmayan görseli bekletmek;
  - gizliyken önden sayfa istememek;
  - art arda açılmayan görsel sayısına sınır koymak;
  - `/img/` isteklerini yavaşlatmak ya da 429'a özel davranış eklemek.
- Önceki kararlar aynı kalır: kapatmak hiçbir beklemeyi kısaltmaz, uçuştaki istek kesilmez; sıra sekme başınadır; sekmeler arası koordinasyon yoktur.
- Kullanıcıya görünen metinler ekşi arayüz dilindedir: küçük harf, kısa, sade.
  - Sınır kartının metni tam olarak `` `${EMPTY_PAGE_LIMIT} sayfadır açılan görsel yok` ``; butonlar `aramaya devam` ve `kapat`.
  - README'de yalnızca "kurallar" maddesi ve playground senaryo aralığı değişir.
  - PRIVACY, `store/` ve CHANGELOG değişmez.
- Eski spec'lerin gövdesi değişmez; yalnızca başlarına `Not:` satırı eklenir.
- Kod yorumları ve test adları Türkçedir. Test adları küçük harfle başlar. Yorumlar, dosyadaki mevcut yorumların üslubunu (cümle başı büyük harf) ve yoğunluğunu izler.
- Commit mesajları şu satırla biter: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Kullanıcıya sormadan push yapılmaz.

## Dosya haritası

| dosya | değişiklik | görev |
|---|---|---|
| `test/story-feed.test.js` | `brokenPages` ve `brokenIds` yardımcıları; 5 yeni test | 1 |
| `src/core/story-feed.js` | `searchFromPage`, `lastOpenedPage`, `searchLimitReached`, `isBlocked`, `markOpened`; `blocked` ve `emptyStreak` kalkar | 1 |
| `test/main.smoke.test.js` | `pageUrls`, `fakeClockQueue` ve `brokenImagesSetup` yardımcıları; 2 yeni test | 2 |
| `src/viewer/viewer.js` | `image.onload` içinde `feed.markOpened(story)`; sınır kartı metni | 2 |
| `dev/playground.js` | `açılmayan görseller → aramaya devam` senaryosu | 3 |
| `README.md` | "siteyi yormaz" maddesi; playground senaryo aralığı | 3 |
| `docs/superpowers/specs/2026-09-14-eksi-stories-design.md`, `docs/superpowers/specs/2026-09-16-sayfa-gostergesi-design.md`, `docs/superpowers/specs/2026-09-17-istek-sirasi-sinirlari-design.md`, `docs/superpowers/specs/2026-09-16-eksi-dili-metinler-design.md` | `Not:` satırları | 3 |

Test sayısı: başlangıçta 88, Görev 1 sonunda 93, Görev 2 sonunda 95, Görev 3 sonunda 95.

> Plan kodu `0e36054` üzerinde, temiz bir kopyada baştan sona denendi:
> - Her kırmızı ve yeşil çıktı ile test sayıları gözlendi.
> - Yeni testlerin her biri, kodun ilgili satırı bilerek bozulunca düştü: story akışında 8, görüntüleyicide 2 bozma denendi.
> - 95 test art arda 10 çalıştırmada geçti.
> - Simülasyon değişiklikten önce ve sonra çalıştırıldı.
> - Playground'daki yeni senaryo ve "boş sayfalar" senaryosu uygulama içi tarayıcıda denendi. Bildirimler çıktı, `5 sayfadır açılan görsel yok` kartı göründü ve `aramaya devam` 7. sayfanın görselini açtı.

---

### Task 1: Görselleri açılmayan sayfaları da sayfa sınırına say

**Files:**
- Modify: `test/story-feed.test.js` (`noImagePage` satırının altı, dosya sonu)
- Modify: `src/core/story-feed.js` (durum değişkenleri, `appendEntries`, `forwardFrom` sonrası, `fetchNextPage`, `goToPage`, `continueSearching`, dönen nesne)

**Interfaces:**
- Consumes (`test/story-feed.test.js` içindeki mevcut yardımcılar):
  - `entry(id, imageIds)`: entry nesnesi; görseller `{ kind: 'eksi', id }` biçiminde.
  - `noImagePage()`: görselsiz tek entry'lik sayfa.
  - `fakeResolver(fail)`: `fail` içindeki kimlikleri reddeder, diğerlerini `https://cdn.test/<id>.jpg` adresine çözer.
  - `makeFeed({ entries, results, count, fail })` → `{ feed, resolver, pageSource }`. `pageSource.calls`, istenen sonraki sayfaların listesidir.
  - `makeJumpFeed({ entries, count, pages })` → `{ feed, pageSource }`. `pageSource.loads` atlama sayfalarını, `pageSource.nexts` sonraki sayfaları listeler.
  - `flush()`: bekleyen mikro görevleri boşaltır.
- Produces:
  - `feed.markOpened(story): void`. Görüntüleyici aktif story'nin görseli açılınca çağırır.
    - `disposed` doğruysa, `story` aktif story değilse (`stories[index] !== story`) ya da `story.page <= lastOpenedPage` ise hiçbir şey yapmaz.
    - Değilse `lastOpenedPage = story.page` yapar, `ensureAhead()` çalıştırır ve `change` yayar.
  - `feed.state.blocked: boolean` artık hesaplanır: `pageSource.hasNext() && lastLoadedPage - Math.max(searchFromPage, lastOpenedPage) >= emptyPageLimit`. Aktif story varken de true olabilir; görüntüleyici kartı yalnızca aktif story yokken gösterir.
  - `feed.continueSearching()`: sınır dolu değilse hiçbir şey yapmaz; doluysa sayımı son yüklenen sayfadan yeniden başlatır.

- [ ] **Step 1: Başarısız testleri yaz**

`test/story-feed.test.js` içinde şu satırın:

```js
const noImagePage = () => [entry(String(entrySeq++))];
```

hemen altına ekle:

```js
/** `from`–`to` sayfalarının her birinde görseli açılmayan tek entry; görsel kimliği `x<sayfa>`. */
const brokenPages = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => [entry(String(from + i), [`x${from + i}`])]);
/** `fakeResolver`'da açılmayacak `x1`–`x<to>` kimlikleri. */
const brokenIds = (to) => Array.from({ length: to }, (_, i) => `x${i + 1}`);
```

Aynı dosyanın sonuna, son testten (`kapatıldıktan sonra reddedilen sayfa isteği hata durumu yaratmaz`) sonra bir boş satır bırakıp ekle:

```js
test('görselleri açılmayan sayfalar da 5 sayfa sınırına sayılır', async () => {
  const { feed, pageSource } = makeFeed({
    entries: [entry('1', ['x1'])],
    results: brokenPages(2, 11),
    count: 12,
    fail: brokenIds(11),
  });
  feed.start();
  for (let i = 0; i < 8; i += 1) await flush();
  assert.deepEqual(pageSource.calls, [2, 3, 4, 5, 6]);
  assert.equal(feed.current(), null);
  assert.equal(feed.state.blocked, true);
  assert.equal(feed.state.ended, false);

  feed.continueSearching();
  for (let i = 0; i < 8; i += 1) await flush();
  assert.deepEqual(pageSource.calls, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.equal(feed.state.blocked, true);
});

test('görsel açılınca sayım o görselin sayfasından yeniden başlar', async () => {
  const results = brokenPages(2, 12);
  results[2] = [entry('4', ['ok4'])]; // 4. sayfanın görseli açılır
  const { feed, pageSource } = makeFeed({
    entries: [entry('1', ['x1'])],
    results,
    count: 13,
    fail: brokenIds(12),
  });
  feed.start();
  for (let i = 0; i < 8; i += 1) await flush();
  assert.equal(feed.current().ref.id, 'ok4');
  assert.deepEqual(pageSource.calls, [2, 3, 4, 5, 6]);
  assert.equal(feed.state.blocked, true, 'sınır dolu, 4. sayfanın görseli henüz açılmadı');

  feed.markOpened(feed.current());
  for (let i = 0; i < 8; i += 1) await flush();
  assert.deepEqual(pageSource.calls, [2, 3, 4, 5, 6, 7]);
  assert.equal(feed.state.blocked, false);

  feed.next();
  for (let i = 0; i < 8; i += 1) await flush();
  assert.deepEqual(pageSource.calls, [2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(feed.current(), null);
  assert.equal(feed.state.blocked, true);
});

test('aktif olmayan story için markOpened yok sayılır', async () => {
  const { feed, pageSource } = makeFeed({
    entries: [entry('1', ['x1'])],
    results: brokenPages(2, 11),
    count: 12,
    fail: brokenIds(11),
  });
  feed.start();
  for (let i = 0; i < 8; i += 1) await flush();
  assert.equal(feed.state.blocked, true);

  feed.markOpened(feed.peek(-1));
  for (let i = 0; i < 8; i += 1) await flush();
  assert.deepEqual(pageSource.calls, [2, 3, 4, 5, 6]);
  assert.equal(feed.state.blocked, true);
});

test('sınır son sayfada dolarsa başlık biter', async () => {
  const { feed, pageSource } = makeFeed({
    entries: [entry('1', ['a'])],
    results: [noImagePage(), noImagePage(), noImagePage(), noImagePage(), noImagePage()],
    count: 6,
  });
  feed.start();
  feed.next();
  for (let i = 0; i < 6; i += 1) await flush();
  assert.deepEqual(pageSource.calls, [2, 3, 4, 5, 6]);
  assert.equal(feed.state.blocked, false);
  assert.equal(feed.state.ended, true);
});

test('atlamada açılan görselin sayfası sıfırlanır', async () => {
  const { feed, pageSource } = makeJumpFeed({
    entries: [entry('1', ['a', 'b', 'c', 'd'])],
    count: 30,
    pages: { 10: [entry('10', ['j1', 'j2', 'j3', 'j4'])] },
  });
  feed.start();
  feed.goToPage(10);
  await flush();
  assert.equal(feed.current().ref.id, 'j1');
  feed.markOpened(feed.current());

  feed.goToPage(3);
  for (let i = 0; i < 8; i += 1) await flush();
  assert.deepEqual(pageSource.loads, [10, 3]);
  assert.deepEqual(pageSource.nexts, [4, 5, 6, 7, 8]);
  assert.equal(feed.state.blocked, true);
});
```

Notlar:
- `feed.peek(-1)`: aktif story yokken (index tamponun sonundayken) tampondaki son story'yi, yani 6. sayfanınkini döndürür.
- `fakeResolver`'da reddedilen görsel `markFailed` ile atlanır; zincir yalnızca mikro görevlerle ilerler, `flush` döngüleri yeterlidir.
- Mevcut testlere ve yardımcılara dokunma.

- [ ] **Step 2: Testlerin başarısız olduğunu gör**

Run: `node --test test/story-feed.test.js`
Expected: FAIL: `ℹ tests 32`, `ℹ pass 27`, `ℹ fail 5`. Hatalar:
- `görselleri açılmayan sayfalar da 5 sayfa sınırına sayılır`: `AssertionError`, `actual` 2'den 12'ye bütün sayfalar, `expected: [ 2, 3, 4, 5, 6 ]`.
- `görsel açılınca sayım o görselin sayfasından yeniden başlar`: `AssertionError`, `actual: [ 2, 3, 4, 5, 6, 7 ]`, `expected: [ 2, 3, 4, 5, 6 ]`.
- `aktif olmayan story için markOpened yok sayılır`: `AssertionError`, `actual: false`, `expected: true`.
- `sınır son sayfada dolarsa başlık biter`: `AssertionError`, `actual: true`, `expected: false`.
- `atlamada açılan görselin sayfası sıfırlanır`: `TypeError: feed.markOpened is not a function`.

- [ ] **Step 3: Story akışında sayımı değiştir**

`src/core/story-feed.js` içinde sırayla şu değişiklikleri yap.

Durum değişkenleri:

```js
  let loading = false;
  let blocked = false;
  let emptyStreak = 0;
  let errorKind = null;
  let started = false;
  let disposed = false;
  let firstLoadedPage = page;
  let lastLoadedPage = page;
```

→

```js
  let loading = false;
  let errorKind = null;
  let started = false;
  let disposed = false;
  let firstLoadedPage = page;
  let lastLoadedPage = page;
  // Önden okuma sınırı bu iki sayfanın büyüğünden sayılır: sayımın başladığı sayfa ve görseli açılan en ileri sayfa (henüz yoksa 0).
  let searchFromPage = page;
  let lastOpenedPage = 0;
```

`appendEntries` artık sayı döndürmez:

```js
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
```

→

```js
  function appendEntries(list, pageNumber) {
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
      });
    }
  }
```

`forwardFrom` fonksiyonunun hemen altına iki fonksiyon ekle:

```js
  function forwardFrom(start) {
    return Math.min(playableFrom(Math.max(start, 0), 1), stories.length);
  }
```

→

```js
  function forwardFrom(start) {
    return Math.min(playableFrom(Math.max(start, 0), 1), stories.length);
  }

  /** Son açılan görselin (yoksa sayımın başladığı) sayfasından sonra `emptyPageLimit` sayfa yüklendiyse önden okuma durur. */
  function searchLimitReached() {
    return lastLoadedPage - Math.max(searchFromPage, lastOpenedPage) >= emptyPageLimit;
  }

  /** Önden okuma sınırda durdu ama başlıkta sonraki sayfa var; "aramaya devam" beklenir. */
  function isBlocked() {
    return pageSource.hasNext() && searchLimitReached();
  }
```

`fetchNextPage` içinde koşul satırı:

```js
    if (loading || blocked || errorKind !== null || !pageSource.hasNext()) return;
```

→

```js
    if (loading || errorKind !== null || !pageSource.hasNext() || searchLimitReached()) return;
```

Aynı fonksiyonun başarı işleyicisinde:

```js
        lastLoadedPage = result.page;
        const added = appendEntries(result.entries, result.page);
        emptyStreak = added > 0 ? 0 : emptyStreak + 1;
        if (emptyStreak >= emptyPageLimit) blocked = true;
        ensureAhead();
```

→

```js
        lastLoadedPage = result.page;
        appendEntries(result.entries, result.page);
        ensureAhead();
```

`goToPage` içinde, tamponda olmayan sayfaya atlama:

```js
    loading = true;
    blocked = false;
    errorKind = null;
    emptyStreak = 0;
    failedJump = null;
```

→

```js
    loading = true;
    errorKind = null;
    searchFromPage = target;
    lastOpenedPage = 0;
    failedJump = null;
```

`continueSearching` ve önüne yeni `markOpened`:

```js
  function continueSearching() {
    if (!blocked) return;
    blocked = false;
    emptyStreak = 0;
    ensureAhead();
    emit('change');
  }
```

→

```js
  /** Görüntüleyici aktif story'nin görseli açılınca çağırır; önden okuma sınırı bu görselin sayfasından yeniden sayılır. */
  function markOpened(story) {
    if (disposed || stories[index] !== story || story.page <= lastOpenedPage) return;
    lastOpenedPage = story.page;
    ensureAhead();
    emit('change');
  }

  function continueSearching() {
    if (!isBlocked()) return;
    searchFromPage = lastLoadedPage;
    ensureAhead();
    emit('change');
  }
```

Dönen nesnede:

```js
    markFailed,
    continueSearching,
```

→

```js
    markFailed,
    markOpened,
    continueSearching,
```

`state` getter'ının başında:

```js
    get state() {
      const story = stories[index] ?? null;
      return {
```

→

```js
    get state() {
      const story = stories[index] ?? null;
      const blocked = isBlocked();
      return {
```

`state` içindeki `blocked,` ve `ended: index >= stories.length && !loading && !blocked && errorKind === null && !pageSource.hasNext(),` satırları aynı kalır; artık yerel `blocked` değişkenini kullanırlar. Dosyada başka hiçbir şeyi değiştirme.

- [ ] **Step 4: Testleri çalıştır**

Run: `grep -nE "emptyStreak|blocked = " src/core/story-feed.js`
Expected: tek satır: `const blocked = isBlocked();`

Run: `node --test test/story-feed.test.js`
Expected: PASS: `ℹ tests 32`, `ℹ pass 32`, `ℹ fail 0`

Run: `npm test`
Expected: PASS: `ℹ tests 93`, `ℹ pass 93`, `ℹ fail 0`

- [ ] **Step 5: Simülasyonu çalıştır**

Aşağıdaki betiği repoya eklemeden geçici bir yere yaz, örneğin `$TMPDIR/sinir-sim.mjs`. Betik sanal saatle çalışır. Gerçek story akışını, sayfa kaynağını, sırayı ve çözümleyiciyi kullanır. Görüntüleyici durmuş ve ekrana dokunulmuyor kabul edilir; direkt linklerde görüntüleyicinin `onerror` davranışı taklit edilir.

```js
// Açılmayan görsellerde önden okuma simülasyonu: sanal saat, gerçek story akışı, sayfa kaynağı, sıra ve çözümleyici.
// Görüntüleyici durmuş ve ekrana dokunulmuyor; direkt linklerde görüntüleyicinin onerror davranışı taklit edilir.
// Repo kökünden çalıştırılır: node <betiğin yolu>
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const load = (path) => import(pathToFileURL(`${root}/${path}`).href);
const { createStoryFeed } = await load('src/core/story-feed.js');
const { createPageSource, createPageQueue } = await load('src/core/page-source.js');
const { createResolver } = await load('src/core/image-resolver.js');
const { parseTopicPage } = await load('src/core/entry-parser.js');
const { parseHtml } = await load('test/helpers/dom.js');
const { topicPageHtml, link } = await load('test/helpers/eksi-html.js');

const PAGE_URL = 'https://eksisozluk.com/anin-fotografi--6459985';
const PAGE_COUNT = 22000;
const LIMIT_MS = 10 * 60 * 1000;

async function run({ name, perPage, kind, imgStatus = 404, imgMs = 150, directFailMs = 100 }) {
  const timers = [];
  let now = 0;
  let seq = 0;
  const later = (ms) => new Promise((resolve) => timers.push({ at: now + ms, seq: seq++, resolve }));
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  let img = 0;
  const pageStarts = [];
  const makeEntries = (p) => Array.from({ length: perPage }, (_, i) => ({
    id: `${p}${String(i).padStart(3, '0')}`,
    content: kind === 'eksi' ? link(`https://soz.lk/i/p${p}n${i}`) : link(`https://olu-site.example/${p}-${i}.jpg`),
  }));
  const fetch = async (url) => {
    if (url.startsWith('https://eksisozluk.com/img/')) {
      img += 1;
      await later(imgMs);
      return { ok: false, status: imgStatus, text: async () => '' };
    }
    pageStarts.push(now);
    await later(300);
    const p = Number(new URL(url).searchParams.get('p'));
    return { ok: true, status: 200, text: async () => topicPageHtml({ current: p, count: PAGE_COUNT, entries: makeEntries(p) }) };
  };
  const queue = createPageQueue({ now: () => now, sleep: (ms) => later(ms) });
  const pageSource = createPageSource({ fetch, parseHtml, baseUrl: PAGE_URL, current: 1, count: PAGE_COUNT, queue, sleep: (ms) => later(ms) });
  const resolver = createResolver({ fetch, parseHtml });
  const first = parseTopicPage(parseHtml(topicPageHtml({ current: 1, count: PAGE_COUNT, entries: makeEntries(1) })));
  const feed = createStoryFeed({ entries: first.entries, page: 1, pageCount: PAGE_COUNT, pageSource, resolver });
  const scheduled = new WeakSet();
  feed.on('change', () => {
    const story = feed.current();
    if (story?.status === 'ready' && story.ref.kind === 'direct' && !scheduled.has(story)) {
      scheduled.add(story);
      later(directFailMs).then(() => feed.markFailed(story));
    }
  });
  feed.start();
  for (;;) {
    await flush();
    await flush();
    timers.sort((a, b) => a.at - b.at || a.seq - b.seq);
    if (timers.length === 0 || timers[0].at > LIMIT_MS) break;
    const timer = timers.shift();
    now = timer.at;
    timer.resolve();
  }
  const gaps = pageStarts.slice(1).map((t, i) => t - pageStarts[i]);
  const minGap = gaps.length ? `${Math.min(...gaps)} ms` : '-';
  const end = timers.length ? '10 dk doldu' : `${Math.round(now / 1000)} sn'de durdu`;
  console.log(`${name}: sayfa ${pageStarts.length}, /img/ ${img}, en kısa aralık ${minGap}, blocked ${feed.state.blocked}, ${end}`);
}

await run({ name: 'S1 100 entry, /img/ 404', perPage: 100, kind: 'eksi' });
await run({ name: 'S2 10 entry, /img/ 404', perPage: 10, kind: 'eksi' });
await run({ name: 'S3 100 entry, /img/ 429 (50 ms)', perPage: 100, kind: 'eksi', imgStatus: 429, imgMs: 50 });
await run({ name: 'S4 100 entry, ölü direkt link (100 ms)', perPage: 100, kind: 'direct' });
await run({ name: 'S5 100 entry, ölü direkt link (3 sn)', perPage: 100, kind: 'direct', directFailMs: 3000 });
```

Run (repo kökünden, ~1 sn sürer): `node "$TMPDIR/sinir-sim.mjs"`
Expected, birebir:

```
S1 100 entry, /img/ 404: sayfa 5, /img/ 600, en kısa aralık 7650 ms, blocked true, 46 sn'de durdu
S2 10 entry, /img/ 404: sayfa 5, /img/ 60, en kısa aralık 1500 ms, blocked true, 8 sn'de durdu
S3 100 entry, /img/ 429 (50 ms): sayfa 5, /img/ 600, en kısa aralık 2750 ms, blocked true, 16 sn'de durdu
S4 100 entry, ölü direkt link (100 ms): sayfa 5, /img/ 0, en kısa aralık 10000 ms, blocked true, 60 sn'de durdu
S5 100 entry, ölü direkt link (3 sn): sayfa 2, /img/ 0, en kısa aralık 300000 ms, blocked false, 10 dk doldu
```

Değişiklikten önce aynı betik ~14 sn sürer, ilk dört satırda `10 dk doldu` yazar ve sayfa sayıları 78, 400, 218, 60 olur. Sonuç beklenenden farklıysa dur ve raporla. Betiği repoya ekleme.

- [ ] **Step 6: Commit**

```bash
git add test/story-feed.test.js src/core/story-feed.js
git commit -m "$(cat <<'EOF'
fix: görselleri açılmayan sayfaları da sayfa sınırına say

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Açılan görseli story akışına bildir, sınır kartını güncelle

**Files:**
- Modify: `test/main.smoke.test.js` (`setup` fonksiyonunun altı, dosya sonu)
- Modify: `src/viewer/viewer.js` (`loadImage` içindeki `image.onload`, `renderCard` içindeki `state.blocked` dalı)

**Interfaces:**
- Consumes:
  - Görev 1'den gelenler:
    - `feed.markOpened(story)`: yalnızca aktif story için çalışır; önden okuma sınırını o görselin sayfasından yeniden sayar.
    - `feed.state.blocked`: sınır dolu ve sonraki sayfa varsa true.
    - Sınır, son açılan görselin sayfasından sonra 5 sayfa yüklenince dolar.
  - `test/main.smoke.test.js` içindeki mevcut yardımcılar:
    - `setup(entries, { count, pages })` → `{ dom, doc, requests, fetchImpl }`. `fetchImpl` her adresi `requests`'e yazar ve CSS'i döndürür. `/img/<id>` için `https://cdn.eksisozluk.com/<id>.jpg` görselli sayfa verir. `pages`'teki sayfaları `${PAGE_URL}?p=N` adresinden verir, diğer adreslere 404 döner.
    - `pageEntries(page)`: sayfa başına 4 entry, her birinde tek `https://soz.lk/i/p<sayfa>n<sıra>` görseli, yazar `sayfa N yazarı`.
    - Ayrıca `PAGE_URL`, `CSS_URL`, `link(href)`, `createPageQueue` (import edili), `deferred()`, `flush()`, `main`.
- Produces:
  - Görüntüleyici, aktif story'nin görseli açılınca (`image.onload`) `feed.markOpened(story)` çağırır.
  - `state.blocked` kartının metni `` `${EMPTY_PAGE_LIMIT} sayfadır açılan görsel yok` `` olur.

- [ ] **Step 1: Başarısız smoke testlerini yaz**

`test/main.smoke.test.js` içinde `setup` fonksiyonunun son satırları:

```js
  return { dom, doc: dom.window.document, requests, fetchImpl };
}
```

Bu iki satırın hemen altına bir boş satır bırakıp ekle:

```js
/** `from`–`to` sayfalarının istek adresleri. */
const pageUrls = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => `${PAGE_URL}?p=${from + i}`);

/** Sahte saatli sayfa isteği sırası: beklemeler hemen biter ve `clock.sleeps`'e yazılır. */
function fakeClockQueue() {
  const clock = { t: 0, sleeps: [] };
  const pageQueue = createPageQueue({
    now: () => clock.t,
    sleep: async (ms) => {
      clock.sleeps.push(ms);
      clock.t += ms;
    },
  });
  return { clock, pageQueue };
}

/** 30 sayfalık başlık, sayfa başına dört görsel. `/img/` istekleri 404 döner; kimliği `acilan` ile başlayan görseller açılır. `pages` sayfaları değiştirir. */
function brokenImagesSetup(pages = {}) {
  const allPages = Object.fromEntries(Array.from({ length: 29 }, (_, i) => [i + 2, pageEntries(i + 2)]));
  const tab = setup(pageEntries(1), { count: 30, pages: { ...allPages, ...pages } });
  const fetchImpl = async (url, init) => {
    if (url.startsWith('https://eksisozluk.com/img/') && !url.startsWith('https://eksisozluk.com/img/acilan')) {
      tab.requests.push(url);
      return { ok: false, status: 404, text: async () => '' };
    }
    return tab.fetchImpl(url, init);
  };
  return { ...tab, fetchImpl };
}
```

Dosyanın sonuna, son testten (`kapatıp hemen yeniden açınca kapanan oturumun sayfası istenmez, sayfa istekleri üst üste binmez`) sonra bir boş satır bırakıp ekle:

```js
test('görselleri açılmayan başlıkta gizli sekme 5 sayfadan sonra durur', async () => {
  const { dom, doc, requests, fetchImpl } = brokenImagesSetup();
  const { clock, pageQueue } = fakeClockQueue();
  const imagePages = deferred();
  const heldFetch = async (url, init) => {
    if (url.startsWith('https://eksisozluk.com/img/')) await imagePages.promise;
    return fetchImpl(url, init);
  };
  await main({ cssUrl: CSS_URL, doc, fetchImpl: heldFetch, pageQueue });
  doc.querySelector('.eksi-stories-button').click();
  for (let i = 0; i < 4; i += 1) await flush();

  const shadow = doc.querySelector('eksi-stories-viewer').shadowRoot;
  const pageRequests = () => requests.filter((url) => url.startsWith(`${PAGE_URL}?`));
  Object.defineProperty(doc, 'hidden', { configurable: true, get: () => true });
  doc.dispatchEvent(new dom.window.Event('visibilitychange'));
  assert.equal(shadow.querySelector('.es-root').classList.contains('is-paused'), true, 'gizli sekmede ekran durur');
  assert.deepEqual(pageRequests(), [], 'görsel sayfaları yanıt vermeden sayfa istenmez');

  imagePages.resolve();
  for (let i = 0; i < 10; i += 1) await flush();
  assert.deepEqual(pageRequests(), pageUrls(2, 6));
  assert.equal(requests.filter((url) => url.startsWith('https://eksisozluk.com/img/')).length, 24);
  assert.deepEqual(clock.sleeps, [1500, 1500, 1500, 1500]);
  assert.equal(shadow.querySelector('.es-card-text').textContent, '5 sayfadır açılan görsel yok');
  const continueButton = [...shadow.querySelectorAll('.es-card-actions button')].find((button) => button.textContent === 'aramaya devam');
  assert.ok(continueButton, 'aramaya devam butonu var');

  continueButton.click();
  for (let i = 0; i < 10; i += 1) await flush();
  assert.deepEqual(pageRequests(), pageUrls(2, 11));
  assert.equal(shadow.querySelector('.es-card-text').textContent, '5 sayfadır açılan görsel yok');
});

test('görsel açılınca önden okuma o görselin sayfasından sürer', async () => {
  const { dom, doc, requests, fetchImpl } = brokenImagesSetup({
    6: [{ id: '601', author: 'sayfa 6 yazarı', content: link('https://soz.lk/i/acilan601') }],
  });
  const { pageQueue } = fakeClockQueue();
  await main({ cssUrl: CSS_URL, doc, fetchImpl, pageQueue });
  doc.querySelector('.eksi-stories-button').click();
  for (let i = 0; i < 10; i += 1) await flush();

  const shadow = doc.querySelector('eksi-stories-viewer').shadowRoot;
  const image = shadow.querySelector('.es-image');
  const pageRequests = () => requests.filter((url) => url.startsWith(`${PAGE_URL}?`));
  assert.equal(shadow.querySelector('.es-author-name').textContent, 'sayfa 6 yazarı');
  assert.equal(image.getAttribute('src'), 'https://cdn.eksisozluk.com/acilan601.jpg');
  assert.deepEqual(pageRequests(), pageUrls(2, 6), 'görsel açılmadan sınır dolar');

  image.dispatchEvent(new dom.window.Event('load')); // jsdom görsel yüklemez, açılma elle tetiklenir
  for (let i = 0; i < 10; i += 1) await flush();
  assert.deepEqual(pageRequests(), pageUrls(2, 7));
});
```

Notlar:
- İlk test bildirilen senaryodur. `/img/` yanıtları `imagePages` bırakılana kadar bekletilir; böylece zincir, ekran gizlenip durduktan sonra başlar.
- `document.hidden` jsdom'da yalnızca okunabilir bir getter'dır; test bunu `Object.defineProperty` ile ezer.
- Sayfa istekleri ve `/img/` istekleri yalnızca mikro görevlerle ilerler; `flush` döngüleri yeterlidir.
- Mevcut testlere ve yardımcılara dokunma.

- [ ] **Step 2: Testlerin başarısız olduğunu gör**

Run: `node --test test/main.smoke.test.js`
Expected: FAIL: `ℹ tests 12`, `ℹ pass 10`, `ℹ fail 2`. Hatalar:
- `görselleri açılmayan başlıkta gizli sekme 5 sayfadan sonra durur`: `AssertionError`, `actual: '5 sayfadır görsel yok'`, `expected: '5 sayfadır açılan görsel yok'`. Sayfa, `/img/` ve bekleme beklentileri Görev 1 sayesinde bu satırdan önce geçer.
- `görsel açılınca önden okuma o görselin sayfasından sürer`: `AssertionError`, `actual` listesi `?p=6`'da biter, `expected` listesinin sonunda `https://eksisozluk.com/deneme-basligi--1000001?p=7` vardır.

- [ ] **Step 3: Görüntüleyiciyi değiştir**

`src/viewer/viewer.js` içinde, `loadImage` fonksiyonundaki `image.onload` işleyicisinin sonu:

```js
      renderProgress(story, true);
      preloadNext();
    };
```

→

```js
      renderProgress(story, true);
      preloadNext();
      feed.markOpened(story);
    };
```

`renderCard` içinde:

```js
      text = `${EMPTY_PAGE_LIMIT} sayfadır görsel yok`;
```

→

```js
      text = `${EMPTY_PAGE_LIMIT} sayfadır açılan görsel yok`;
```

Dosyada başka hiçbir şeyi değiştirme. `image.onerror`, önden yükleme görseli (`preloader`) ve bulanık arka plan (`backdrop`) `markOpened` çağırmaz.

- [ ] **Step 4: Testleri çalıştır**

Run: `node --test test/main.smoke.test.js`
Expected: PASS: `ℹ tests 12`, `ℹ pass 12`, `ℹ fail 0`

Run: `npm test`
Expected: PASS: `ℹ tests 95`, `ℹ pass 95`, `ℹ fail 0`

- [ ] **Step 5: Commit**

```bash
git add test/main.smoke.test.js src/viewer/viewer.js
git commit -m "$(cat <<'EOF'
fix: açılan görseli story akışına bildir, sınır kartında açılan görsel yok de

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Playground senaryosu, README ve spec notları

**Files:**
- Modify: `dev/playground.js` (`SCENARIOS` listesinin sonu)
- Modify: `README.md:43`, `README.md:63`
- Modify: `docs/superpowers/specs/2026-09-14-eksi-stories-design.md:7` (altına satır)
- Modify: `docs/superpowers/specs/2026-09-16-sayfa-gostergesi-design.md:5` (altına satır)
- Modify: `docs/superpowers/specs/2026-09-17-istek-sirasi-sinirlari-design.md:4` (altına satır)
- Modify: `docs/superpowers/specs/2026-09-16-eksi-dili-metinler-design.md:4` (altına satır)

**Interfaces:**
- Consumes:
  - Görev 1 ve 2'nin davranışı: görselleri açılmayan sayfalar sayfa sınırına sayılır, görüntüleyici açılan görseli bildirir, kart metni `5 sayfadır açılan görsel yok`.
  - `dev/playground.js` içindeki mevcut adlar:
    - `makeEntry(imageUrls, text)`: direkt görsel referanslı entry.
    - `svgImage(shape, hue)`: çalışan bir `data:` görseli üretir.
    - `SHAPES`: altı şekil.
    - `BROKEN_IMAGE`: açılmayan `data:` görseli.
    - `fakePageSource({ entries, pages })`: 300 ms gecikmeli sahte sayfa kaynağı.
- Produces: yok

- [ ] **Step 1: Playground senaryosunu ekle**

`dev/playground.js` içinde `SCENARIOS` listesinin sonu:

```js
    failOnce: [2],
  })],
];
```

→

```js
    failOnce: [2],
  })],
  ['açılmayan görseller → aramaya devam', () => ({
    entries: [makeEntry([svgImage(SHAPES[1], 150)], 'sonrasında görselleri açılmayan 5 sayfa var')],
    pages: [...Array.from({ length: 5 }, () => [makeEntry([BROKEN_IMAGE])]), [makeEntry([svgImage(SHAPES[3], 270)], 'aramaya devam edince bulundu')]],
  })],
];
```

Senaryo `?scenario=5` ile açılır. 1. sayfanın görseli açılır. 2–6. sayfaların görselleri açılmaz. 6. sayfadan sonra `5 sayfadır açılan görsel yok` kartı çıkar. `aramaya devam` 7. sayfanın görselini açar.

- [ ] **Step 2: README'yi güncelle**

`README.md`, "kurallar" bölümünde:

```markdown
- siteyi yormaz: her sekmede sayfa istekleri arasında en az 1,5 saniye bekler, aynı anda tek sayfa ister, görsel sayfalarını en fazla ikişer açar, 5 görselsiz sayfadan sonra durur.
```

→

```markdown
- siteyi yormaz: her sekmede sayfa istekleri arasında en az 1,5 saniye bekler, aynı anda tek sayfa ister, görsel sayfalarını en fazla ikişer açar, 5 sayfa boyunca görsel açılmazsa durur.
```

"geliştirme" bölümünde:

```markdown
playground ekşi'ye hiç istek atmadan sahte görsellerle açılır: `?scenario=0` … `?scenario=4`.
```

→

```markdown
playground ekşi'ye hiç istek atmadan sahte görsellerle açılır: `?scenario=0` … `?scenario=5`.
```

README'de başka satıra dokunma; "elle test" listesi aynı kalır.

- [ ] **Step 3: Eski spec'lere not ekle**

`docs/superpowers/specs/2026-09-14-eksi-stories-design.md` içinde şu satırın:

```markdown
Not: §2.2 istek disiplini sekme başına geçerlidir; bkz. 2026-09-17-istek-sirasi-sinirlari-design.md.
```

hemen altına ekle:

```markdown
Not: §2.2, §4, §5 ve §10'daki 5 görselsiz sayfa sınırı 2026-09-17-acilmayan-gorsel-siniri-design.md ile "son açılan görselin sayfasından sonra 5 sayfa" oldu; görselleri açılmayan sayfalar da sayılır.
```

`docs/superpowers/specs/2026-09-16-sayfa-gostergesi-design.md` içinde şu satırın:

```markdown
Not: §6 sayfa kaynağının sırası ve istek aralığı 2026-09-17-ortak-istek-sirasi-design.md ile sekme başına ortak sıraya taşındı; §7'deki `main` imzasına isteğe bağlı `pageQueue` parametresi eklendi.
```

hemen altına ekle:

```markdown
Not: §6'daki boş sayfa sayacı 2026-09-17-acilmayan-gorsel-siniri-design.md ile değişti: atlamada sayım hedef sayfadan başlar, hedef sayfa yine sayılmaz.
```

`docs/superpowers/specs/2026-09-17-istek-sirasi-sinirlari-design.md` içinde şu satırın:

```markdown
Durum: Onaylandı (brainstorming sonucu). Plan yazılırken §5'teki test beklentisi netleştirildi. Son incelemeden sonra §2.1, §2.2 ve §7 düzeltildi: görseli açılmayan story gizli sekmede de atlanır ve sayfa isteyebilir.
```

hemen altına ekle:

```markdown
Not: §2.1 ve §7'de kapsam dışı bırakılan açılmayan görsel konusu 2026-09-17-acilmayan-gorsel-siniri-design.md ile ele alındı.
```

`docs/superpowers/specs/2026-09-16-eksi-dili-metinler-design.md` içinde şu satırın:

```markdown
Durum: Bölümler kullanıcıyla onaylandı, spec incelemesi bekliyor
```

hemen altına ekle:

```markdown
Not: §4'teki boş sayfa sınırı kartı 2026-09-17-acilmayan-gorsel-siniri-design.md ile `${EMPTY_PAGE_LIMIT} sayfadır açılan görsel yok` oldu.
```

Dört spec'in gövdesine dokunma. PRIVACY, `store/` ve CHANGELOG değişmez.

- [ ] **Step 4: Değişiklikleri doğrula**

Run: `node --check dev/playground.js`
Expected: çıktı yok, çıkış kodu 0.

Run: `grep -n "görsel açılmazsa durur" README.md`
Expected: tek satır; `43:- siteyi yormaz: her sekmede sayfa istekleri arasında …` ile başlar.

Run: `grep -n "scenario=5" README.md`
Expected: tek satır, `63:` ile başlar.

Run: `grep -c "2026-09-17-acilmayan-gorsel-siniri-design.md" docs/superpowers/specs/2026-09-14-eksi-stories-design.md docs/superpowers/specs/2026-09-16-sayfa-gostergesi-design.md docs/superpowers/specs/2026-09-17-istek-sirasi-sinirlari-design.md docs/superpowers/specs/2026-09-16-eksi-dili-metinler-design.md`
Expected: dört dosya için de `:1`.

Run: `grep -rnE "görselsiz sayfadan sonra durur|sayfadır görsel yok" README.md PRIVACY.md CHANGELOG.md store src dev`
Expected: çıktı yok (çıkış kodu 1).

Run: `git diff --stat`
Expected: yalnızca `README.md`, `dev/playground.js` ve dört spec; özet satırı `6 files changed, 10 insertions(+), 2 deletions(-)`.

Run: `npm test`
Expected: PASS: `ℹ tests 95`, `ℹ pass 95`, `ℹ fail 0`

- [ ] **Step 5: Commit**

```bash
git add dev/playground.js README.md docs/superpowers/specs/2026-09-14-eksi-stories-design.md docs/superpowers/specs/2026-09-16-sayfa-gostergesi-design.md docs/superpowers/specs/2026-09-17-istek-sirasi-sinirlari-design.md docs/superpowers/specs/2026-09-16-eksi-dili-metinler-design.md
git commit -m "$(cat <<'EOF'
docs: playground'a açılmayan görseller senaryosu ekle, yeni sayfa sınırını belgelere yaz

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Teslim (görevlerden sonra; alt ajana verilmez)

Kullanıcıya soruları AskUserQuestion ile sor.

1. Dalın kapsamını doğrula.
   Run: `git diff --stat main...HEAD`
   Expected: yalnızca şu 12 dosya:
   - `README.md`
   - `dev/playground.js`
   - `docs/superpowers/plans/2026-09-17-acilmayan-gorsel-siniri.md`
   - `docs/superpowers/specs/2026-09-14-eksi-stories-design.md`
   - `docs/superpowers/specs/2026-09-16-eksi-dili-metinler-design.md`
   - `docs/superpowers/specs/2026-09-16-sayfa-gostergesi-design.md`
   - `docs/superpowers/specs/2026-09-17-acilmayan-gorsel-siniri-design.md`
   - `docs/superpowers/specs/2026-09-17-istek-sirasi-sinirlari-design.md`
   - `src/core/story-feed.js`
   - `src/viewer/viewer.js`
   - `test/main.smoke.test.js`
   - `test/story-feed.test.js`
2. Bütün dalın son incelemesini yaptır (superpowers:requesting-code-review). Bulgular için bir düzeltme turu yap.
3. Playground'u uygulama içi tarayıcıda kontrol et (spec §10.4).
   - Worktree'nin `.claude/launch.json` dosyasında `node scripts/serve.mjs` çalıştıran, `port` değeri 5173 ve `url` değeri `http://127.0.0.1:5173` olan `playground` yapılandırması olmalı. Yoksa oluştur; `.claude/` git'te yok sayılır. `preview_start` ile başlat.
   - `http://127.0.0.1:5173/dev/playground.html?scenario=5` adresini aç ve şu betiği `javascript_tool` ile çalıştır:

   ```js
   const until = async (check, ms = 12000) => { const end = performance.now() + ms; while (performance.now() < end) { if (check()) return true; await new Promise((r) => setTimeout(r, 50)); } return false; };
   await until(() => document.querySelector('eksi-stories-viewer'));
   const s = document.querySelector('eksi-stories-viewer').shadowRoot;
   await until(() => s.querySelector('.es-pager-select').options.length === 7 && !s.querySelector('.es-frame').classList.contains('is-loading'));
   const started = performance.now();
   const events = [];
   const snapshot = () => {
     const parts = [];
     if (!s.querySelector('.es-card').hidden) parts.push(`kart: ${s.querySelector('.es-card-text').textContent}`);
     else parts.push(`story: ${s.querySelector('.es-caption').textContent || '(yazısız)'} / sayfa ${s.querySelector('.es-pager-select').value}`);
     if (!s.querySelector('.es-toast').hidden) parts.push(`bildirim: ${s.querySelector('.es-toast').textContent}`);
     return parts.join(' | ');
   };
   const record = () => {
     const label = snapshot();
     if (events[events.length - 1]?.label !== label) events.push({ at: Math.round(performance.now() - started), label });
   };
   const observer = new MutationObserver(record);
   observer.observe(s, { subtree: true, childList: true, attributes: true, characterData: true });
   record();
   window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
   await until(() => !s.querySelector('.es-card').hidden && s.querySelector('.es-card-text').textContent.includes('sayfadır'));
   record();
   observer.disconnect();
   const buttons = [...s.querySelectorAll('.es-card-actions button')].map((b) => b.textContent);
   const pageAtCard = s.querySelector('.es-pager-select').value;
   [...s.querySelectorAll('.es-card-actions button')].find((b) => b.textContent === 'aramaya devam').click();
   const found = await until(() => s.querySelector('.es-card').hidden && !s.querySelector('.es-frame').classList.contains('is-loading'));
   ({ events: events.map((e) => `${e.at} ms ${e.label}`), buttons, pageAtCard, found, caption: s.querySelector('.es-caption').textContent, page: s.querySelector('.es-pager-select').value })
   ```

   - Beklenenler:
     - `events` listesi `story: sonrasında görselleri açılmayan 5 sayfa var / sayfa 1` ile başlar.
     - Listede `bildirim: görsel açılmadı, geçildi` geçer.
     - Liste `kart: 5 sayfadır açılan görsel yok` ile biter. Pane gizliyse sahte sayfalar yavaş gelir ve arada `kart: sonraki sayfa yükleniyor…` görülebilir.
     - `buttons` `['aramaya devam', 'kapat']`, `pageAtCard` `'6'`, `found` `true`, `caption` `'aramaya devam edince bulundu'`, `page` `'7'` olur.
   - `?scenario=3` ("boş sayfalar") için de ArrowRight gönder. Kart metni `5 sayfadır açılan görsel yok` olmalı, `aramaya devam` `aramaya devam edince bulundu` yazılı görseli açmalı.
   - Pane gizliyken `document.hidden` true olur ve CSS animasyonları çalışmaz; story kendiliğinden geçmez. Bu yüzden ilerlemek için ArrowRight gönderilir. İş bitince `preview_stop` ile sunucuyu kapat.
4. Canlı Chrome kontrolü gerekmez (spec §10.6): görseller açılırken davranış değişmez ve görüntüleyici bağlantısı 3. adımda gerçek tarayıcıda görülür. Kullanıcı isterse eklentiyi ve ekşi sekmesini yenilettikten sonra bir başlıkta story açılır. → ile sayfanın sonuna gidilir; sonraki sayfanın geldiği ve kart çıkmadığı görülür.
5. Birleştirme ve push kararı kullanıcıdadır (superpowers:finishing-a-development-branch). Push yalnızca açık onayla yapılır.
