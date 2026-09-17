# ortak sayfa istek sırası: tasarım

Tarih: 2026-09-17
Durum: Onaylandı (brainstorming sonucu).

## 1. Sorun

- Her story oturumu `startStories` (`src/content/main.js`) içinde kendi `createPageSource`'unu kurar. Her sayfa kaynağının kendi söz zinciri (`queue`) ve aralık sayacı (`lastRequestAt`) vardır.
- Kapatınca yalnızca `feed.dispose()` çağrılır; sayfa kaynağı sıradaki ve uçuştaki işlerini sürdürür.
- Sonuç: story ekranı kapatılıp hemen açılınca eski oturumun istekleri yeni oturumun istekleriyle zamanda çakışır ve kapanmış ekran için sayfa istenir. Oturum içinde kurallar tutar, oturumlar arasında tutmaz.
- Bozulan sözler: ilk tasarım §2.2 "aynı anda en fazla 1 sayfa isteği; sayfa istekleri arasında en az 1,5 sn", README "aynı anda tek sayfa ister".

Ölçüm (`e0774b9`; jsdom, gerçek zamanlayıcılar, sayfa yanıtlarında 300 ms gecikme, ilk sayfada tek görsel olan 9 sayfalık başlık). Aç → 59 ms'de seçim kutusundan sayfa 7 → 112 ms'de esc → 215 ms'de yeniden aç:

| an | istek | uçuşta |
|---|---|---|
| 12 ms | eski oturum `?p=2` (arka plan) | 1 |
| 215 ms | yeni oturum `?p=2` | 2 |
| 1514 ms | kapanmış oturum `?p=7` | 1 |
| 1715 ms | yeni oturum `?p=3` | 2 |

## 2. Kararlar

- **Kural:** bir sekmedeki bütün sayfa istekleri tek sıradadır: aynı anda tek istek, istek başlangıçları arasında en az `PAGE_MIN_GAP_MS` (1500 ms). Story ekranı kapatılıp açılsa da geçerlidir.
- **Yaklaşım:** sekme başına ortak sıra (`createPageQueue`), oturum başına sayfa kaynağı. `main()` sırayı bir kez kurar ve her oturumun sayfa kaynağına verir; görsel çözümleyici (`resolver`) de böyle kurulur.
- **Kapatma:** kapatmak hiçbir beklemeyi kısaltmaz, yalnızca yeni istek atılmasını engeller. Uçuştaki istek kesilmez, yanıtı atılır (kullanıcı kararı, 17.09.2026).
- Seçilmeyen yaklaşımlar: modül düzeyinde global sıra (gizli durum, testlerde sıfırlama gerekir, sorunu doğuran örtük sıra örtük kalır); sekme başına tek sayfa kaynağı ve her açılışta sıfırlama (sekme ve oturum ömrü aynı nesnede karışır, eski işleri düşürmek için yine oturum kimliği gerekir).
- İstek sabitleri (`PAGE_MIN_GAP_MS`, `PAGE_RETRY_DELAY_MS`) ve oturum içindeki davranış değişmez.

## 3. Sayfa isteği sırası (`src/core/page-source.js`)

```js
export function createPageQueue({ minGapMs = PAGE_MIN_GAP_MS, now = () => Date.now(), sleep = defaultSleep } = {})
// → { run(job, signal), pace(signal) }
```

- Sekme ömrü boyunca yaşar. İçinde yalnızca tek söz zinciri ve son isteğin başladığı an durur (başlangıçta `Number.NEGATIVE_INFINITY`).
- `run(job: () => Promise<T>, signal: AbortSignal): Promise<T>`
  - İşi zincirin sonuna ekler; önceki iş (başarılı ya da hatalı) bitmeden başlamaz. Bir işin hatası sonraki işleri durdurmaz.
  - Sırası geldiğinde `signal` iptal edilmişse `job` çağrılmaz, söz `signal.reason` ile reddedilir.
- `pace(signal: AbortSignal): Promise<void>`
  - İşin içinde her istekten hemen önce çağrılır.
  - Önceki istek başlayalı `minGapMs` geçmediyse aradaki süre kadar `sleep` eder.
  - Sonra `signal` iptal edilmişse reddedilir ve son istek anı değişmez; değilse son istek anı `now()` olur.

## 4. Sayfa kaynağı (`src/core/page-source.js`)

```js
export function createPageSource({ fetch, parseHtml, baseUrl, current, count, queue, retryDelayMs = PAGE_RETRY_DELAY_MS, sleep = defaultSleep })
// → { hasNext, next, load, dispose }
```

