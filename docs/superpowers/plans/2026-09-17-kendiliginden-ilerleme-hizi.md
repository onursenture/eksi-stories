# kendiliğinden ilerleme hızı: uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ekran kendiliğinden ilerlerken siteye giden istekleri normal oynatma hızına bağlamak. Açılmayan görsel 5 sn'lik sırasını bekleyecek, önden okuma da sekme başına haklarla gidecek.

**Architecture:**
- **Story akışı** (`src/core/story-feed.js`) açılmayan story'yi atlamaz.
  - `markFailed` yalnızca durumu yazar; gezinme her story'ye uğrar.
  - `skipped` olayı ve bütün atlama kodu kalkar.
- **Görüntüleyici** (`src/viewer/viewer.js`) açılmayan story'de yükleniyor kutusunu korur.
  - Ortada `görsel açılmadı` yazar, bulanık arka planı boşaltır ve çizgiyi başlatır. Mevcut `animationend` → `feed.next()` yolu geçişi yapar.
  - Bildirim (`.es-toast`, `TOAST_MS`) kalkar.
- **Sayfa sırası** (`createPageQueue` in `src/core/page-source.js`) önden okuma için milisaniye bütçesi tutar.
  - `EMPTY_PAGE_LIMIT` hak vardır, her `STORY_DURATION_MS`'de bir hak dolar.
  - `createPageSource` yalnızca `next()` isteklerini hakla işaretler.

**Tech Stack:** Vanilla JS (MV3 Chrome eklentisi, build yok), Node.js `node:test`, jsdom.

**Spec:** [docs/superpowers/specs/2026-09-17-kendiliginden-ilerleme-hizi-design.md](../specs/2026-09-17-kendiliginden-ilerleme-hizi-design.md)

> Plan kodu `ae2ccf0` üzerinde, repodan bağımsız temiz bir kopyada baştan sona denendi:
> - Her kırmızı ve yeşil çıktı ile test sayıları gözlendi.
> - Yeni ve değişen testlerin her biri, kodun ilgili satırı bilerek bozulunca düştü: story akışında 5, görüntüleyicide 8, sayfa sırasında 7 bozma denendi.
> - 97 test art arda 10 çalıştırmada geçti.
> - Simülasyon değişiklikten önce ve sonra çalıştırıldı.
> - Playground uygulama içi tarayıcıda denendi:
>   - senaryo 1'de açılmayan story'nin görünüşü;
>   - senaryo 5'te beş açılmayan story, kart ve `aramaya devam`;
>   - senaryo 0, 3 ve 4 değişmeden.

## Global Constraints

- İstek kurallarının değerleri değişmez:
  - aynı anda tek sayfa isteği;
  - istek başlangıçları arasında en az `PAGE_MIN_GAP_MS` = 1500 ms;
  - 429/5xx/ağ hatasında `PAGE_RETRY_DELAY_MS` = 5000 ms sonra bir tekrar;
  - `RESOLVE_CONCURRENCY` = 2, `EMPTY_PAGE_LIMIT` = 5, `STORY_DURATION_MS` = 5000.
- `src/core/constants.js`'ten yalnızca `TOAST_MS` kalkar. Yeni sabit eklenmez.
- Şu dosyalar değişmez: `src/core/image-resolver.js`, `src/core/entry-parser.js`, `src/core/image-links.js`, `src/content/*`, `dev/*`, `manifest.json`, `store/*`, `PRIVACY.md`, `CHANGELOG.md`.
- Kurallar (spec §3):
  - Açılmayan görsel atlanmaz, 5 sn'lik sırasını bekler. Durdurma nedenleri (gizli sekme, boşluk, basılı tutma, açık yazı, odaktaki sayfa kutusu) onun süresini de durdurur.
  - Önden okuma (`next()`) istekleri hak harcar: 5 hak, her 5 sn'de bir hak dolar, hak yoksa beklenir.
  - Sayfa atlama (`load()`) hak harcamaz. Hakları yalnızca zaman doldurur. Beklerken iptal edilen istek hak harcamaz.
  - Açılmayan story'de yükleniyor kutusu kalır, ortada `görsel açılmadı` yazar, bulanık arka plan boşalır.
- Şunlar yazılmaz:
  - 429/5xx görsel hatasını kalıcı önbellekten çıkarmak;
  - zaman aşımı;
  - `aramaya devam`ın hak doldurması;
  - sekmeler arası sıra;
  - yeni playground senaryosu.
- Önceki kararlar aynı kalır: kapatmak hiçbir beklemeyi kısaltmaz, uçuştaki istek kesilmez; sıra sekme başınadır.
- Kullanıcıya görünen metinler ekşi arayüz dilindedir: küçük harf, kısa, sade. Yeni tek metin `görsel açılmadı`.
- Eski spec'lerin gövdesi değişmez; yalnızca başlarına `Not:` satırı eklenir.
- Kod yorumları ve test adları Türkçedir. Test adları küçük harfle başlar. Yorumlar, dosyadaki mevcut yorumların üslubunu (cümle başı büyük harf) ve yoğunluğunu izler.
- Commit mesajları şu satırla biter: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Kullanıcıya sormadan push yapılmaz.

## Dosya haritası

| dosya | değişiklik | görev |
|---|---|---|
| `test/story-feed.test.js` | `walk` yardımcısı; atlama testlerinin yerine 2 test; 4 sınır testi `walk` ile | 1 |
| `test/main.smoke.test.js` | `brokenImagesSetup` 1. sayfayı da değiştirebilir; son iki test yeniden yazılır | 1 |
| `src/core/story-feed.js` | atlama kodu, `skipped`, `direction`, `announced`, `playableFrom`, `forwardFrom` kalkar; `markFailed` index'i oynatmaz | 1 |
| `src/viewer/viewer.js` | `görsel açılmadı` yazısı ve `showFailed`; bildirim kalkar | 1 |
| `src/viewer/viewer.css` | `.es-failed` eklenir, `.es-toast` kalkar | 1 |
| `src/core/constants.js` | `TOAST_MS` kalkar | 1 |
| `test/page-source.test.js` | 3 yeni test | 2 |
| `src/core/page-source.js` | `createPageQueue` hak bütçesi, `pace(signal, { fetchAhead })`; `next()` hakla gider | 2 |
| `README.md` | "siteyi yormaz" maddesi | 3 |
| altı eski spec | `Not:` satırı | 3 |

Test sayısı: başlangıçta 96, Görev 1 sonunda 94, Görev 2 sonunda 97, Görev 3 sonunda 97.

---

### Task 1: Açılmayan görsel sırasını bekler

**Files:**
- Modify: `test/story-feed.test.js` (`brokenIds` satırının altı; dört atlama testi; dört sınır testi)
- Modify: `test/main.smoke.test.js` (`brokenImagesSetup`; dosyanın son iki testi)
- Modify: `src/core/story-feed.js`
- Modify: `src/viewer/viewer.js`
- Modify: `src/viewer/viewer.css`
- Modify: `src/core/constants.js`

**Interfaces:**
- Consumes (mevcut test yardımcıları):
  - `test/story-feed.test.js`:
    - `entry(id, imageIds)`: entry nesnesi; görseller `{ kind: 'eksi', id }`.
    - `noImagePage()`: görselsiz tek entry'lik sayfa.
    - `brokenPages(from, to)`: sayfa başına açılmayan tek görsel, kimliği `x<sayfa>`.
    - `brokenIds(to)`: `x1`–`x<to>`.
    - `fakeResolver(fail)`: `fail` içindeki kimlikleri reddeder, diğerlerini `https://cdn.test/<id>.jpg` adresine çözer.
    - `makeFeed({ entries, results, count, fail })` → `{ feed, resolver, pageSource }`. `pageSource.calls` istenen sonraki sayfaların listesidir.
    - `flush()`.
  - `test/main.smoke.test.js`:
    - `setup(entries, { count, pages })` → `{ dom, doc, requests, fetchImpl }`. `fetchImpl` her adresi `requests`'e yazar ve `/img/<id>` için `https://cdn.eksisozluk.com/<id>.jpg` görselli sayfa verir.
    - `pageEntries(page)`: 4 entry, her birinde tek `https://soz.lk/i/p<sayfa>n<sıra>` görseli, yazar `sayfa N yazarı`.
    - `pageUrls(from, to)`, `fakeClockQueue()` → `{ clock, pageQueue }`.
    - `brokenImagesSetup(pages)`: 30 sayfalık başlık; kimliği `acilan` ile başlamayan `/img/` istekleri 404 döner.
    - `PAGE_URL`, `CSS_URL`, `link(href)`, `main`, `flush`, `deferred`.
- Produces:
  - `feed.markFailed(story)`: yalnızca `status = 'failed'` ve `resolvedUrl = null` yapar, `ensureAhead()` çalıştırır ve `change` yayar. Aktif story yerinde kalır. Story zaten `failed` ise hiçbir şey yapmaz.
  - `feed.start()`, `next()`, `prev()`, `goTo()`, `goToPage()` açılmayan story'leri atlamaz. `next()` sonun ötesine kadar gider, `prev()` 0'da kalır.
  - `feed.on` yalnızca `'change'` olayını destekler; `'skipped'` yoktur.
  - Görüntüleyici `.es-failed` öğesini (`role="status"`) kutunun içinde tutar. Açılmayan story'de görünür ve metni `görsel açılmadı` olur. `.es-toast` yoktur.
  - `TOAST_MS` sabiti yoktur.

