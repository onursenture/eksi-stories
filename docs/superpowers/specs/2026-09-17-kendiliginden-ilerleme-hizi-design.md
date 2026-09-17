# kendiliğinden ilerleme hızı: tasarım

Tarih: 2026-09-17
Durum: Onaylandı (brainstorming sonucu).

## 1. Sorun

`2026-09-17-acilmayan-gorsel-siniri-design.md` §9 şu riski açık bıraktı: ekran önde açık ve durdurulmamışken, son açılan görselin sayfasından sonraki 5 sayfa içinde yeni bir görsel açıldıkça zincir sürer. Kullanıcı kararı (17.09.2026): Store yayınından önce ayrı bir tasarımla ele alınır.

Bu tasarımın ölçümü iki şey daha buldu:
- sayfada 10 entry varken yük, §9'daki 100 entry sayılarından büyük;
- seyrek başlıkta sayfa zinciri hiç hata olmadan da oluşuyor.

Bozulan sözler:
- README: "siteyi yormaz".
- Store yazısı: "görseller bitmeye yakın sonraki sayfa yavaşça yüklenir, siteyi yormaz."
- İlk tasarım §2: "sitenin işleyişine müdahale / yavaşlatma yasağı" ilkesi ve §2.2 "Hata durumunda hızlı döngü yoktur."

## 2. Risk değerlendirmesi

### 2.1 Ölçüm

Sanal saatli simülasyon yapıldı. Betik repoya eklenmedi, planda verilir.
- Gerçek `createStoryFeed`, `createPageSource`, `createPageQueue`, `createResolver` ve jsdom ayrıştırması kullanıldı.
- Görüntüleyici taklit edildi:
  - aktif story hazırsa görsel yüklenir;
  - görsel açılırsa 300 ms sonra `markOpened`, 5 sn sonra `next()` çağrılır;
  - direkt link açılmazsa 100 ms sonra `markFailed` çağrılır.