- `minGapMs` ve `now` parametreleri kalkar, sıraya geçer. `queue` zorunludur; varsayılan bir iç sıra yoktur.
- İçeride bir `AbortController` tutulur; `signal` hem `queue.run` hem `queue.pace` çağrılarına verilir.
- `enqueue`: kendi söz zinciri yerine `queue.run(job, signal)` kullanır. İşin içeriği aynı kalır: sayfa sırası gelince seçilir, art arda aynı sayfa istenirse son sonuç döner, `lastPage`, `pageCount` ve `lastResult` güncellenir.
- `request(url)`: aralık hesabının yerine `await queue.pace(signal)` gelir. Bugünkü bekleme gibi `try` bloğunun dışında kalır; iptal, tekrar denenen ağ hatasına çevrilmez. Sonrası aynıdır (`fetch(url, { credentials: 'include' })`, HTTP durumu, ağ hatası). `fetch`'e `signal` verilmez.
- `fetchPage(page)`: istek ve gerekirse `retryDelayMs` sonra tek tekrar aynıdır. İstekler bittikten sonra, hata kontrolünden ve ayrıştırmadan önce `signal.throwIfAborted()` çağrılır; kapatılan kaynağın yanıtı ayrıştırılmaz.
- `dispose()`: `controller.abort()`. Birden fazla çağrılabilir.
- `hasNext()`, `next()` ve `load(page)` oturum içinde aynı çalışır. JSDoc `@returns` satırına `dispose: () => void` eklenir.

## 5. Kapatma davranışı

`dispose()` sonrasında kaynağın bütün bekleyen sözleri `AbortError` ile (`signal.reason`, `DOMException`) reddedilir:

| kapatıldığı an iş nerede | ne olur |
|---|---|
| sırada, başlamamış | sırası gelince beklemeden ve istek atmadan reddedilir; sıra hemen arkasındaki işe geçer (aralık kuralı onun için de geçerli) |
| 1500 ms aralığı bekliyor | bekleme sürer; sonra istek atmadan reddedilir; son istek anı değişmez |
| istek uçuşta | istek kesilmez; yanıt gelene kadar sıra dolu kalır; yanıt ayrıştırılmadan reddedilir |
| 429/5xx/ağ hatası sonrası 5000 ms bekliyor | bekleme sürer; tekrar isteği atılmaz, reddedilir |
| kapatıldıktan sonra `next()` ya da `load()` çağrılıyor | sırası gelince istek atmadan reddedilir |

§1'deki senaryo düzeltmeden sonra:

| an | olay |
|---|---|
| 12 ms | eski oturum `?p=2` ister |
| 59 ms | sayfa 7 seçilir, `load(7)` sıraya girer |
| 112 ms | esc: `feed.dispose()`, `pageSource.dispose()` |
| 215 ms | yeniden açılır; yeni oturumun `next()`'i `load(7)`'nin arkasına girer |
| ~312 ms | eski `?p=2` yanıtı atılır; `load(7)` istek atmadan düşer; yeni `next()` aralığı bekler |
| ~1512 ms | yeni oturum `?p=2` ister |

## 6. `src/content/main.js`