- [ ] **Step 1: Story akışı testlerini yaz**

`test/story-feed.test.js` içinde şu satırlar:

```js
/** `fakeResolver`'da açılmayacak `x1`–`x<to>` kimlikleri. */
const brokenIds = (to) => Array.from({ length: to }, (_, i) => `x${i + 1}`);
```

Bu iki satırın hemen altına bir boş satır bırakıp ekle:

```js
/** Açılmayan story'ler atlanmadığı için `next()` ile yürür: her adımdan önce bekleyen işler biter; `until` doğru olunca ya da sonun ötesinde durur. */
async function walk(feed, until = () => false) {
  for (let step = 0; step < 50; step += 1) {
    for (let i = 0; i < 8; i += 1) await flush();
    if (!feed.current() || until(feed.current())) return;
    feed.next();
  }
}
```

Aynı dosyada art arda duran şu dört testi tamamen sil. Silinecek bölüm `test('başarısız olduğu bilinen story gezinmede atlanır', async () => {` satırıyla başlar ve `test("prev ilk story'de kalır, goTo(0) başa döner", () => {` satırının hemen önündeki boş satırla biter:
- `başarısız olduğu bilinen story gezinmede atlanır`
- `aktif story başarısız olunca atlanır ve skipped yayılır`
- `tamamen başarısız grup tek bildirim verir, geri dönünce tekrar bildirilmez`
- `geri giderken başarısız story geriye atlanır; geride yoksa ileri gidilir`

Silinen yere, `test("prev ilk story'de kalır, goTo(0) başa döner", () => {` satırının hemen önüne yaz:

```js
test('açılmayan story gezinmede atlanmaz', async () => {
  const { feed } = makeFeed({ entries: [entry('1', ['a', 'bad', 'c'])], fail: ['bad'] });
  feed.start();
  await flush();
  feed.next();
  assert.equal(feed.current().ref.id, 'bad');
  assert.equal(feed.current().status, 'failed');
  feed.next();
  assert.equal(feed.current().ref.id, 'c');
  feed.prev();
  assert.equal(feed.current().ref.id, 'bad');
});

test('aktif story açılmayınca yerinde kalır', async () => {
  const { feed } = makeFeed({ entries: [entry('1', ['bad', 'b'])], fail: ['bad'] });
  let changes = 0;
  feed.on('change', () => {
    changes += 1;
  });
  feed.start();
  const afterStart = changes;
  await flush();
  assert.equal(feed.current().ref.id, 'bad');
  assert.equal(feed.current().status, 'failed');
  assert.ok(changes > afterStart, 'change yayılır');

  const beforeRepeat = changes;
  feed.markFailed(feed.current());
  assert.equal(changes, beforeRepeat, 'ikinci markFailed etkisiz');
  assert.equal(feed.current().ref.id, 'bad');

  feed.next();
  assert.equal(feed.current().ref.id, 'b');
});

```

Görseli açılmayan sayfalarla kurulan dört sınır testinde `flush` döngülerini `walk` ile değiştir.

`görselleri açılmayan sayfalar da 5 sayfa sınırına sayılır` içinde:

```js
  feed.start();
  for (let i = 0; i < 8; i += 1) await flush();
  assert.deepEqual(pageSource.calls, [2, 3, 4, 5, 6]);
  assert.equal(feed.current(), null);
  assert.equal(feed.state.blocked, true);
  assert.equal(feed.state.ended, false);

  feed.continueSearching();
  for (let i = 0; i < 8; i += 1) await flush();
  assert.deepEqual(pageSource.calls, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
```

→

```js
  feed.start();
  await walk(feed);
  assert.deepEqual(pageSource.calls, [2, 3, 4, 5, 6]);
  assert.equal(feed.current(), null);
  assert.equal(feed.state.blocked, true);
  assert.equal(feed.state.ended, false);

  feed.continueSearching();
  await walk(feed);
  assert.deepEqual(pageSource.calls, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
```

`görsel açılınca sayım o görselin sayfasından yeniden başlar` içinde:

```js
  feed.start();
  for (let i = 0; i < 8; i += 1) await flush();
  assert.equal(feed.current().ref.id, 'ok4');
```

→

```js
  feed.start();
  await walk(feed, (story) => story.ref.id === 'ok4');
  assert.equal(feed.current().ref.id, 'ok4');
```

aynı testin sonunda:

```js
  feed.next();
  for (let i = 0; i < 8; i += 1) await flush();
  assert.deepEqual(pageSource.calls, [2, 3, 4, 5, 6, 7, 8, 9]);
```

→

```js
  await walk(feed);
  assert.deepEqual(pageSource.calls, [2, 3, 4, 5, 6, 7, 8, 9]);
```

`aktif olmayan story için markOpened yok sayılır` içinde:

```js
  feed.start();
  for (let i = 0; i < 8; i += 1) await flush();
  assert.equal(feed.state.blocked, true);

  feed.markOpened(feed.peek(-1));
```

→

```js
  feed.start();
  await walk(feed);
  assert.equal(feed.state.blocked, true);

  feed.markOpened(feed.peek(-1));
```

`tampondaki sayfaya geçiş sayfa sınırını sıfırlamaz` içinde:

```js
  feed.start();
  for (let i = 0; i < 8; i += 1) await flush();
  assert.equal(feed.state.blocked, true);

  feed.goToPage(3);
  for (let i = 0; i < 8; i += 1) await flush();
  assert.deepEqual(pageSource.calls, [2, 3, 4, 5, 6]);
```

→

```js
  feed.start();
  await walk(feed);
  assert.equal(feed.state.blocked, true);

  feed.goToPage(3);
  await walk(feed);
  assert.deepEqual(pageSource.calls, [2, 3, 4, 5, 6]);
```

Notlar:
- Açılmayan story'ler artık yerinde kaldığı için sınıra `next()` ile yürüyerek varılır.
- `walk` bugünkü kodda da aynı sonuçları verir; dört test değişiklikten önce de sonra da geçer.
- `tampondaki sayfaya geçiş…` testinde `goToPage(3)` sonrasındaki `walk`, sınır sıfırlansaydı istenecek 7. ve 8. sayfaları görünür kılar.
- `atlamada açılan görselin sayfası sıfırlanır` testinde açılmayan görsel yok; ona ve diğer testlere dokunma.

- [ ] **Step 2: Smoke testlerini yaz**

`test/main.smoke.test.js` içinde `brokenImagesSetup` fonksiyonunun başı:

```js
/** 30 sayfalık başlık, sayfa başına dört görsel. `/img/` istekleri 404 döner; kimliği `acilan` ile başlayan görseller açılır. `pages` sayfaları değiştirir. */
function brokenImagesSetup(pages = {}) {
  const allPages = Object.fromEntries(Array.from({ length: 29 }, (_, i) => [i + 2, pageEntries(i + 2)]));
  const tab = setup(pageEntries(1), { count: 30, pages: { ...allPages, ...pages } });
```

→

```js
/** 30 sayfalık başlık, sayfa başına dört görsel. `/img/` istekleri 404 döner; kimliği `acilan` ile başlayan görseller açılır. `pages` sayfaları, 1. sayfa dahil, değiştirir. */
function brokenImagesSetup(pages = {}) {
  const allPages = Object.fromEntries(Array.from({ length: 29 }, (_, i) => [i + 2, pageEntries(i + 2)]));
  const tab = setup(pages[1] ?? pageEntries(1), { count: 30, pages: { ...allPages, ...pages } });
```

Dosyanın son iki testini tamamen sil. Silinecek bölüm `test('görselleri açılmayan başlıkta gizli sekme 5 sayfadan sonra durur', async () => {` satırından dosyanın sonuna kadar gider; `görsel açılınca önden okuma o görselin sayfasından sürer` testini de kapsar. Yerine yaz:

```js
test('açılmayan görsel ekranda kalır, süresi dolunca sonraki story gelir', async () => {
  const { dom, doc, requests, fetchImpl } = brokenImagesSetup({
    1: [{ id: '101', author: 'sayfa 1 yazarı', content: link('https://soz.lk/i/acilan101') }, ...pageEntries(1).slice(1)],
  });
  const { pageQueue } = fakeClockQueue();
  await main({ cssUrl: CSS_URL, doc, fetchImpl, pageQueue });
  doc.querySelector('.eksi-stories-button').click();
  for (let i = 0; i < 10; i += 1) await flush();

  const shadow = doc.querySelector('eksi-stories-viewer').shadowRoot;
  const counter = () => shadow.querySelector('.es-counter').textContent;
  const activeFill = () => shadow.querySelector('.es-seg.is-active .es-seg-fill');
  const backdrop = shadow.querySelector('.es-backdrop');
  const pageRequests = () => requests.filter((url) => url.startsWith(`${PAGE_URL}?`));
  const imageRequests = () => requests.filter((url) => url.startsWith('https://eksisozluk.com/img/'));
  /** jsdom animasyon çalıştırmaz: aktif çizginin bitişi elle tetiklenir. */
  const finishStory = () => {
    assert.ok(activeFill(), 'çizgi dolmaya başladı');
    const ended = new dom.window.Event('animationend', { bubbles: true });
    Object.defineProperty(ended, 'animationName', { value: 'es-fill' });
    activeFill().dispatchEvent(ended);
  };
  const settle = async () => {
    for (let i = 0; i < 10; i += 1) await flush();
  };

  shadow.querySelector('.es-image').dispatchEvent(new dom.window.Event('load')); // jsdom görsel yüklemez, açılma elle tetiklenir
  assert.equal(backdrop.getAttribute('src'), 'https://cdn.eksisozluk.com/acilan101.jpg');
  assert.equal(imageRequests().length, 3);

  finishStory();
  const failedFill = activeFill();
  await settle();
  const failed = shadow.querySelector('.es-failed');
  assert.equal(counter(), '2/4', 'açılmayan story atlanmaz');
  assert.ok(failed, 'görsel açılmadı yazısı var');
  assert.equal(failed.hidden, false);
  assert.equal(failed.textContent, 'görsel açılmadı');
  assert.equal(shadow.querySelector('.es-stage > .es-spinner').hidden, true);
  assert.equal(backdrop.hasAttribute('src'), false, 'arka plan boşalır');
  assert.equal(shadow.querySelector('.es-toast'), null, 'geçildi bildirimi yok');
  assert.equal(activeFill(), failedFill, 'yeni yanıtlar çizgiyi baştan başlatmaz');
  assert.equal(imageRequests().length, 4);
  assert.deepEqual(pageRequests(), pageUrls(2, 2));

  finishStory();
  await settle();
  assert.equal(counter(), '3/4');
  assert.equal(failed.hidden, false);

  dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowLeft' }));
  dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowLeft' }));
  assert.equal(counter(), '1/4');
  assert.equal(failed.hidden, true, 'açılan görsele dönünce yazı kalkar');
});

test('görsel açılınca önden okuma o görselin sayfasından sürer', async () => {
  const noImagePages = Object.fromEntries(Array.from({ length: 29 }, (_, i) => [i + 2, [{ id: `${i + 2}01`, content: 'görselsiz' }]]));
  const { dom, doc, requests, fetchImpl } = setup([{ id: '101', content: 'görselsiz' }], {
    count: 30,
    pages: { ...noImagePages, 6: [{ id: '601', author: 'sayfa 6 yazarı', content: link('https://soz.lk/i/acilan601') }] },
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
  assert.deepEqual(pageRequests(), pageUrls(2, 11), 'sayım açılan görselin sayfasından yeniden başlar');
});
```

Notlar:
- İlk testte 1. sayfanın ilk görseli açılır (`acilan101`), diğer bütün görseller açılmaz. Açılmayan 2. story, açılıştaki önden çözümlemede zaten `failed` olmuştur.
- Bugünkü kod `next()` ile açılmayan story'leri atladığı için sayaç `2/4` yerine `4/4` gösterir.
- `animationend` olayını jsdom'un `AnimationEvent`'i olmadığı için düz `Event` ile, `animationName` alanını `Object.defineProperty` ile kurarak gönder.
- İkinci test `markOpened` bağlantısını açılmayan görsellere dayanmadan sabitler ve bugünkü kodda da geçer. 7. sayfadan sonrası görselsiz olduğu için sayım 6. sayfadan yeniden başlar; 7–11. sayfalar istenir.
- `deferred` içe aktarımını silme: `kapatıp hemen yeniden açınca…` testi kullanıyor.
- Diğer testlere ve yardımcılara dokunma.

- [ ] **Step 3: Testlerin başarısız olduğunu gör**

Run: `node --test test/story-feed.test.js`
Expected: FAIL: `ℹ tests 31`, `ℹ pass 29`, `ℹ fail 2`. Hatalar:
- `açılmayan story gezinmede atlanmaz`: `AssertionError`, `actual: 'c'`, `expected: 'bad'`.
- `aktif story açılmayınca yerinde kalır`: `AssertionError`, `actual: 'b'`, `expected: 'bad'`.

Run: `node --test test/main.smoke.test.js`
Expected: FAIL: `ℹ tests 12`, `ℹ pass 11`, `ℹ fail 1`. Hata:
- `açılmayan görsel ekranda kalır, süresi dolunca sonraki story gelir`: `AssertionError [ERR_ASSERTION]: açılmayan story atlanmaz`, `actual: '4/4'`, `expected: '2/4'`.

- [ ] **Step 4: Story akışında atlamayı kaldır**

`src/core/story-feed.js` içinde sırayla şu değişiklikleri yap.

Durum değişkenleri:

```js
  const resolving = new WeakSet();
  const announced = new WeakSet();
  const listeners = { change: new Set(), skipped: new Set() };
  let index = 0;
  let direction = 1;
  let knownPageCount = pageCount;
```

→

```js
  const resolving = new WeakSet();
  const listeners = { change: new Set() };
  let index = 0;
  let knownPageCount = pageCount;
```

Şu iki fonksiyonu, altlarındaki boş satırla birlikte tamamen sil:

```js
  /** `start`tan `step` yönünde ilk başarısız olmayan index; geride yoksa -1, ileride yoksa >= length. */
  function playableFrom(start, step) {
    let i = start;
    while (i >= 0 && i < stories.length && stories[i].status === 'failed') i += step;
    return i;
  }

  function forwardFrom(start) {
    return Math.min(playableFrom(Math.max(start, 0), 1), stories.length);
  }

```

`moveTo`, `start`, `next`, `prev` ve `goTo`:

```js
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
```

→

```js
  function moveTo(newIndex) {
    index = newIndex;
    ensureAhead();
    emit('change');
  }

  function start() {
    if (started) return;
    started = true;
    moveTo(0);
  }

  function next() {
    moveTo(Math.min(index + 1, stories.length));
  }

  function prev() {
    moveTo(Math.max(index - 1, 0));
  }

  function goTo(target) {
    moveTo(Math.min(Math.max(target, 0), stories.length));
  }
```

`goToPage` içinde, tampondaki sayfaya geçiş:

```js
      const first = stories.findIndex((story) => story.page >= target);
      direction = 1;
      moveTo(forwardFrom(first === -1 ? stories.length : first), false);
      return;
```

→

```js
      const first = stories.findIndex((story) => story.page >= target);
      moveTo(first === -1 ? stories.length : first);
      return;
```

`runJump` içinde, atlama sonucu:

```js
        appendEntries(result.entries, result.page);
        index = forwardFrom(0);
        ensureAhead();
```

→

```js
        appendEntries(result.entries, result.page);
        index = 0;
        ensureAhead();
```

`markFailed`:

```js
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
```

→

```js
  /** Görseli açılmayan story atlanmaz: aktifse yerinde kalır, görüntüleyici onu story süresince gösterip geçer. */
  function markFailed(story) {
    if (disposed || story.status === 'failed') return;
    story.status = 'failed';
    story.resolvedUrl = null;
    ensureAhead();
    emit('change');
  }
```

`dispose`:

```js
    listeners.change.clear();
    listeners.skipped.clear();
```

→

```js
    listeners.change.clear();
```

Dosyada başka hiçbir şeyi değiştirme. `resolveStory`, `ensureAhead`, sayfa sınırı (`searchLimitReached`, `isBlocked`), `markOpened`, `continueSearching`, `retry`, `on`, `state` ve dönen nesne aynı kalır.

- [ ] **Step 5: Görüntüleyiciyi, stili ve sabitleri değiştir**

`src/viewer/viewer.js` içinde sırayla şu değişiklikleri yap.

İçe aktarma:

```js
  STORY_DURATION_MS,
  TOAST_MS,
} from '../core/constants.js';
```

→

```js
  STORY_DURATION_MS,
} from '../core/constants.js';
```

Kutu:

```js
  const image = el('img', { class: 'es-image', alt: '', draggable: 'false' });
  const caption = el('div', { class: 'es-caption' });
  const frame = el('div', { class: 'es-frame' }, [image, top, caption]);
```

→

```js
  const image = el('img', { class: 'es-image', alt: '', draggable: 'false' });
  const failedText = el('p', { class: 'es-failed', role: 'status' });
  const caption = el('div', { class: 'es-caption' });
  const frame = el('div', { class: 'es-frame' }, [image, failedText, top, caption]);
```

Bildirim öğesi:

```js
  const toast = el('div', { class: 'es-toast', role: 'status' });
  const root = el('div', {
```

→

```js
  const root = el('div', {
```

Kök öğe:

```js
  }, [backdrop, stage, pager, toast]);
  root.style.setProperty('--es-duration', `${STORY_DURATION_MS}ms`);
  for (const node of [pausedBadge, spinner, card, pager, toast]) node.hidden = true;
```

→