- Ekran önde açık, durdurulmamış ve ekrana dokunulmuyor. "Durdurulmuş" satırlarında `next()` hiç çağrılmaz.
- Başlık 22.000 sayfalık. Sayfa yanıtı 300 ms, `/img/` yanıtı 150 ms sürüyor (429'da 50 ms).
- 10 dakikalık sanal süre ölçüldü ve saate çevrildi.
- Son incelemenin sayıları yeniden üretildi: ~414 sayfa/saat (incelemede ~417), ölü direkt linkte ~324, 6 sayfada bir açılan görselde 89 sn'de duruyor.
- "Gösterim" ekrana gelen story sayısıdır. Görüntüleyici her gösterimde yazarın avatarını ister (`showStory`).

Bugünkü kod:

| durum | sayfa / saat | `/img/` / saat | gösterim / saat |
|---|---|---|---|
| normal oynatma, sayfada 100 entry | ~6 | ~700 | ~680 |
| normal oynatma, sayfada 10 entry | ~66 | ~700 | ~680 |
| 5 sayfada bir görsel açılıyor, diğerleri `/img/` 404, 100 entry | ~414 | ~41.400 | ~41.250 |
| aynısı, 10 entry (oturum kapalıyken varsayılan) | ~1.494 | ~15.000 | ~14.400 |
| aynısı, diğerleri ölü direkt link, 100 entry | ~324 | 0 | ~32.600 |
| aynısı, diğerleri ölü direkt link, 10 entry | ~1.482 | 0 | ~14.800 |
| aynısı, `/img/` 429 (50 ms), 100 entry | ~942 | ~94.800 | ~94.400 |
| görsellerin %30'u açılıyor, diğerleri ölü direkt link, 10 entry | ~246 | 0 | ~2.500 |
| 8 story'de bir görsel açılıyor, diğerleri `/img/` 404, 10 entry | ~486 | ~4.900 | ~3.700 |
| hata yok: 5 sayfada bir görsel var ve açılıyor, arası görselsiz | ~2.406 | ~480 | ~480 |

Durdurulmuş ekranda, hiçbir görseli açılmayan 100 entry'lik başlıkta zincir 46 sn'de duruyor: 5 sayfa, 600 `/img/`.

### 2.2 Bulgular

- **Kök neden: ekranın kendiliğinden ilerlemesi iki yerde zamana bağlı değil.**
  - **Açılmayan görsel neredeyse hiç süre harcamıyor.** `markFailed` aktif story'yi hemen atlatıyor, `ensureAhead()` sıradakileri çözümlüyor ve gerekirse sayfa istiyor. Zincirin hızını sunucunun hata hızı belirliyor.
  - **Görselsiz sayfa yalnızca 1,5 sn harcıyor.** 5 sayfa içinde bir görsel açıldıkça önden okuma sınıra takılmıyor. Sayfa aralığının izin verdiği en yüksek hızla, 1,5 sn'de bir sayfa istiyor.
- **Sayfada 10 entry varken sayfa yükü 3,6 kat.** §9 yalnızca 100 entry'yi ölçmüştü.
- **429 zinciri hızlandırıyor.** Site "yavaşla" deyince eklenti saniyede ~26 `/img/` isteğine çıkıyor.
- **Gösterimler de yük.** Hızlı atlamada her story ekrana gelip avatar istiyor: saatte ~94.000'e kadar. Tarayıcı önbelleği tekrarlanan avatarları azaltır; varsayılan avatarı kullanan yazarlar da tek istekte kalır.
- **Seyrek başlıkta hata gerekmiyor.** 5 sayfada bir açılan görseli olan başlıkta önden okuma ~2.400 sayfa/saat istiyor, başlığın sonuna ya da ekran kapanana kadar.

### 2.3 Olasılık ve sonuç

- Story kendiliğinden ilerlediği için önde açık bırakılıp unutulan ekran olağan bir kullanım.
- Ölü direkt linkli eski başlıklar ve metin ağırlıklı seyrek başlıklar gerçek.
- `/img/` sayfasının yapısı değişirse ya da ekşi `/img/` isteklerini sınırlarsa (429, 403), bütün kullanıcılarda ekşi görselleri aynı anda açılmaz. O zaman direkt linki de olan başlıklar zincire girer.
- Sonuç: bir kullanıcının tarayıcısı saatlerce bot gibi istek atabilir. Store yayınından önce düzeltilmeli.

## 3. Kararlar

- **Kural 1: açılmayan görsel sırasını bekler** (kullanıcı kararı, 17.09.2026).
  - Görseli açılmayan story atlanmaz. Diğer story'ler gibi ekranda kalır, 5 sn'lik çizgisi dolunca geçilir.
  - Ekran durdurulunca, sekme gizlenince, yazı açılınca ya da sayfa kutusu odaktayken bu story'nin süresi de durur.
  - → ile hemen geçilir, ← ile ona dönülür.
  - Sonuç: ekran kendiliğinden 5 sn'de birden fazla story geçmez. `/img/` istekleri, gösterimler ve hatadan doğan sayfa istekleri normal oynatma hızını geçmez.
- **Kural 2: önden okuma hakla gider** (kullanıcı kararı, 17.09.2026).
  - Sekmenin sayfa sırasında `EMPTY_PAGE_LIMIT` (5) hak var. Her "sonraki sayfa" isteği bir hak harcar, her `STORY_DURATION_MS`'de (5 sn) bir hak geri gelir. Hak yoksa istek, bir hak dolana kadar bekler.
  - 1,5 sn aralık ve aynı anda tek istek kuralları da geçerli kalır. Aralıklar sırasında da hak dolduğu için art arda ~6 sayfa hızlı gider, sonra 5 sn'de bir sayfaya inilir.
  - Sayfa atlama hak harcamaz: seçim kutusu, «, », son sayfa ve atlama hatasındaki `tekrar dene`.
  - Hakları yalnızca zaman doldurur: kapatıp açmak ve `aramaya devam` doldurmaz (kullanıcı kararı, 17.09.2026).
  - Haklar mevcut iki sabite bağlanır, yeni sabit eklenmez (kullanıcı kararı, 17.09.2026).
- **Açılmayan story'nin görünüşü** (kullanıcı kararı, 17.09.2026):
  - yüklenirken görünen 9:16 kutu kullanılır;
  - dönen simge yerine ortada `görsel açılmadı` yazar;
  - bulanık arka plan boşalır, arka plan siyah olur.
- **Kalkanlar:**
  - `görsel açılmadı, geçildi` bildirimi;
  - story akışında atlama ve `skipped` olayı;
  - `TOAST_MS`.
- **Değişmeyenler:**
  - aynı anda tek sayfa isteği, istek başlangıçları arasında en az 1500 ms;
  - 429/5xx/ağ hatasında 5000 ms bekleyip tek tekrar;
  - `/img/` eşzamanlılığı (2) ve `/img/` hatalarının önbelleklenmesi;
  - son açılan görselin sayfasından sonra 5 sayfa sınırı, `5 sayfadır açılan görsel yok` kartı ve `aramaya devam`;
  - kapatma davranışı (kapatmak hiçbir beklemeyi kısaltmaz) ve sekme başına sıra;
  - `EMPTY_PAGE_LIMIT`, `STORY_DURATION_MS`, `PAGE_MIN_GAP_MS` ve `PAGE_RETRY_DELAY_MS` değerleri.
- **Bedeller:**
  - Bir entry'nin bütün görselleri açılmazsa her biri 5 sn sürer.
  - Ölü linkli eski başlıklarda açılmayan story'ler ekranda kalır; → ile geçilir.
  - Haklar bitmişken `aramaya devam`dan sonraki kart ~16 sn'de gelir, bugün ~6 sn. Ölçüm: ilk karttan 3 sn sonra basıldı.
  - Seyrek başlıkta iki görsel arası bugün ~7,5 sn. İlk seferde ~5 sn kalır, sonra ~15 sn ve ~25 sn olur.

### 3.1 Seçilmeyen yaklaşımlar

Hepsi §2.1'deki gibi, scratchpad'deki prototiplerle ölçüldü. Sayılar sayfa/saat · `/img/`/saat.

| yaklaşım | 404, 10 entry | ölü direkt, 10 entry | 429, 100 entry | seyrek, hatasız | durdurulmuş, 100 entry, 404 |
|---|---|---|---|---|---|
| bugün | ~1.494 · ~15.000 | ~1.482 | ~942 · ~94.800 | ~2.406 | 46 sn'de durur, 600 `/img/` |
| **seçilen: Kural 1 + Kural 2** | ~72 · ~730 | ~72 | ~6 · ~730 | ~750 | hemen durur, 3 `/img/` |
| art arda 10 açılmayan görselde kart | durur | durur | durur | ~2.406 | hemen durur, 12 `/img/` |
| `/img/` başlangıçları arası 1 sn, 429/5xx'te 5 sn bekleyip tek tekrar | ~342 · ~3.400 | ~1.482 | ~6 · ~2.000 | ~2.406 | 599 sn'de durur, 600 `/img/` |
| arayüz aynı, çözümleme hakkı (3 hak, 5 sn'de bir) | ~72 · ~740 | ~72 | ~6 · ~740 | ~2.406 | sayfa sınırına kadar ~6 · ~740 sürer |
| açılmayan story 1,5 sn | ~228 · ~2.300 | ~216 | ~24 · ~2.400 | ~2.406 | hemen durur, 3 `/img/` |
| yalnızca önden okumada düz 5 sn aralık | ~696 · ~7.000 | ~690 | ~642 · ~64.700 | ~726 | 46 sn'de durur, 600 `/img/` |

- **Art arda açılmayan görsel sınırı:**
  - Hızı sınırlamıyor: 8 story'de bir görsel açılan başlıkta hiç devreye girmedi (~486 sayfa/saat, ~4.900 `/img/`/saat).
  - %30'u açılan eski başlıkta 135 sn'de kart çıktı.
  - Story ortasında yeni bir kart gerekiyor.
- **`/img/` aralığı ve 429'da bekleme:**
  - Ölü direkt linkte ve seyrek başlıkta etkisiz.
  - 404 zinciri normal oynatmanın ~5 katında kalıyor.
- **Arayüz aynı, arka planda çözümleme hakkı:**
  - Hızlar Kural 1 ile aynı, ama story akışına saat giriyor.
  - Durdurulmuş ekranda sayfa sınırına kadar sürüyor (100 entry'de ~40 dk).
  - Elle hızlı geçişin takılmaması için elle/kendiliğinden ayrımı gerekiyor.
  - Açılmayan görsel, dönen simgeyle bekliyor.
- **Açılmayan story'yi kısa göstermek (1,5 sn):** normalin ~3,3 katına izin veriyor ve ikinci bir süre sabiti gerektiriyor.
- **Önden okumada düz 5 sn aralık:**
  - Görselsiz 5 sayfadan sonraki kart ~6 sn yerine ~20 sn'de geliyor.
  - Seyrek başlıkta görsel ~25 sn'de bir geliyor.
  - Metin başlığında butona basan her kullanıcı bu beklemeyi görür.
- **`aramaya devam` hakları doldursun:** her basışta 5 sayfa bugünkü hızla aranır, kart ~6 sn'de gelir. Kullanıcı hakları yalnızca zamanın doldurmasını seçti.
- **Önceki görselin bulanık arka planı kalsın:** başka bir entry'nin görseli 5 sn arkada kalır. Kullanıcı siyah arka planı seçti.
- **Ayrı sabitler (`FETCH_AHEAD_BURST`, `FETCH_AHEAD_REFILL_MS`):** sayfa sınırı ya da story süresi değişince haklar kendiliğinden değişmez. Kullanıcı mevcut sabitleri seçti.
- **Kimse yokken durmak (dokunulmadan N dakika ya da N sayfa sonra kart):**
  - Değerlendirildi, önerilmedi.
  - Süreyi sınırlar ama hızı düşürmez: seyrek başlıkta 10 dakikada ~400 sayfa istenir.
  - Kendiliğinden izleyen kullanıcıyı da böler.

## 4. Story akışı (`src/core/story-feed.js`)

- **`markFailed(story)`:**
  - `disposed` doğruysa ya da story zaten `failed` ise hiçbir şey yapmaz.
  - Değilse `status = 'failed'` ve `resolvedUrl = null` yapar, `ensureAhead()` çalıştırır ve `change` yayar.
  - Aktif story yerinden oynamaz, `skipped` yayılmaz.
- **Gezinme açılmayan story'leri atlamaz:**
  - `start()`: `index = 0`.
  - `next()`: `index = Math.min(index + 1, stories.length)`.
  - `prev()`: `index = Math.max(index - 1, 0)`. Sonun ötesindeyken son story'ye döner, bugünkü gibi.
  - `goTo(target)`: hedef `0` ile `stories.length` arasına sıkıştırılır.
  - `goToPage`, tampondaki sayfa: bugünkü `findIndex` ile hedef sayfanın ya da sonraki sayfaların ilk story'si. Atlama yok.
  - Atlama sonucu (`runJump`): `index = 0`.
- **Kalkanlar:**
  - `playableFrom`, `forwardFrom`, `direction`, `announced`, `listeners.skipped`;
  - `moveTo`'nun ikinci parametresi ve "geçilen başarısız story'leri topla" kodu.
  - `moveTo(newIndex)` artık yalnızca `index = newIndex` yapar, `ensureAhead()` çalıştırır ve `change` yayar.
- `on(event, listener)` yalnızca `change` için kalır.
- **Aynı kalanlar:**
  - `appendEntries`, `resolveStory` (yalnızca `pending` story çözülür) ve `ensureAhead`;
  - sayfa sınırı (`searchLimitReached`, `isBlocked`), `markOpened`, `continueSearching`, `retry`;
  - `goToPage`'in atlama kolu ve `state` alanları.
- **Yan etki:** açılmayan story aktifken `ensureAhead()` bugünkü gibi sonraki 2 story'yi çözümler ve tamponda 3'ten az story kalınca sayfa ister. Index ilerlemedikçe bu işler bir kez yapılır.

## 5. Görüntüleyici (`src/viewer/viewer.js`, `src/viewer/viewer.css`)

- **Yeni öğe: `görsel açılmadı` yazısı (`.es-failed`).**
  - `stage` içinde, dönen simgeyle aynı yerde, ortada durur. `role="status"` taşır, başta gizlidir.
  - Gösterilirken metni yazılır, gizlenirken boşaltılır. Böylece ekran okuyucu her açılmayan story'de duyurur, kalkan bildirimin yaptığı gibi.
- **`render()`'da aktif story `failed` ise:**
  - story değiştiyse `showStory` bugünkü gibi yazar, tarih, yazı, avatar ve 9:16 kutuyu (`is-loading`) kurar;
  - dönen simge gizlenir (`spinner.hidden`), `görsel açılmadı` görünür, bulanık arka plan boşalır (`backdrop.removeAttribute('src')`);
  - çizgi `renderProgress(story, true)` ile dolmaya başlar. Story ekrana her gelişinde bir kez başlar: aynı gösterimdeki sonraki `render()` çağrıları çizgiyi baştan başlatmaz, ← ile geri dönülünce çizgi yeniden dolar;
  - süre dolunca mevcut `animationend` (`es-fill`) → `feed.next()` yolu geçişi yapar. Durdurma nedenleri (`is-paused`) bu çizgiyi de durdurur.
- `showStory` yazıyı gizler.
- `image.onload` ve `image.onerror` aynı kalır. `<img>` hatası `feed.markFailed(story)` çağırır; ardından `change` gelir ve story yukarıdaki duruma geçer. Ekşi görselinde `/img/` hatası da story akışı üzerinden aynı yere varır.
- `preloadNext()` aynı kalır: sıradaki story açılmadıysa önden yüklenmez.
- **Kalkanlar:**
  - `.es-toast` öğesi ve stili;
  - `showToast`, `toastTimer`, `feed.on('skipped', ...)`, `TOAST_MS` içe aktarımı;
  - `close()` içindeki bildirim zamanlayıcısı temizliği.
- **CSS:**
  - `.es-failed`: kart yazısıyla aynı boyut (16 px), `margin: 0`, `pointer-events: none`.
  - Kutu `.es-frame.is-loading` kuralını kullanır, yeni boyut kuralı yok.

## 6. Sayfa sırası (`src/core/page-source.js`)

```js
export function createPageQueue({
  minGapMs = PAGE_MIN_GAP_MS,
  fetchAheadBurst = EMPTY_PAGE_LIMIT,
  fetchAheadRefillMs = STORY_DURATION_MS,
  now = () => performance.now(),
  sleep = defaultSleep,
} = {})
// → { run(job, signal), pace(signal, { fetchAhead = false } = {}) }
```

- Haklar sırada tutulur, sekme başına tektir. Sıra kurulurken haklar doludur.
- **Hesap milisaniye bütçesiyle yapılır; sahte saatle beklemeler tam sayı çıkar:**
  - bütçe başta `fetchAheadBurst × fetchAheadRefillMs`;
  - doldurma: `bütçe = Math.min(tavan, bütçe + (now() - sonDoldurma))`;
  - hak var demek `bütçe >= fetchAheadRefillMs` demek;
  - harcama: `bütçe -= fetchAheadRefillMs`.
- **`pace(signal, { fetchAhead })` sırası:**
  1. `lastRequestAt + minGapMs - now()` sıfırdan büyükse o kadar `sleep`.
  2. `fetchAhead` ise bütçeyi doldurur. Hak yoksa `fetchAheadRefillMs - bütçe` kadar `sleep`.
  3. `signal.throwIfAborted()`. İptal edildiyse hak harcanmaz, son istek anı değişmez.
  4. `fetchAhead` ise bütçeyi doldurur ve bir hak harcar.
  5. `lastRequestAt = now()`.
- `fetchAhead` verilmeyen `pace` bugünküyle aynıdır.
- **`createPageSource`:**
  - `request(url, options)` → `queue.pace(signal, options)`;
  - `fetchPage(page, options)` ilk isteğe de tekrara da aynı seçeneği verir;
  - `enqueue(pickPageFn, options)`: `next()` `{ fetchAhead: true }` verir, `load(page)` seçenek vermez;
  - art arda aynı sayfa istenip son sonuç dönerse istek atılmaz ve hak harcanmaz.
- **JSDoc** (`createPageQueue`), eklenecek cümle: "Önden okuma istekleri (`fetchAhead`) ayrıca hak harcar: `fetchAheadBurst` hak vardır, her `fetchAheadRefillMs`'de bir hak dolar, hak yoksa dolana kadar beklenir. Varsayılanlar sayfa sınırı ve story süresidir: tek bir görselsiz bölüm hızlı taranır, uzun zincir story süresinden hızlı sayfa istemez."
- **Kapatma davranışına** (`2026-09-17-ortak-istek-sirasi-design.md` §5) bir satır eklenir:

  | kapatıldığı an iş nerede | ne olur |
  |---|---|
  | önden okuma hakkı bekliyor | bekleme sürer; sonra istek atmadan reddedilir; hak harcanmaz, son istek anı değişmez |

- `src/content/main.js` değişmez: sıra yine `createPageQueue()` varsayılanlarıyla, sekme başına bir kez kurulur.

## 7. Sabitler (`src/core/constants.js`)

- `TOAST_MS` kalkar.
- Yeni sabit eklenmez. `page-source.js`, `EMPTY_PAGE_LIMIT` ve `STORY_DURATION_MS`'i de içe aktarır.

## 8. Metinler ve belgeler

- **Görüntüleyici:** yeni metin `görsel açılmadı`, kalkan metin `görsel açılmadı, geçildi`.
- **`README.md`, "kurallar" bölümündeki madde:**

  ```markdown
  - siteyi yormaz: her sekmede aynı anda tek sayfa ister, sayfa istekleri arasında en az 1,5 saniye bekler, sonraki sayfaları art arda 5 sayfadan sonra 5 saniyede bir okur, görsel sayfalarını en fazla ikişer açar, görsel açılmasa da 5 saniye bekler, 5 sayfa boyunca görsel açılmazsa durur.
  ```

- README'nin "ne yapar" ve "elle test" bölümleri değişmez. Görseli açılmayan bir entry'yi canlıda bulmak güvenilir değil; playground (§9) karşılar.
- **Store yazıları, PRIVACY ve CHANGELOG değişmez.**
  - Store'daki "5 saniyede bir geçer" ve "sonraki sayfa yavaşça yüklenir, siteyi yormaz" sözleri artık her durumda doğru.
  - PRIVACY istek sayısı vermez.
  - CHANGELOG atlamadan ve istek kurallarından söz etmez; 0.1.0 da henüz yayınlanmadı.
- **Eski spec'lerin gövdesi değişmez.** Başlarındaki `Durum:` satırının ya da son `Not:` satırının altına birer not eklenir:
  - `docs/superpowers/specs/2026-09-14-eksi-stories-design.md`:

    ```markdown
    Not: §7'deki "otomatik atlanır" ve "grup atlanır" satırları ile §10'daki toast süresi 2026-09-17-kendiliginden-ilerleme-hizi-design.md ile değişti: açılmayan görsel atlanmaz, `görsel açılmadı` yazısıyla 5 sn gösterilir. §2.2 ve §5'teki önden okuma aynı belgeyle hakla sınırlandı.
    ```

  - `docs/superpowers/specs/2026-09-16-eksi-dili-metinler-design.md`:

    ```markdown
    Not: §4'teki bozuk görsel bildirimi 2026-09-17-kendiliginden-ilerleme-hizi-design.md ile kalktı; açılmayan story'de `görsel açılmadı` yazar.
    ```

  - `docs/superpowers/specs/2026-09-16-sayfa-gostergesi-design.md`:

    ```markdown
    Not: §5'teki `.es-toast` konumu 2026-09-17-kendiliginden-ilerleme-hizi-design.md ile bildirim kalkınca geçersiz oldu.
    ```

  - `docs/superpowers/specs/2026-09-17-ortak-istek-sirasi-design.md`:

    ```markdown
    Not: §3 `createPageQueue` ve §5 kapatma tablosu 2026-09-17-kendiliginden-ilerleme-hizi-design.md ile önden okuma haklarını da kapsar.
    ```

  - `docs/superpowers/specs/2026-09-17-istek-sirasi-sinirlari-design.md`:

    ```markdown
    Not: §2.1'de anlatılan, görseli açılmayan story'nin kendiliğinden atlanması 2026-09-17-kendiliginden-ilerleme-hizi-design.md ile kalktı.
    ```

  - `docs/superpowers/specs/2026-09-17-acilmayan-gorsel-siniri-design.md`:

    ```markdown
    Not: §9'daki önde açık ekran riski 2026-09-17-kendiliginden-ilerleme-hizi-design.md ile ele alındı; §3 ve §7'deki "görsel açılmadı, geçildi" bildirimi aynı belgeyle kalktı.
    ```

## 9. Playground (`dev/playground.js`)

- Kod değişmez.
- **Senaryo 1** (`çoklu görsel + bozuk görsel`): ikinci görsel 5 sn'lik bir `görsel açılmadı` story'si olur.
- **Senaryo 5** (`açılmayan görseller → aramaya devam`): 2–6. sayfaların görselleri sırayla 5'er sn gösterilir, sonra `5 sayfadır açılan görsel yok` kartı gelir. `aramaya devam` 7. sayfanın görselini açar.
- Playground kendi sahte sayfa kaynağını kullandığı için haklar orada görünmez. Onları simülasyon ve testler karşılar.

## 10. Testler

### `test/story-feed.test.js`

Şu dört test kalkar:
- `başarısız olduğu bilinen story gezinmede atlanır`
- `aktif story başarısız olunca atlanır ve skipped yayılır`
- `tamamen başarısız grup tek bildirim verir, geri dönünce tekrar bildirilmez`
- `geri giderken başarısız story geriye atlanır; geride yoksa ileri gidilir`

Yerlerine iki test gelir. İkisi de bugünkü kodda başarısız olur.

1. `açılmayan story gezinmede atlanmaz`
   - Kurulum: tek entry'de `a`, `bad`, `c` görselleri var; `bad` çözümlenemez.
   - `start()` ve `flush` sonrası `next()` ile aktif story `bad` olur ve `failed` durumundadır.
   - `next()` ile `c`'ye, `prev()` ile yine `bad`'e gelinir.
2. `aktif story açılmayınca yerinde kalır`
   - Kurulum: `bad` ve `b`.
   - `start()` ve `flush` sonrası aktif story hâlâ `bad` ve `failed`; `change` yayılmıştır.
   - `markFailed` yeniden çağrılınca hiçbir şey değişmez.
   - `next()` ile `b`'ye geçilir.

Açılmayan görsel sınırı testleri (`görselleri açılmayan sayfalar da 5 sayfa sınırına sayılır`, `görsel açılınca sayım o görselin sayfasından yeniden başlar`, `aktif olmayan story için markOpened yok sayılır`, `atlamada açılan görselin sayfası sıfırlanır`, `tampondaki sayfaya geçiş sayfa sınırını sıfırlamaz`) aynı sonuçları sabitlemeye devam eder. Açılmayan story'lerin üzerinden artık `next()` ile geçilir.

### `test/page-source.test.js`

Üç yeni test eklenir. `makeTab` yardımcısındaki sahte saat kullanılır, yanıtlar anında döner.

3. `önden okuma hakları bitince sonraki sayfa bir hak dolana kadar bekler`
   - Art arda 8 kez `next()` çağrılır.
   - Beklemeler: `[1500, 1500, 1500, 1500, 1500, 1500, 1000, 1500, 3500]`.
   - İstek başlangıçları: 0, 1500, 3000, 4500, 6000, 7500, 10000 ve 15000 ms.
   - Bugünkü kodda beklemeler yedi kez 1500 olduğu için test başarısız olur.
4. `sayfa atlama hak harcamaz`
   - 6 `next()` sonrası `load(9)` yalnızca 1500 ms bekler, ardından gelen `next()` de yalnızca 1500 ms bekler.
   - `load` hak harcasaydı son beklemeler `1500, 1000, 1500, 3500` olurdu.
   - Bugünkü kodda da geçer; davranışı sabitler.
5. `hak beklerken kapatılınca istek atılmaz ve hak harcanmaz`
   - 6 `next()` sonrası 7. `next()`, 1000 ms'lik hak beklemesindeyken (`clock.onSleep`) `dispose()` edilir.
   - Söz `AbortError` ile reddedilir, istek atılmaz.
   - Aynı sıradan açılan yeni kaynağın `next()` isteği yeni bir bekleme olmadan gider.
   - Bugünkü kodda hak beklemesi olmadığı için test başarısız olur.

Mevcut `istekler arasında en az 1500 ms beklenir` testi üç istek attığı için değişmeden geçer.

### `test/main.smoke.test.js`

6. `görselleri açılmayan başlıkta gizli sekme 5 sayfadan sonra durur` testinin yerine `açılmayan görsel ekranda kalır, süresi dolunca sonraki story gelir` gelir.
   - Kurulum: `brokenImagesSetup()`, bütün `/img/` istekleri 404.
   - Açılıştan ve `/img/` yanıtlarından sonra:
     - yazar hâlâ `sayfa 1 yazarı`, sayaç `1/4`;
     - `.es-failed` görünür ve metni `görsel açılmadı`, dönen simge gizli, `.es-toast` yok;
     - 3 `/img/` isteği gitmiş, sayfa isteği yok.
   - Aktif çizgide `animationend` (`es-fill`) tetiklenince sayaç `2/4` olur, 4. `/img/` isteği gider ve tamponda 3'ten az story kaldığı için `?p=2` istenir. jsdom animasyon çalıştırmadığı için olay elle tetiklenir.
   - Bugünkü kodda story atlandığı için test başarısız olur.
7. `görsel açılınca önden okuma o görselin sayfasından sürer`
   - Açılmayan görsellerin yerine 1–5. sayfalar görselsiz olur; 6. sayfada açılan tek bir görsel vardır.
   - Beklentiler aynı: `load` tetiklenmeden `?p=2` … `?p=6` istenir, tetiklenince `?p=7`.
   - Görüntüleyicideki `markOpened` çağrısını açılmayan görsellere dayanmadan sabitler. Bugünkü kodda da geçer.

Test sayısı 96'dan 97'ye çıkar.

## 11. Kapsam dışı

- **429/5xx/ağ hatasında `/img/` sonucunu kalıcı önbelleğe almamak ve 429'da beklemek.** Bu tasarımdan sonra yüke etkisi yok, çünkü açılmayan görsel 5 sn sürer. Yalnızca kapatıp açınca görselin yeniden denenmesini sağlar. v0.2'de kalır.
- Hiç yanıt gelmeyen görsel için zaman aşımı.
- Elle hızlı geçişte ya da sayfa atlamada ek sınır. Bunlar insan hızıyla sınırlı.
- Sekmeler arası sıra, `focusto` gezintisinin zamanlaması ve kapatınca uçuştaki isteği kesmek (`2026-09-17-istek-sirasi-sinirlari-design.md` §3 ve §7).
- Normal oynatmanın hızı. Sayfada 10 entry'de ~66 sayfa/saat, 100 entry'de ~6 sayfa/saat; bu tasarım bunu değiştirmez.

## 12. Doğrulama

1. 1, 2, 3, 5 ve 6. testler değişiklikten önce başarısız olur. 4 ve 7 bugünkü davranışı sabitler.
2. Değişiklikten sonra `npm test` ile 97 test geçer.
3. Simülasyon betiği (planda) çalıştırılır. Sonuçlar şu değerlere yakın olur ve bütün senaryolarda sayfa istekleri arasında en az 1500 ms vardır:

   | durum | beklenen |
   |---|---|
   | 5 sayfada bir açılan görsel, diğerleri `/img/` 404, 100 entry | ~6 sayfa/saat, ~730 `/img/`/saat |
   | aynısı, 10 entry | ~72 sayfa/saat, ~730 `/img/`/saat |
   | aynısı, ölü direkt link, 100 entry | ~6 sayfa/saat |
   | aynısı, ölü direkt link, 10 entry | ~72 sayfa/saat |
   | aynısı, `/img/` 429 (50 ms), 100 entry | ~6 sayfa/saat, ~730 `/img/`/saat |
   | görsellerin %30'u açılıyor, diğerleri ölü direkt link, 10 entry | ~66 sayfa/saat |
   | seyrek, hatasız (5 sayfada bir görsel), 10 entry | ~750 sayfa/saat |
   | normal oynatma, 10 / 100 entry | ~66 / ~6 sayfa/saat, ~700 `/img/`/saat |
   | durdurulmuş, 100 entry, hiçbiri açılmıyor, `/img/` 404 | 0 sayfa, 3 `/img/` |
   | durdurulmuş, 10 entry, hiçbiri açılmıyor, ölü direkt link | 0 sayfa |
   | açılan görselden sonra görselsiz sayfalar | kart ~6,3 sn'de |
   | haklar bitmişken, ilk karttan 3 sn sonra `aramaya devam` | yeni kart basıştan ~16 sn sonra |

4. Playground uygulama içi tarayıcıda denenir:
   - Senaryo 1'de açılmayan story'nin görünüşüne bakılır: 9:16 kutu, ortada `görsel açılmadı`, siyah arka plan, 5 sn'de dolan çizgi. → ile geçiş ve boşlukla durdurma denenir. Görünüşü kullanıcı da onaylar.
   - Senaryo 5'te beş açılmayan story'den sonra kart gelir ve `aramaya devam` çalışır.
   - Diğer senaryolar aynı kalır.
5. `git diff main --stat` yalnızca şu dosyaları gösterir:
   - `src/core/story-feed.js`, `src/core/page-source.js`, `src/core/constants.js`;
   - `src/viewer/viewer.js`, `src/viewer/viewer.css`;
   - `test/story-feed.test.js`, `test/page-source.test.js`, `test/main.smoke.test.js`;
   - `README.md`;
   - `Not:` satırı eklenen altı eski spec, bu belge ve planı.
6. Canlı Chrome kontrolü isteğe bağlı:
   - ölü linkli eski bir entry'de `görsel açılmadı` 5 sn görünüyor mu;
   - seyrek bir başlıkta devtools network'te art arda ~6 sayfadan sonra aralık 5 sn'ye çıkıyor mu.