- İmzaya yeni parametre: `main({ cssUrl, doc, fetchImpl, navigate, pageQueue = createPageQueue() })`; diğer parametreler ve varsayılanları aynı kalır. Sıra her `main` çağrısında, yani sekme başına bir kez kurulur (`loader.js` `main`'i sayfa başına bir kez çağırır). Testte `navigate` gibi sahte saatli bir sırayla değiştirilir.
- `startStories({ doc, fetchImpl, cssText, resolver, pageQueue, onClose })` sayfa kaynağını `createPageSource({ ..., queue: pageQueue })` ile kurar.
- Kapatınca sırayla `feed.dispose()`, `pageSource.dispose()` ve bugünkü `onClose(lastEntryId)` (entry'ye kaydırma ya da `focusto`) çalışır.

## 7. Story akışı ve görüntüleyici

- Kod değişmez.
- `dispose()` sonrasında `fetchNextPage` ve `runJump` işleyicileri `disposed` bayrağıyla erken döner: olay yayılmaz, `errorKind` değişmez.
- Görüntüleyici kapanırken `change` dinleyicisini bırakır ve DOM'dan kalkar; kapanan ekranda hata kartı çıkmaz. Yeni oturumun `feed`'i ayrıdır, eski oturumun reddini almaz.
- Oturum içinde `retry()`, `goToPage()`, art arda atlama ve hata kartları aynı kalır. Tek fark: yeni oturumun ilk sayfa isteği, önceki oturumun uçuştaki isteği ya da 429/5xx sonrası 5000 ms beklemesi bitene ve önceki oturumun son isteğinden 1500 ms geçene kadar bekler (bkz. §5).
- Konsolda "unhandled rejection" oluşmaz: sıranın zinciri reddi yutar, story akışı her `next()` ve `load()` sözüne hata işleyicisi bağlar.

## 8. Kapsam dışı

- Uçuştaki isteği `AbortController` ile kesmek (bkz. §2).
- Görsel çözümleyici (`createResolver`): `main()` içinde sekme başına zaten tektir ve "en fazla ikişer" kuralı oturumlar arasında da geçerlidir. Kapatınca sırada kalan birkaç `/img/` isteği yine gider ama önbelleğe girer; yeniden açınca tekrar istenmez.
- Oturumlar arasında sayfa sonucu paylaşmak: yeniden açınca aynı sayfa bugünkü gibi yeniden istenir.
- Playground (`dev/playground.js`): kendi sahte sayfa kaynağını kullanır, `main.js`'e bağlı değildir; değişmez.

## 9. Testler

### `test/page-source.test.js`

- Yardımcı: aynı sahte saati (`now`, `sleep`) paylaşan bir sıra kurulur; sayfa kaynakları bu sıra ve aynı `sleep` ile açılır. Mevcut testler aynı beklentilerle geçer.
- Yeni testler:
  1. İki kaynak aynı sırada: ikinci kaynağın `next()` isteği, ilkinin yanıtı gelmeden başlamaz; yanıt gelince 1500 ms beklenip atılır.
  2. Kapatılan kaynak: uçuştaki `next()` beklenir ve `AbortError` ile reddedilir; sıradaki `load(7)` istek atmadan `AbortError` ile reddedilir; aynı sıradan açılan yeni kaynak eski yanıt gelmeden istek atmaz, sonra 1500 ms bekleyip `?p=2` ister; `?p=7` hiç istenmez.
  3. Aralık beklenirken kapatma: istek atılmaz; aynı sıradaki yeni kaynağın isteği fazladan beklemez (bekleme listesinde yalnızca yarıda kalan 1500 ms olur).
  4. Uçuştaki istek 503 dönerken kapatma: 5000 ms beklenir, tekrar isteği atılmaz, söz `AbortError` ile reddedilir.
  5. Kapatıldıktan sonra çağrılan `next()` ve `load()` istek atmadan `AbortError` ile reddedilir.

### `test/story-feed.test.js`

6. Kapatıldıktan sonra reddedilen arka plan `next()`'i ve atlama `load()`'u `errorKind` yaratmaz. Story akışının kodu değişmediği için bu test yazıldığında geçer; davranışı sabitler.

### `test/main.smoke.test.js`

7. Kapatıp hemen yeniden açma. `main`'e sahte saatli `pageQueue` verilir, sayfa yanıtları testte elle bırakılır. İlk sayfada tek görsel olan 9 sayfalık başlık: aç (arka planda `?p=2` uçuşta) → seçim kutusundan 7 → esc → yeniden aç. Beklenenler:
   - eski yanıt bırakılmadan yeni sayfa isteği başlamaz;
   - bırakılınca yeni oturum 1500 ms bekleyip `?p=2` ister;
   - `?p=7` hiç istenmez;
   - hiçbir an iki sayfa isteği uçuşta olmaz;
   - yeni ekranda ilk sayfanın story'si görünür.

   Bu test mevcut kodda başarısız olur.

## 10. Belgeler

- `docs/superpowers/specs/2026-09-14-eksi-stories-design.md`: başındaki `Not:` satırının altına şu satır eklenir:

  ```markdown
  Not: §4 `createPageSource` imzası 2026-09-17-ortak-istek-sirasi-design.md ile güncellendi: sayfa istekleri sekme başına ortak sırada, sayfa kaynağında `dispose()` var.
  ```

- `docs/superpowers/specs/2026-09-16-sayfa-gostergesi-design.md`: `Durum:` satırının altına şu satır eklenir:

  ```markdown
  Not: §6 sayfa kaynağının sırası ve istek aralığı 2026-09-17-ortak-istek-sirasi-design.md ile sekme başına ortak sıraya taşındı.
  ```

- README, PRIVACY, store yazıları ve CHANGELOG değişmez. Anlattıkları davranış değişmiyor; "aynı anda tek sayfa ister" sözü kapatıp açınca da tutuyor. 0.1.0 henüz yayınlanmadı.

## 11. Doğrulama

1. `npm test` bütün testleri geçer.
2. §1'deki gerçek zamanlayıcılı jsdom denemesi yeniden çalıştırılır (betik repoya eklenmez, plan içinde verilir): hiçbir an iki sayfa isteği uçuşta olmaz, kapanan oturumun `?p=7` isteği yoktur, istek başlangıçları arasında en az 1500 ms vardır.
3. İsteğe bağlı, kullanıcının Chrome'unda (eklenti yenilendikten sonra): çok sayfalı başlıkta aç → sayfa seç → hemen kapat → yeniden aç; devtools network'te sayfa istekleri üst üste binmez, aralar en az 1,5 sn olur.