```js
  }, [backdrop, stage, pager]);
  root.style.setProperty('--es-duration', `${STORY_DURATION_MS}ms`);
  for (const node of [pausedBadge, spinner, failedText, card, pager]) node.hidden = true;
```

Durum değişkenleri:

```js
  let imageLoaded = false;
  let lastEntryId = null;
```

→

```js
  let imageLoaded = false;
  let failedShown = false;
  let lastEntryId = null;
```

ve

```js
  let held = false;
  let toastTimer = null;
  let closed = false;
```

→

```js
  let held = false;
  let closed = false;
```

`showStory` içinde:

```js
    loadingUrl = null;
    imageLoaded = false;
    lastEntryId = story.entry.id;
```

→

```js
    loadingUrl = null;
    imageLoaded = false;
    failedShown = false;
    failedText.hidden = true;
    failedText.textContent = '';
    lastEntryId = story.entry.id;
```

`preloadNext` fonksiyonunun hemen önüne yeni fonksiyon:

```js
  function preloadNext() {
```

→

```js
  /** Görseli açılmayan story: kutu yüklenirken olduğu gibi kalır, ortada yazı çıkar, çizgi story süresince dolar. */
  function showFailed(story) {
    failedShown = true;
    failedText.textContent = 'görsel açılmadı';
    failedText.hidden = false;
    backdrop.removeAttribute('src');
    renderProgress(story, true);
  }

  function preloadNext() {
```

`render` içinde:

```js
    if (key !== shownKey) showStory(story, key);
    if (story.status === 'ready' && loadingUrl !== story.resolvedUrl) loadImage(story, key);
    spinner.hidden = imageLoaded;
```

→

```js
    if (key !== shownKey) showStory(story, key);
    if (story.status === 'failed' && !failedShown) showFailed(story);
    if (story.status === 'ready' && loadingUrl !== story.resolvedUrl) loadImage(story, key);
    spinner.hidden = imageLoaded || failedShown;
```

`showToast` fonksiyonunu, altındaki boş satırla birlikte tamamen sil:

```js
  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    win.clearTimeout(toastTimer);
    toastTimer = win.setTimeout(() => {
      toast.hidden = true;
    }, TOAST_MS);
  }

```

`close` içinde:

```js
    offChange();
    offSkipped();
```

→

```js
    offChange();
```

ve

```js
    win.clearTimeout(pressTimer);
    win.clearTimeout(toastTimer);
```

→

```js
    win.clearTimeout(pressTimer);
```

Dosyanın sonuna yakın, olay abonelikleri:

```js
  const offChange = feed.on('change', render);
  const offSkipped = feed.on('skipped', () => showToast('görsel açılmadı, geçildi'));
```

→

```js
  const offChange = feed.on('change', render);
```

`src/viewer/viewer.css` içinde:

```css
.es-frame.is-loading .es-image {
  display: none;
}
```

→

```css
.es-frame.is-loading .es-image {
  display: none;
}

/* Görseli açılmayan story: yazı yükleniyor kutusunun ortasında durur; üst bar ve alttaki yazı onun üstünde kalır. */
.es-failed {
  position: absolute;
  top: 50%;
  right: 0;
  left: 0;
  margin: 0;
  font-size: 16px;
  text-align: center;
  transform: translateY(-50%);
  pointer-events: none;
}
```

Aynı dosyanın sonundaki bildirim stilini, önündeki boş satırla birlikte sil. Dosya bir önceki kuralın (`.es-pager button:focus-visible, .es-pager-select:focus-visible { … }`) kapanan `}` satırıyla biter:

```css

.es-toast {
  position: absolute;
  bottom: calc(var(--es-strip) + 24px);
  left: 50%;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.75);
  font-size: 13px;
  transform: translateX(-50%);
  pointer-events: none;
}
```

`src/core/constants.js` içinde şu satırı sil:

```js
export const TOAST_MS = 1500;
```

Notlar:
- `.es-failed` kutunun içindedir. Kart gösterilince kutu (`frame.hidden`) gizlendiği için yazı da gizlenir; `renderCard`'a dokunma.
- Çizgi `renderProgress(story, true)` ile başlar ve mevcut `animationend` dinleyicisi `feed.next()` çağırır. Durdurma nedenleri (`is-paused`) CSS'te bu çizgiyi de durdurur; yeni zamanlayıcı yazma.
- `image.onload`, `image.onerror`, `loadImage`, `renderCard`, `preloadNext` ve girdiler aynı kalır.

- [ ] **Step 6: Testleri çalıştır**

Run: `node --test test/story-feed.test.js`
Expected: PASS: `ℹ tests 31`, `ℹ pass 31`, `ℹ fail 0`

Run: `node --test test/main.smoke.test.js`
Expected: PASS: `ℹ tests 12`, `ℹ pass 12`, `ℹ fail 0`

Run: `npm test`
Expected: PASS: `ℹ tests 94`, `ℹ pass 94`, `ℹ fail 0`

Run: `grep -rnE "skipped|announced|playableFrom|forwardFrom|TOAST_MS|toast|let direction|direction =" src`
Expected: çıktı yok (çıkış kodu 1).

- [ ] **Step 7: Commit**

```bash
git add test/story-feed.test.js test/main.smoke.test.js src/core/story-feed.js src/viewer/viewer.js src/viewer/viewer.css src/core/constants.js
git commit -m "$(cat <<'EOF'
fix: açılmayan görseli atlamadan story süresince göster

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Önden okuma hakları

**Files:**
- Modify: `test/page-source.test.js` (`sistem saati geri alınsa da…` testinin önü)
- Modify: `src/core/page-source.js`

**Interfaces:**
- Consumes (`test/page-source.test.js` içindeki mevcut yardımcılar):
  - `makeTab()` → `{ clock, open }`:
    - `clock` sahte saattir: `clock.t` şimdiki an, `clock.sleeps` bekleme süreleri, `clock.onSleep` her bekleme başlarken çağrılır. Beklemeler hemen biter ve `clock.t`'yi ilerletir.
    - `open(fetch, overrides)` aynı sıradan bir sayfa kaynağı açar (`current: 1`, `count: 5`, `overrides` ile değişir).
  - `makeSource(fetch, overrides)` → `{ source, clock }`: tek kaynaklı sekme.
  - `ok(body)`, `pageBody(current, count)`, `TOPIC_URL`, `flush`, `deferred`.
- Produces:
  - `createPageQueue({ minGapMs, fetchAheadBurst = EMPTY_PAGE_LIMIT, fetchAheadRefillMs = STORY_DURATION_MS, now, sleep })` → `{ run, pace }`.
  - `pace(signal, { fetchAhead = false } = {})`: önce `minGapMs` aralığını bekler. `fetchAhead` doğruysa bir hak dolana kadar da bekler. İptal edildiyse reddeder; hak harcanmaz, son istek anı değişmez. Değilse bir hak harcar (`fetchAhead` ise) ve son istek anını yazar.
  - `createPageSource(...).next()` istekleri `{ fetchAhead: true }` ile gider, 429/5xx sonrası tekrar da dahil. `load()` hak harcamaz.

- [ ] **Step 1: Başarısız testleri yaz**

`test/page-source.test.js` içinde şu satırın:

```js
test("sistem saati geri alınsa da aralık beklemesi 1500 ms'yi geçmez", async (t) => {
```

hemen önüne ekle:

```js
test('önden okuma hakları bitince sonraki sayfa bir hak dolana kadar bekler', async () => {
  const starts = [];
  const { source, clock } = makeSource(async (url) => {
    starts.push(clock.t);
    return ok(pageBody(Number(new URL(url).searchParams.get('p')), 20));
  }, { count: 20 });
  const round = [1500, 1500, 1500, 1500, 1500, 1500, 1000, 1500, 3500];

  for (let i = 0; i < 8; i += 1) await source.next();
  assert.deepEqual(starts, [0, 1500, 3000, 4500, 6000, 7500, 10000, 15000]);
  assert.deepEqual(clock.sleeps, round);

  clock.t += 60000; // bir dakika istek yok: haklar en fazla 5'e dolar
  for (let i = 0; i < 8; i += 1) await source.next();
  assert.deepEqual(starts.slice(8), [75000, 76500, 78000, 79500, 81000, 82500, 85000, 90000]);
  assert.deepEqual(clock.sleeps, [...round, ...round]);
});

test('sayfa atlama hak harcamaz', async () => {
  const { source, clock } = makeSource(async (url) => ok(pageBody(Number(new URL(url).searchParams.get('p')), 12)), { count: 12 });
  for (let i = 0; i < 6; i += 1) await source.next();
  assert.deepEqual(clock.sleeps, [1500, 1500, 1500, 1500, 1500]);
  await source.load(9);
  await source.next();
  assert.deepEqual(clock.sleeps, [1500, 1500, 1500, 1500, 1500, 1500, 1500], 'load hak harcasaydı sonraki istekten önce hak beklenirdi');
});

test('hak beklerken kapatılınca istek atılmaz ve hak harcanmaz', async () => {
  const { clock, open } = makeTab();
  const requests = [];
  const fetch = async (url) => {
    requests.push(url);
    return ok(pageBody(Number(new URL(url).searchParams.get('p')), 12));
  };
  const closed = open(fetch, { count: 12 });
  for (let i = 0; i < 6; i += 1) await closed.next();
  clock.onSleep = () => {
    if (clock.sleeps.at(-1) === 1000) closed.dispose(); // hak beklenirken kapanır
  };
  await assert.rejects(closed.next(), { name: 'AbortError' });
  clock.onSleep = null;
  assert.equal(requests.length, 6, 'hak beklenirken kapanan oturum istek atmaz');
  assert.deepEqual(clock.sleeps, [1500, 1500, 1500, 1500, 1500, 1500, 1000]);

  assert.equal((await open(fetch, { count: 12 }).next()).page, 2);
  assert.equal(requests.length, 7);
  assert.deepEqual(clock.sleeps, [1500, 1500, 1500, 1500, 1500, 1500, 1000], 'hak harcanmadığı için yeni oturum beklemez');
});

```

Notlar:
- **Beklenen sayıların hesabı.** Hak bütçesi başta 25.000 ms'dir; her istek 5.000 ms harcar, geçen süre kadar dolar, en fazla 25.000 ms olur.
  - 1.500 ms aralıklarla giden ilk 6 istekten sonra 7500 ms'de bütçe 2.500 ms kalır.
  - 7. istek 1.500 ms aralıktan sonra 1.000 ms hak bekler; 8. istek 1.500 ms aralıktan sonra 3.500 ms bekler.
- **Sahte saat.** Yanıtlar anında döner; saat yalnızca beklemelerle ve testin elle eklediği bir dakikayla ilerler.
- **Hangi test bugün düşer.** `sayfa atlama hak harcamaz` bugünkü kodda da geçer ve davranışı sabitler. Diğer ikisi bugünkü kodda başarısız olur.
- Mevcut testlere ve yardımcılara dokunma.

- [ ] **Step 2: Testlerin başarısız olduğunu gör**

Run: `node --test test/page-source.test.js`
Expected: FAIL: `ℹ tests 27`, `ℹ pass 25`, `ℹ fail 2`. Hatalar:
- `önden okuma hakları bitince sonraki sayfa bir hak dolana kadar bekler`: `AssertionError`, `actual` `[0, 1500, 3000, 4500, 6000, 7500, 9000, 10500]`, `expected` `[0, 1500, 3000, 4500, 6000, 7500, 10000, 15000]`.
- `hak beklerken kapatılınca istek atılmaz ve hak harcanmaz`: `AssertionError [ERR_ASSERTION]: Missing expected rejection (AbortError).`

- [ ] **Step 3: Sayfa sırasına hakları ekle**

`src/core/page-source.js` içinde sırayla şu değişiklikleri yap.

İçe aktarma:

```js
import { PAGE_MIN_GAP_MS, PAGE_RETRY_DELAY_MS } from './constants.js';
```

→

```js
import { EMPTY_PAGE_LIMIT, PAGE_MIN_GAP_MS, PAGE_RETRY_DELAY_MS, STORY_DURATION_MS } from './constants.js';
```

`createPageQueue` başı:

```js
/**
 * Sekmedeki bütün sayfa isteklerinin ortak sırası: aynı anda tek iş, istek başlangıçları arasında en az `minGapMs`.
 * Story ekranı kapatılıp açılınca da kurallar sürsün diye sekme başına bir kez kurulur.
 * Varsayılan saat monotondur: sistem saati geri alınsa da bekleme `minGapMs`'yi geçmez.
 * @returns {{ run: (job: () => Promise<any>, signal: AbortSignal) => Promise<any>, pace: (signal: AbortSignal) => Promise<void> }}
 */
export function createPageQueue({ minGapMs = PAGE_MIN_GAP_MS, now = () => performance.now(), sleep = defaultSleep } = {}) {
  let tail = Promise.resolve();
  let lastRequestAt = Number.NEGATIVE_INFINITY;
```

→

```js
/**
 * Sekmedeki bütün sayfa isteklerinin ortak sırası: aynı anda tek iş, istek başlangıçları arasında en az `minGapMs`.
 * Story ekranı kapatılıp açılınca da kurallar sürsün diye sekme başına bir kez kurulur.
 * Varsayılan saat monotondur: sistem saati geri alınsa da bekleme `minGapMs`'yi geçmez.
 * Önden okuma istekleri (`fetchAhead`) ayrıca hak harcar: `fetchAheadBurst` hak vardır, her `fetchAheadRefillMs`'de bir hak dolar, hak yoksa dolana kadar beklenir.
 * Varsayılanlar sayfa sınırı ve story süresidir: tek bir görselsiz bölüm hızlı taranır, uzun zincir story süresinden hızlı sayfa istemez.
 * @returns {{ run: (job: () => Promise<any>, signal: AbortSignal) => Promise<any>, pace: (signal: AbortSignal, options?: { fetchAhead?: boolean }) => Promise<void> }}
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
```

`pace`:

```js
  /** Yalnızca `run` işinin içinde, her istekten hemen önce çağrılır: önceki istek başlayalı `minGapMs` geçmediyse bekler. Beklerken iptal edildiyse istek sayılmaz. */
  async function pace(signal) {
    const wait = lastRequestAt + minGapMs - now();
    if (wait > 0) await sleep(wait);
    signal.throwIfAborted();
    lastRequestAt = now();
  }
```

→

```js
  function refillBudget() {
    const t = now();
    budget = Math.min(budgetLimit, budget + (t - budgetAt));
    budgetAt = t;
  }

  /**
   * Yalnızca `run` işinin içinde, her istekten hemen önce çağrılır: önceki istek başlayalı `minGapMs` geçmediyse bekler.
   * Önden okuma isteğinde hak yoksa bir hak dolana kadar da bekler. Beklerken iptal edildiyse istek sayılmaz, hak harcanmaz.
   */
  async function pace(signal, { fetchAhead = false } = {}) {
    const wait = lastRequestAt + minGapMs - now();
    if (wait > 0) await sleep(wait);
    if (fetchAhead) {
      refillBudget();
      if (budget < fetchAheadRefillMs) await sleep(fetchAheadRefillMs - budget);
    }
    signal.throwIfAborted();
    if (fetchAhead) {
      refillBudget();
      budget -= fetchAheadRefillMs;
    }
    lastRequestAt = now();
  }
```

`createPageSource` içinde `request`:

```js
  async function request(url) {
    await queue.pace(signal);
```

→

```js
  async function request(url, options) {
    await queue.pace(signal, options);
```

`fetchPage`:

```js
  async function fetchPage(page) {
    const url = buildPageUrl(baseUrl, page);
    let result = await request(url);
    if (result.error && result.retryable) {
      await sleep(retryDelayMs);
      result = await request(url);
    }
```

→

```js
  async function fetchPage(page, options) {
    const url = buildPageUrl(baseUrl, page);
    let result = await request(url, options);
    if (result.error && result.retryable) {
      await sleep(retryDelayMs);
      result = await request(url, options);
    }
```

`enqueue`:

```js
  /** Sayfa isteklerini sekmenin ortak sırasına sokar. Aynı sayfaya art arda istek varsa son sonucu döndürür. */
  function enqueue(pickPageFn) {
    return queue.run(async () => {
      const page = pickPageFn();
      if (lastResult && lastResult.page === page) return lastResult;
      const parsed = await fetchPage(page);
```

→

```js
  /** Sayfa isteklerini sekmenin ortak sırasına sokar. Aynı sayfaya art arda istek varsa son sonucu döndürür. `options` sıranın `pace`'ine gider. */
  function enqueue(pickPageFn, options) {
    return queue.run(async () => {
      const page = pickPageFn();
      if (lastResult && lastResult.page === page) return lastResult;
      const parsed = await fetchPage(page, options);
```

`next`:

```js
  function next() {
    if (nextInFlight) return nextInFlight;
    nextInFlight = enqueue(() => {
      if (!hasNext()) throw new Error('sonraki sayfa yok');
      return lastPage + 1;
    }).finally(() => {
```

→

```js
  /** Önden okuma: sonraki sayfa isteği sıradan hak da harcar. */
  function next() {
    if (nextInFlight) return nextInFlight;
    nextInFlight = enqueue(() => {
      if (!hasNext()) throw new Error('sonraki sayfa yok');
      return lastPage + 1;
    }, { fetchAhead: true }).finally(() => {
```

Dosyada başka hiçbir şeyi değiştirme. `run`, `buildPageUrl`, `load`, `hasNext`, `dispose` ve `PageFetchError` aynı kalır; `load(page)` hâlâ `enqueue(() => page)` çağırır.

- [ ] **Step 4: Testleri çalıştır**

Run: `node --test test/page-source.test.js`
Expected: PASS: `ℹ tests 27`, `ℹ pass 27`, `ℹ fail 0`

Run: `npm test`
Expected: PASS: `ℹ tests 97`, `ℹ pass 97`, `ℹ fail 0`

- [ ] **Step 5: Simülasyonu çalıştır**

Aşağıdaki betiği repoya eklemeden geçici bir yere yaz, örneğin `$TMPDIR/ilerleme-sim.mjs`.
- Betik sanal saatle çalışır; gerçek story akışını, sayfa kaynağını, sırayı ve çözümleyiciyi kullanır.
- Görüntüleyici taklit edilir: açılan görselde 300 ms sonra `markOpened`, 5 sn sonra `next()`; açılmayan story 5 sn gösterilip `next()`.
- "durdurulmuş" senaryolarda `next()` hiç çağrılmaz.

```js
// Kendiliğinden ilerleme simülasyonu: sanal saat, gerçek story akışı, sayfa kaynağı, sıra ve çözümleyici.
// Görüntüleyici taklidi: açılan görselde 300 ms sonra markOpened, 5 sn sonra next; açılmayan story 5 sn gösterilip next.
// Direkt link 100 ms'de açılmaz. "durdurulmuş" senaryolarda next hiç çağrılmaz. Repo kökünden çalıştırılır: node <betiğin yolu>
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const load = (path) => import(pathToFileURL(`${root}/${path}`).href);
const { createStoryFeed } = await load('src/core/story-feed.js');
const { createPageSource, createPageQueue } = await load('src/core/page-source.js');
const { createResolver } = await load('src/core/image-resolver.js');
const { parseTopicPage } = await load('src/core/entry-parser.js');
const { parseHtml } = await load('test/helpers/dom.js');
const { topicPageHtml, imagePageHtml, link } = await load('test/helpers/eksi-html.js');

const PAGE_URL = 'https://eksisozluk.com/anin-fotografi--6459985';
const PAGE_COUNT = 22000;
const STORY_MS = 5000;

async function simulate({ perPage, topic, playing = true, minutes = 10, imgStatus = 404, imgFailMs = 150, onBlocked = null }) {
  const timers = [];
  let now = 0;
  let seq = 0;
  const later = (ms) => new Promise((resolve) => timers.push({ at: now + ms, seq: seq++, resolve }));
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  const pageStarts = [];
  const blockedAt = [];
  let img = 0;
  const makeEntries = (p) => Array.from({ length: perPage }, (_, i) => {
    const t = topic(p, i);
    let content = 'görselsiz';
    if (t?.kind === 'eksi') content = link(`https://soz.lk/i/${t.opens ? 'ok' : 'x'}p${p}n${i}`);
    if (t?.kind === 'direct') content = link(`https://${t.opens ? 'ok' : 'olu'}.example/p${p}n${i}.jpg`);
    return { id: `${p}${String(i).padStart(3, '0')}`, content };
  });
  const fetch = async (url) => {
    if (url.startsWith('https://eksisozluk.com/img/')) {
      img += 1;
      const id = url.split('/').pop();
      if (id.startsWith('ok')) {
        await later(150);
        return { ok: true, status: 200, text: async () => imagePageHtml({ ogImage: `https://ok.example/cdn/${id}.jpg` }) };
      }
      await later(imgFailMs);
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

  let shown = null;
  let showing = 0;
  let loadingUrl = null;
  let failedShown = false;
  let wasBlocked = false;
  feed.on('change', () => {
    const blocked = feed.state.blocked;
    if (blocked && !wasBlocked) {
      blockedAt.push(now);
      onBlocked?.({ feed, later, count: blockedAt.length });
    }
    wasBlocked = blocked;
    const story = feed.current();
    if (!story) return;
    if (story !== shown) {
      shown = story;
      showing += 1;
      loadingUrl = null;
      failedShown = false;
    }
    const mine = showing;
    if (story.status === 'failed' && !failedShown) {
      failedShown = true;
      if (playing) later(STORY_MS).then(() => mine === showing && feed.next());
    }
    if (story.status === 'ready' && loadingUrl !== story.resolvedUrl) {
      loadingUrl = story.resolvedUrl;
      if (story.resolvedUrl.startsWith('https://ok.example/')) {
        later(300).then(() => {
          if (mine !== showing) return;
          feed.markOpened?.(story);
          if (playing) later(STORY_MS).then(() => mine === showing && feed.next());
        });
      } else {
        later(100).then(() => mine === showing && feed.markFailed(story));
      }
    }
  });
  feed.start();

  for (;;) {
    await flush();
    await flush();
    timers.sort((a, b) => a.at - b.at || a.seq - b.seq);
    if (timers.length === 0 || timers[0].at > minutes * 60000) break;
    const timer = timers.shift();
    now = timer.at;
    timer.resolve();
  }
  feed.dispose();
  const gaps = pageStarts.slice(1).map((t, i) => t - pageStarts[i]);
  const perHour = 60 / minutes;
  return {
    pages: pageStarts.length,
    img,
    minGap: gaps.length ? `${Math.min(...gaps)} ms` : '-',
    end: timers.length ? `${minutes} dk doldu` : `${Math.round(now / 1000)} sn'de durdu`,
    pagesPerHour: Math.round(pageStarts.length * perHour),
    imgPerHour: Math.round(img * perHour),
    blockedAt,
  };
}

const every5 = (kind) => (p, i) => ({ kind, opens: p % 5 === 0 && i === 0 });
const hash = (p, i) => {
  let h = (p * 73856093) ^ (i * 19349663);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
};
const rates = [
  ['A1 5 sayfada 1 açılan, /img/ 404, 100 entry', { perPage: 100, topic: every5('eksi') }],
  ['A2 5 sayfada 1 açılan, /img/ 404, 10 entry', { perPage: 10, topic: every5('eksi') }],
  ['A3 5 sayfada 1 açılan, ölü direkt, 100 entry', { perPage: 100, topic: every5('direct') }],
  ['A4 5 sayfada 1 açılan, ölü direkt, 10 entry', { perPage: 10, topic: every5('direct') }],
  ['A5 5 sayfada 1 açılan, /img/ 429 (50 ms), 100 entry', { perPage: 100, topic: every5('eksi'), imgStatus: 429, imgFailMs: 50 }],
  ['A6 %30 açılan, ölü direkt, 10 entry', { perPage: 10, topic: (p, i) => ({ kind: 'direct', opens: hash(p, i) < 0.3 }) }],
  ['A7 seyrek, hatasız, 10 entry', { perPage: 10, topic: (p, i) => (p % 5 === 0 && i === 0 ? { kind: 'eksi', opens: true } : null) }],
  ['A8 normal, 10 entry', { perPage: 10, topic: () => ({ kind: 'eksi', opens: true }) }],
  ['A9 normal, 100 entry', { perPage: 100, topic: () => ({ kind: 'eksi', opens: true }) }],
  ['D1 durdurulmuş, hiçbiri açılmıyor, /img/ 404, 100 entry', { perPage: 100, topic: () => ({ kind: 'eksi', opens: false }), playing: false }],
  ['D2 durdurulmuş, hiçbiri açılmıyor, ölü direkt, 10 entry', { perPage: 10, topic: () => ({ kind: 'direct', opens: false }), playing: false }],
];
for (const [name, options] of rates) {
  const r = await simulate(options);
  console.log(`${name}: sayfa ${r.pages} (saatte ~${r.pagesPerHour}), /img/ ${r.img} (saatte ~${r.imgPerHour}), en kısa aralık ${r.minGap}, ${r.end}`);
}

const firstOnly = (p, i) => (p === 1 && i === 0 ? { kind: 'eksi', opens: true } : null);
const k1 = await simulate({ perPage: 10, topic: firstOnly, minutes: 2 });
console.log(`K1 açılan görselden sonra görselsiz sayfalar: kart ${k1.blockedAt[0]} ms'de`);
const k2 = await simulate({
  perPage: 10,
  topic: firstOnly,
  minutes: 2,
  onBlocked: ({ feed, later, count }) => {
    if (count === 1) later(3000).then(() => feed.continueSearching());
  },
});
console.log(`K2 ilk karttan 3 sn sonra aramaya devam: yeni kart basıştan ${k2.blockedAt[1] - k2.blockedAt[0] - 3000} ms sonra`);
```

Run (repo kökünden, ~2 sn sürer): `node "$TMPDIR/ilerleme-sim.mjs"`
Expected, birebir:

```
A1 5 sayfada 1 açılan, /img/ 404, 100 entry: sayfa 1 (saatte ~6), /img/ 122 (saatte ~732), en kısa aralık -, 10 dk doldu
A2 5 sayfada 1 açılan, /img/ 404, 10 entry: sayfa 12 (saatte ~72), /img/ 122 (saatte ~732), en kısa aralık 50000 ms, 10 dk doldu
A3 5 sayfada 1 açılan, ölü direkt, 100 entry: sayfa 1 (saatte ~6), /img/ 0 (saatte ~0), en kısa aralık -, 10 dk doldu
A4 5 sayfada 1 açılan, ölü direkt, 10 entry: sayfa 12 (saatte ~72), /img/ 0 (saatte ~0), en kısa aralık 51000 ms, 10 dk doldu
A5 5 sayfada 1 açılan, /img/ 429 (50 ms), 100 entry: sayfa 1 (saatte ~6), /img/ 122 (saatte ~732), en kısa aralık -, 10 dk doldu
A6 %30 açılan, ölü direkt, 10 entry: sayfa 11 (saatte ~66), /img/ 0 (saatte ~0), en kısa aralık 51000 ms, 10 dk doldu
A7 seyrek, hatasız, 10 entry: sayfa 125 (saatte ~750), /img/ 25 (saatte ~150), en kısa aralık 1500 ms, 10 dk doldu
A8 normal, 10 entry: sayfa 11 (saatte ~66), /img/ 116 (saatte ~696), en kısa aralık 53000 ms, 10 dk doldu
A9 normal, 100 entry: sayfa 1 (saatte ~6), /img/ 116 (saatte ~696), en kısa aralık -, 10 dk doldu
D1 durdurulmuş, hiçbiri açılmıyor, /img/ 404, 100 entry: sayfa 0 (saatte ~0), /img/ 3 (saatte ~18), en kısa aralık -, 0 sn'de durdu
D2 durdurulmuş, hiçbiri açılmıyor, ölü direkt, 10 entry: sayfa 0 (saatte ~0), /img/ 0 (saatte ~0), en kısa aralık -, 0 sn'de durdu
K1 açılan görselden sonra görselsiz sayfalar: kart 6300 ms'de
K2 ilk karttan 3 sn sonra aramaya devam: yeni kart basıştan 16000 ms sonra
```

Değişiklikten önce (`ae2ccf0`) aynı betik ~15 sn sürer ve şunları verir:
- A1–A7'de sırasıyla 69, 249, 54, 247, 157, 41 ve 401 sayfa;
- D1'de `46 sn'de durdu` ile 5 sayfa ve 600 `/img/`, D2'de `8 sn'de durdu`;
- K2'de `6300 ms`.

A8, A9 ve K1 aynıdır. Sonuç beklenenden farklıysa dur ve raporla. Betiği repoya ekleme.

- [ ] **Step 6: Commit**

```bash
git add test/page-source.test.js src/core/page-source.js
git commit -m "$(cat <<'EOF'
fix: önden okumayı sekme başına haklarla sınırla

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: README ve eski spec notları

**Files:**
- Modify: `README.md:43`
- Modify: `docs/superpowers/specs/2026-09-14-eksi-stories-design.md:8` (altına satır)
- Modify: `docs/superpowers/specs/2026-09-16-eksi-dili-metinler-design.md:5` (altına satır)
- Modify: `docs/superpowers/specs/2026-09-16-sayfa-gostergesi-design.md:6` (altına satır)
- Modify: `docs/superpowers/specs/2026-09-17-ortak-istek-sirasi-design.md:5` (altına satır)
- Modify: `docs/superpowers/specs/2026-09-17-istek-sirasi-sinirlari-design.md:5` (altına satır)
- Modify: `docs/superpowers/specs/2026-09-17-acilmayan-gorsel-siniri-design.md:4` (altına satır)

**Interfaces:**
- Consumes: Görev 1 ve 2'nin davranışı. Açılmayan görsel 5 sn gösterilir, bildirim yoktur. Önden okuma art arda 5 sayfadan sonra 5 sn'de bir sayfaya iner.
- Produces: yok

- [ ] **Step 1: README'yi güncelle**

`README.md`, "kurallar" bölümünde:

```markdown
- siteyi yormaz: her sekmede sayfa istekleri arasında en az 1,5 saniye bekler, aynı anda tek sayfa ister, görsel sayfalarını en fazla ikişer açar, 5 sayfa boyunca görsel açılmazsa durur.
```

→

```markdown
- siteyi yormaz: her sekmede aynı anda tek sayfa ister, sayfa istekleri arasında en az 1,5 saniye bekler, sonraki sayfaları art arda 5 sayfadan sonra 5 saniyede bir okur, görsel sayfalarını en fazla ikişer açar, görsel açılmasa da 5 saniye bekler, 5 sayfa boyunca görsel açılmazsa durur.
```

README'de başka satıra dokunma.

- [ ] **Step 2: Eski spec'lere not ekle**

Her dosyada verilen satırın hemen altına verilen notu ekle.

`docs/superpowers/specs/2026-09-14-eksi-stories-design.md`, şu satırın altına:

```markdown
Not: §2.2, §4, §5 ve §10'daki 5 görselsiz sayfa sınırı 2026-09-17-acilmayan-gorsel-siniri-design.md ile "son açılan görselin sayfasından sonra 5 sayfa" oldu; görselleri açılmayan sayfalar da sayılır.
```

eklenecek:

```markdown
Not: §7'deki "otomatik atlanır" ve "grup atlanır" satırları ile §10'daki toast süresi 2026-09-17-kendiliginden-ilerleme-hizi-design.md ile değişti: açılmayan görsel atlanmaz, `görsel açılmadı` yazısıyla 5 sn gösterilir. §2.2 ve §5'teki önden okuma aynı belgeyle hakla sınırlandı.
```

`docs/superpowers/specs/2026-09-16-eksi-dili-metinler-design.md`, şu satırın altına:

```markdown
Not: §4'teki boş sayfa sınırı kartı 2026-09-17-acilmayan-gorsel-siniri-design.md ile `${EMPTY_PAGE_LIMIT} sayfadır açılan görsel yok` oldu.
```

eklenecek:

```markdown
Not: §4'teki bozuk görsel bildirimi 2026-09-17-kendiliginden-ilerleme-hizi-design.md ile kalktı; açılmayan story'de `görsel açılmadı` yazar.
```

`docs/superpowers/specs/2026-09-16-sayfa-gostergesi-design.md`, şu satırın altına:

```markdown
Not: §6'daki boş sayfa sayacı 2026-09-17-acilmayan-gorsel-siniri-design.md ile değişti: atlamada sayım hedef sayfadan başlar, hedef sayfa yine sayılmaz.
```

eklenecek:

```markdown
Not: §5'teki `.es-toast` konumu 2026-09-17-kendiliginden-ilerleme-hizi-design.md ile bildirim kalkınca geçersiz oldu.
```

`docs/superpowers/specs/2026-09-17-ortak-istek-sirasi-design.md`, şu satırın altına:

```markdown
Not: §3 `createPageQueue`'nun varsayılan saati 2026-09-17-istek-sirasi-sinirlari-design.md ile `performance.now()` oldu; sekmeler arası sıra ve kapatınca yapılan `focusto` gezintisi aynı belgede gerekçesiyle kapsam dışı bırakıldı.
```

eklenecek:

```markdown
Not: §3 `createPageQueue` ve §5 kapatma tablosu 2026-09-17-kendiliginden-ilerleme-hizi-design.md ile önden okuma haklarını da kapsar.
```

`docs/superpowers/specs/2026-09-17-istek-sirasi-sinirlari-design.md`, şu satırın altına:

```markdown
Not: §2.1 ve §7'de kapsam dışı bırakılan açılmayan görsel konusu 2026-09-17-acilmayan-gorsel-siniri-design.md ile ele alındı.
```

eklenecek:

```markdown
Not: §2.1'de anlatılan, görseli açılmayan story'nin kendiliğinden atlanması 2026-09-17-kendiliginden-ilerleme-hizi-design.md ile kalktı.
```

`docs/superpowers/specs/2026-09-17-acilmayan-gorsel-siniri-design.md`, şu satırın altına:

```markdown
Durum: Onaylandı (brainstorming sonucu). Son incelemeden sonra §3, §8, §9 ve §10 düzeltildi: önde açık ekrandaki kalan risk ölçülen sayılarla yazıldı, hızlı geçişte kart çıkabileceği eklendi, tampondaki sayfaya geçiş için bir test eklendi.
```

eklenecek:

```markdown
Not: §9'daki önde açık ekran riski 2026-09-17-kendiliginden-ilerleme-hizi-design.md ile ele alındı; §3 ve §7'deki "görsel açılmadı, geçildi" bildirimi aynı belgeyle kalktı.
```

Altı spec'in gövdesine dokunma. PRIVACY, `store/` ve CHANGELOG değişmez.

- [ ] **Step 3: Değişiklikleri doğrula**

Run: `grep -n "5 saniyede bir okur" README.md`
Expected: tek satır; `43:- siteyi yormaz: her sekmede aynı anda tek sayfa ister, …` ile başlar.

Run: `grep -c "2026-09-17-kendiliginden-ilerleme-hizi-design.md" docs/superpowers/specs/2026-09-14-eksi-stories-design.md docs/superpowers/specs/2026-09-16-eksi-dili-metinler-design.md docs/superpowers/specs/2026-09-16-sayfa-gostergesi-design.md docs/superpowers/specs/2026-09-17-ortak-istek-sirasi-design.md docs/superpowers/specs/2026-09-17-istek-sirasi-sinirlari-design.md docs/superpowers/specs/2026-09-17-acilmayan-gorsel-siniri-design.md`
Expected: altı dosya için de `:1`.

Run: `grep -rnE "geçildi|TOAST_MS|es-toast|skipped" README.md PRIVACY.md CHANGELOG.md store src dev`
Expected: çıktı yok (çıkış kodu 1).

Run: `git diff --stat`
Expected: yalnızca `README.md` ve altı spec; özet satırı `7 files changed, 7 insertions(+), 1 deletion(-)`.

Run: `npm test`
Expected: PASS: `ℹ tests 97`, `ℹ pass 97`, `ℹ fail 0`

- [ ] **Step 4: Commit**

```bash
git add README.md docs/superpowers/specs/2026-09-14-eksi-stories-design.md docs/superpowers/specs/2026-09-16-eksi-dili-metinler-design.md docs/superpowers/specs/2026-09-16-sayfa-gostergesi-design.md docs/superpowers/specs/2026-09-17-ortak-istek-sirasi-design.md docs/superpowers/specs/2026-09-17-istek-sirasi-sinirlari-design.md docs/superpowers/specs/2026-09-17-acilmayan-gorsel-siniri-design.md
git commit -m "$(cat <<'EOF'
docs: yeni kuralları README'ye ve eski spec notlarına yaz

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Teslim (görevlerden sonra; alt ajana verilmez)

Kullanıcıya soruları AskUserQuestion ile sor.

1. **Dalın kapsamını doğrula.**
   Run: `git diff --stat main...HEAD`
   Expected: yalnızca şu 17 dosya:
   - `README.md`
   - `docs/superpowers/plans/2026-09-17-kendiliginden-ilerleme-hizi.md`
   - `docs/superpowers/specs/2026-09-14-eksi-stories-design.md`
   - `docs/superpowers/specs/2026-09-16-eksi-dili-metinler-design.md`
   - `docs/superpowers/specs/2026-09-16-sayfa-gostergesi-design.md`
   - `docs/superpowers/specs/2026-09-17-acilmayan-gorsel-siniri-design.md`
   - `docs/superpowers/specs/2026-09-17-istek-sirasi-sinirlari-design.md`
   - `docs/superpowers/specs/2026-09-17-kendiliginden-ilerleme-hizi-design.md`
   - `docs/superpowers/specs/2026-09-17-ortak-istek-sirasi-design.md`
   - `src/core/constants.js`
   - `src/core/page-source.js`
   - `src/core/story-feed.js`
   - `src/viewer/viewer.css`
   - `src/viewer/viewer.js`
   - `test/main.smoke.test.js`
   - `test/page-source.test.js`
   - `test/story-feed.test.js`
2. **Bütün dalın son incelemesini yaptır** (superpowers:requesting-code-review). Bulgular için bir düzeltme turu yap.
3. **Playground'u uygulama içi tarayıcıda kontrol et** (spec §12.4).
   - **Sunucu:** worktree'nin `.claude/launch.json` dosyasında `node scripts/serve.mjs` çalıştıran, `port` değeri 5173 ve `url` değeri `http://127.0.0.1:5173` olan `playground` yapılandırması olmalı. Yoksa oluştur; `.claude/` git'te yok sayılır. `preview_start` ile başlat.
   - **Pane gizliyken:** `document.hidden` true olur ve CSS animasyonları çalışmaz; story kendiliğinden geçmez. Bu yüzden betikler ilerlemek için ArrowRight gönderir.
   - **Senaryo 1, açılmayan story'nin görünüşü.** `http://127.0.0.1:5173/dev/playground.html?scenario=1` adresini aç, şu betiği `javascript_tool` ile çalıştır, sonra ekran görüntüsü al:

   ```js
   const until = async (check, ms = 8000) => { const end = performance.now() + ms; while (performance.now() < end) { if (check()) return true; await new Promise((r) => setTimeout(r, 50)); } return false; };
   await until(() => document.querySelector('eksi-stories-viewer'));
   const s = document.querySelector('eksi-stories-viewer').shadowRoot;
   await until(() => !s.querySelector('.es-frame').classList.contains('is-loading'));
   window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
   const ok = await until(() => !s.querySelector('.es-failed').hidden);
   const seg = s.querySelector('.es-seg.is-active .es-seg-fill');
   ({ ok, counter: s.querySelector('.es-counter').textContent, failed: s.querySelector('.es-failed').textContent, spinnerHidden: s.querySelector('.es-stage > .es-spinner').hidden, backdrop: s.querySelector('.es-backdrop').hasAttribute('src'), activeSeg: Boolean(seg), animation: seg && getComputedStyle(seg).animationName, frameLoading: s.querySelector('.es-frame').classList.contains('is-loading'), toast: s.querySelector('.es-toast') })
   ```

     - Beklenen sonuç: `ok: true`, `counter: '2/4'`, `failed: 'görsel açılmadı'`, `spinnerHidden: true`, `backdrop: false`, `activeSeg: true`, `animation: 'es-fill'`, `frameLoading: true`, `toast: null`.
     - Ekran görüntüsünde 9:16 sütunun üstünde çizgi, avatar, yazar, tarih, `entry'ye git`, `2/4` ve ✕; ortada `görsel açılmadı`; altta `bayram sabahından üç kare.`; arka plan siyah.
     - Görüntüyü kullanıcıya gönder ve görünüşü onaylat.
     - Kullanıcı canlı görmek isterse pane açıkken 5 sn'lik çizginin dolup sonraki görsele geçtiğini göster.
   - **Senaryo 5, beş açılmayan story ve kart.** `http://127.0.0.1:5173/dev/playground.html?scenario=5` adresini aç ve şu betiği çalıştır:

   ```js
   const until = async (check, ms = 15000) => { const end = performance.now() + ms; while (performance.now() < end) { if (check()) return true; await new Promise((r) => setTimeout(r, 50)); } return false; };
   await until(() => document.querySelector('eksi-stories-viewer'));
   const s = document.querySelector('eksi-stories-viewer').shadowRoot;
   const cardShown = () => !s.querySelector('.es-card').hidden;
   const failedShown = () => !s.querySelector('.es-frame').hidden && !s.querySelector('.es-failed').hidden;
   const snapshot = () => {
     if (cardShown()) return `kart: ${s.querySelector('.es-card-text').textContent}`;
     const page = s.querySelector('.es-pager-select').value;
     const caption = s.querySelector('.es-caption').textContent || '(yazısız)';
     return failedShown() ? `açılmadı: sayfa ${page}` : `story: ${caption} / sayfa ${page}`;
   };
   await until(() => !s.querySelector('.es-frame').classList.contains('is-loading'));
   const events = [snapshot()];
   for (let step = 0; step < 12; step += 1) {
     window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
     await until(() => failedShown() || (cardShown() && s.querySelector('.es-card-text').textContent.includes('sayfadır')));
     events.push(snapshot());
     if (cardShown()) break;
   }
   const buttons = [...s.querySelectorAll('.es-card-actions button')].map((b) => b.textContent);
   const pageAtCard = s.querySelector('.es-pager-select').value;
   [...s.querySelectorAll('.es-card-actions button')].find((b) => b.textContent === 'aramaya devam')?.click();
   const found = await until(() => !cardShown() && !s.querySelector('.es-frame').classList.contains('is-loading'));
   ({ events, buttons, pageAtCard, found, caption: s.querySelector('.es-caption').textContent, page: s.querySelector('.es-pager-select').value, toast: s.querySelector('.es-toast') })
   ```

     - `events` listesi sırasıyla şunlardır: `story: sonrasında görselleri açılmayan 5 sayfa var / sayfa 1`, `açılmadı: sayfa 2`, `açılmadı: sayfa 3`, `açılmadı: sayfa 4`, `açılmadı: sayfa 5`, `açılmadı: sayfa 6`, `kart: 5 sayfadır açılan görsel yok`.
     - `buttons` `['aramaya devam', 'kapat']`, `pageAtCard` `'6'`, `found` `true`, `caption` `'aramaya devam edince bulundu'`, `page` `'7'`, `toast` `null` olur.
   - **Değişmeyen senaryolar:**
     - `?scenario=3` ("boş sayfalar"): ArrowRight gönder. Kart `5 sayfadır açılan görsel yok` olmalı; `aramaya devam` `aramaya devam edince bulundu` yazılı görseli açmalı.
     - `?scenario=4` ("sayfa hatası"): ArrowRight gönder. Kart `sayfa gelmedi` olmalı; `tekrar dene` `tekrar deneyince geldi` yazılı görseli açmalı.
     - `?scenario=0`: altı görseli ArrowRight ile gez. Hepsi açılmalı, `.es-failed` gizli kalmalı ve son kart `başlıkta başka görsel yok` olmalı.
   - İş bitince `preview_stop` ile sunucuyu kapat.
4. **Canlı Chrome kontrolü isteğe bağlıdır** (spec §12.6). Kullanıcı isterse eklentiyi ve ekşi sekmesini yenilettikten sonra:
   - ölü linkli eski bir entry'de `görsel açılmadı` 5 sn görünür ve sonra geçilir;
   - seyrek bir başlıkta devtools network'te art arda ~6 sayfadan sonra sayfa istekleri arası 5 sn'ye çıkar.
5. **Birleştirme ve push kararı kullanıcıdadır** (superpowers:finishing-a-development-branch). Push yalnızca açık onayla yapılır.
