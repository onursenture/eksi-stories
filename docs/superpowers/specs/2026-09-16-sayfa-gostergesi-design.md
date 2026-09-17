# sayfa göstergesi, sayaç ve avatar: tasarım

Tarih: 2026-09-16
Durum: Onaylandı. Plan yazılırken §5, §6 ve §9 netleştirildi: tampondaki görselsiz sayfalar, aynı sayfanın iki kez istenmemesi, odak ve başarısız atlama.

## 1. Kararlar

- **Sayaç:** story üst barındaki "sayfa N/M" yerine sayfa içi sayaç gelir: `k/n`. `n` o sayfanın tampondaki görsel sayısı, `k` o sayfadaki kaçıncı görsel olduğu. Sonraki sayfaya geçince 1'den başlar.
- **Sayfa göstergesi:** ekşi sözlük'ün koyu temadaki sayfa göstergesi birebir kopyalanıp story ekranının sağ üstüne konur ve sayfa değiştirmeyi sağlar.
- **Yerleşim:** gösterge için ekranın en üstünde şerit ayrılır; story'ler şeridin altına yerleşir. Tek sayfalı başlıkta gösterge ve şerit yoktur.
- **Kapatma:** son bakılan entry açılan sayfadaysa ona kayılır; değilse ekşi'nin `focusto` adresiyle o entry'ye gidilir.
- **Yaklaşım:** sayfa kaynağı istenen sayfayı yükleyebilir hale gelir, story akışı sayfa atlamayı yönetir. İstek kuralları tek yerde kalır.
- **Avatar:** story üst barında yazar adının solunda avatar durur ("avatar - isim").
- Yeni metinler `docs/superpowers/specs/2026-09-16-eksi-dili-metinler-design.md` dil kurallarına uyar.

## 2. Önceki tasarımdan değişenler

`docs/superpowers/specs/2026-09-14-eksi-stories-design.md` için:

- §3 ve §5 "geri gitme yalnızca tampon içinde" aynen geçerli. Sayfa atlandığında tampon hedef sayfadan yeniden başlar.
- §4 veri modeli: `Entry`'ye `avatarUrl: string` eklenir. `createPageSource` sonucuna `load(page)` eklenir. `createStoryFeed` sonucuna `goToPage(page)` ve yeni `state` alanları eklenir.
- §5 kapatma: "son izlenen entry mevcut DOM'daysa ona kaydırılır" korunur; DOM'da değilse `focusto` adresine gidilir.
- §6 üst bar: "sayfa N/M" kalkar, yerine sayaç gelir; yazar adının soluna avatar eklenir. Sağ üstte sayfa göstergesi ve üst şerit eklenir.

## 3. Entry avatarı

### Ayrıştırma (`src/core/entry-parser.js`)

- Kaynak: `li footer .avatar-container img.avatar` öğesinin `src` değeri. Canlı sitede ve `fetch` ile çekilen sayfa HTML'inde her entry'de bulunur.
- Değer `new URL(src, EKSI_ORIGIN).href` ile mutlak adrese çevrilir. Ekşi adresleri protokolsüz verebilir (`//ekstat.com/...`).
- Açık temanın varsayılan çizimi koyu sürüme çevrilir: adres `default-profile-picture-light.svg` ile bitiyorsa sonu `default-profile-picture-dark.svg` olur.
- `img.avatar` yoksa ya da `src` boşsa `avatarUrl` değeri `DEFAULT_AVATAR_URL` olur.
- Yeni sabit (`src/core/constants.js`): `DEFAULT_AVATAR_URL = 'https://ekstat.com/img/default-profile-picture-dark.svg'`.

Gerçek örnekler:
- kişisel avatar: `https://img.ekstat.com/profiles/<nick>-<sayı>.jpg`
- varsayılan (koyu tema): `//ekstat.com/img/default-profile-picture-dark.svg`
- `img.avatar` üzerinde `data-default="//ekstat.com/img/default-profile-picture-dark.svg"`, `alt` ve `title` yazar adıdır. Görsel `/biri/<nick>` linkinin içindedir.

### Gösterim (`src/viewer/viewer.js`)

- `a.es-author` linkinin içi: `img.es-avatar` + `span.es-author-name`. Link `href` değeri bugünkü gibi `entry.authorUrl`.
- `img.es-avatar`: `alt=""`, `src = entry.avatarUrl`. `error` olayında `src` bir kez `DEFAULT_AVATAR_URL` yapılır; o da yüklenemezse görsel gizlenir (`hidden`). Her story değişiminde görsel yeniden gösterilir ve hata sayacı sıfırlanır.
- CSS: `width: 24px; height: 24px; margin-right: 8px; border-radius: 50%; object-fit: cover; vertical-align: middle; background: rgba(255, 255, 255, 0.12)`. Avatar yazının içinde durur ve yazıya göre ortalanır. `.es-info` `align-items: baseline` olur: isim, tarih, `entry'ye git` ve sayaç ortak taban çizgisine oturur (kullanıcı isteği, 17.09.2026). Uzun isim `.es-info > *` kuralıyla `…` olarak kısalır; avatar gizlenince boşluğu da kalkar.

## 4. Sayfa içi sayaç

- `.es-page` öğesi `.es-counter` olarak yeniden adlandırılır, yeri ve stili aynı kalır (12 px, `opacity: 0.75`).
- Metin: `` `${state.pagePosition}/${state.pageStoryCount}` ``, örneğin `5/12`. Boşluk yoktur.
- `pageStoryCount`: tampondaki, `page` değeri aktif story'nin sayfasıyla aynı olan story sayısı. Açılmayan (`failed`) story'ler dahildir.
- `pagePosition`: aynı sayfanın story'leri arasında aktif story'nin 1'den başlayan sırası.
- Aktif story yoksa (kartlar) sayaç gösterilmez; kartta üst bar zaten gizlidir.

## 5. Sayfa göstergesi

### Görünürlük ve şerit

- `state.pageCount > 1` ise gösterge görünür ve `.es-root` öğesine `has-pager` sınıfı eklenir; değilse ikisi de yoktur.
- Şerit yüksekliği CSS değişkeni: `--es-strip: 51px` (12 px boşluk + 27 px gösterge + 12 px boşluk). `has-pager` yoksa `--es-strip: 0px`.
- `.es-stage` `top: var(--es-strip)` ile başlar.
- `.es-image` `max-height: calc(100vh - var(--es-strip))` olur.
- `.es-frame.is-loading` yer tutucusu: `height: calc(100vh - var(--es-strip))`, `width: min(100vw, calc((100vh - var(--es-strip)) * 9 / 16))`.
- Bulanık arka plan (`.es-backdrop`) ekranın tamamını kaplamaya devam eder.

### Yapı

`.es-root` içinde, `.es-stage` ile kardeş: `div.es-pager`, `position: absolute; top: 12px; right: 12px`. Çocuklar sırayla:

1. `button.es-pager-prev` `type="button" title="önceki sayfa"`, yazı `«`. Yalnızca `page > 1` iken vardır.
2. `select.es-pager-select` `aria-label="sayfa"`, 1'den `pageCount`'a kadar `option`; seçili değer `page`.
3. `span.es-pager-sep`, yazı `/`.
4. `button.es-pager-last` `type="button" title="son sayfa"`, yazı `pageCount`.
5. `button.es-pager-next` `type="button" title="sonraki sayfa"`, yazı `»`. Yalnızca `page < pageCount` iken vardır.

`option` listesi yalnızca `pageCount` değiştiğinde yeniden kurulur (22 binden fazla sayfalı başlıklar olabilir); diğer güncellemelerde yalnızca `select.value` değişir.

### Görünüm (ekşi koyu tema ölçümü, 16.09.2026)

- `.es-pager`: `font-family: "Source Sans Pro", sans-serif; font-size: 14px; line-height: 22.652px; color: rgb(102, 102, 102); white-space: nowrap; display: flex; align-items: center`.
- `.es-pager-select`: `box-sizing: border-box; height: 26px; padding: 2px; margin: 0 5px; font: inherit; font-size: 14px; color: rgb(255, 255, 255); background-color: rgb(71, 71, 71); border: 1px solid rgb(73, 73, 73); border-radius: 4px; appearance: auto; color-scheme: normal`.
- `.es-pager-prev`, `.es-pager-last`, `.es-pager-next`: `box-sizing: border-box; height: 26.6484px; padding: 1px 8px; margin: 0 0 0 5px; font: inherit; font-size: 14px; line-height: 22.652px; color: rgb(189, 189, 189); background-color: transparent; border: 1px solid rgb(73, 73, 73); border-radius: 4px; cursor: pointer`. Hover: `background-color: rgb(31, 31, 31)`. Klavye odağı: `outline: 2px solid #fff; outline-offset: 2px` (yalnızca `:focus-visible`).
- `.es-pager-prev` ilk öğe olduğunda da sol boşluğu 5 px'tir (ekşi'deki gibi).

### Davranış

- `select` değişince: `feed.goToPage(Number(select.value))`.
- `«`: `feed.goToPage(state.page - 1)`; `»`: `feed.goToPage(state.page + 1)`; son sayfa kutusu: `feed.goToPage(state.pageCount)`.
- Gösterge `state.page` değerini gösterir (bkz. §6).
- `.es-pager` `.es-stage`'in kardeşidir; dokunma ve basılı tutma olayları ona ulaşmaz.
- Gösterge ile sayfa değişince odak story ekranına (`.es-root`) döner; ← → ve boşluk hemen çalışır.
- Klavye kısayolları (← → boşluk) olay yolunda `select` varken çalışmaz; seçim kutusu okları kendisi kullanır. Esc her zaman kapatır.
- Seçim kutusu odaktayken story durur (❚❚ görünür); sayfa seçilince ya da ekrana tıklanınca odak gider ve devam eder (kullanıcı kararı, 17.09.2026).

## 6. Sayfa atlama ve istek kuralları

### Sayfa kaynağı (`src/core/page-source.js`)

Yeni metot: `load(page: number): Promise<{ page, count, entries }>`.

- `next()` ile aynı istek yolunu kullanır: `buildPageUrl(baseUrl, page)`, istekler arası en az `minGapMs`, 429/5xx/ağ hatasında `retryDelayMs` sonra bir tekrar, yapı yoksa `PageStructureError`, istenenden farklı sayfa dönerse `entries: []`.
- Aynı anda tek istek: `load` ve `next` çağrıları sıraya girer; biri bitmeden diğeri başlamaz.
- Başarıda `lastPage = page` ve `pageCount = Math.max(parsed.count, page)`; böylece `next()` hedef sayfanın ardından devam eder ve `hasNext()` buna göre değişir.
- `next()` eşzamanlı çağrılarda aynı sözü döndürmeye devam eder.
- `next()` sayfasını sırası gelince belirler; önünde bir `load` varsa onun ardından devam eder. Sırada art arda aynı sayfa istenirse (arka planda yüklenen sayfaya atlama, çift seçim) yeni istek atılmaz, son sonuç kullanılır.

### Story akışı (`src/core/story-feed.js`)

Yeni metot: `goToPage(page: number): void`.

1. `page` 1 ile `pageCount` arasına sıkıştırılır.
2. Sayfa tamponun kapsadığı sayfalar arasındaysa (tampon her zaman ardışık sayfaları tutar, görselsiz sayfalar dahil): aktif index o sayfanın, görselsizse sonraki sayfaların ilk oynatılabilir story'si olur, yön ileri, `ensureAhead()`, `change` yayılır. İstek atılmaz.
3. Yoksa atlama başlar:
   - `epoch` bir artar; atlamadan önce başlamış arka plan yüklemesinin sonucu yok sayılır.
   - `jumpTarget = page`, `loading = true`, `jumping = true`, `blocked = false`, `errorKind = null`, `emptyStreak = 0`, `failedJump = null`. Tampon (story'ler, görülen entry'ler) temizlenir ve `page` sayfasından başlar, index 0 olur. `change` yayılır.
   - Başka bir atlama isteği sürüyorsa yeni istek başlatılmaz. Biten istek en son `jumpTarget` ile aynı sayfaysa sonucu kullanılır; değilse en son `jumpTarget` yüklenir. Böylece art arda seçimlerde yalnızca sürmekte olan istek ve en son hedef istenir.
   - `pageSource.load(jumpTarget)` başarılı olursa: `loading = false`, `jumping = false`, `knownPageCount = count`, gelen entry'ler bu sayfa numarasıyla eklenir, index ilk oynatılabilir story olur, `ensureAhead()` ve `change`. Hedef sayfa boş sayfa sayacına dahil edilmez.
   - Hata olursa: `loading = false`, `errorKind` bugünkü gibi `fetch` ya da `structure`, `failedJump = page`, `change`.
4. `retry()` bugünkü gibi yalnızca `errorKind === 'fetch'` iken çalışır. `failedJump` varsa `goToPage(failedJump)` yeniden çalışır; yoksa sonraki sayfayı yeniden dener. Her yeni atlama `failedJump` değerini temizler.
5. Arka plan sayfa yüklemesi (`fetchNextPage`) da başladığı andaki `epoch`'u saklar; sonuç geldiğinde `epoch` değişmişse sonucu yok sayar ve `loading` bayrağına dokunmaz.

Yeni `state` alanları:

| alan | değer |
|---|---|
| `page` | aktif story varsa onun `page` değeri; yoksa `jumping` iken `jumpTarget`; yoksa başarısız atlamanın sayfası (`failedJump`); yoksa en son yüklenen sayfa (başlangıçta açılış sayfası) |
| `pagePosition` | §4; aktif story yoksa `null` |
| `pageStoryCount` | §4; aktif story yoksa `null` |
| `jumping` | sayfa atlaması sürüyorsa `true` |

`ended` tanımı değişmez.

### Kartlar

- `state.loading && state.jumping`: `sayfa yükleniyor…`
- `state.loading && !state.jumping`: `sonraki sayfa yükleniyor…` (bugünkü metin)
- Diğer kartlar ve butonları değişmez.

## 7. Kapatma

- `main.js` `onClose(lastEntryId)`:
  - `lastEntryId` yoksa hiçbir şey yapılmaz.
  - Entry açık sayfanın DOM'undaysa bugünkü gibi `scrollIntoView({ block: 'center' })` ve odak butona döner.
  - Değilse: `navigate(`${doc.location.origin}${doc.location.pathname}?focusto=${lastEntryId}`)`.
- `main` imzası: `main({ cssUrl, doc = document, fetchImpl, navigate = (url) => doc.defaultView.location.assign(url) })`. `navigate` testte sahte fonksiyonla değiştirilir.

## 8. Metinler

| yer | metin |
|---|---|
| atlama kartı | `sayfa yükleniyor…` |
| `«` ipucu | `önceki sayfa` |
| `»` ipucu | `sonraki sayfa` |
| son sayfa ipucu | `son sayfa` |
| seçim kutusu ekran okuyucu adı | `sayfa` |
| avatar `alt` | boş |

### `README.md` değişiklikleri

"ne yapar" bölümünde:
- `- her görselde yazar, tarih ve entry'ye git linki var.` → `- her görselde yazarın avatarı ve adı, tarih ve entry'ye git linki var.`
- Bu maddenin ardına üç madde eklenir:
  - `- üstte o sayfada kaçıncı görselde olduğun yazar, mesela 5/12.`
  - `- sağ üstteki sayfa kutusuyla ekşi'deki gibi sayfa değiştirebilirsin.`
  - `- kapatınca son baktığın entry'ye gider.`

"kısayollar" tablosunda `| kapat | esc ya da ✕ |` satırından önce: `| sayfa değiştir | sağ üstteki sayfa kutusu, « ya da » |`

"elle test" listesinde `- [ ] kapatınca son bakılan entry sayfadaysa oraya kayıyor.` satırının ardına:
- `- [ ] başka sayfadayken kapatınca son bakılan entry açılıyor.`
- `- [ ] çok sayfalı başlıkta sağ üstte ekşi'deki gibi sayfa kutusu var, sayfa değişiyor.`
- `- [ ] sayaç sayfa içinde doğru sayıyor, sonraki sayfada 1'den başlıyor.`
- `- [ ] avatarlar görünüyor, avatarı olmayan yazarda varsayılan çizim var.`

### `store/listing-tr.md` değişiklikleri

Açıklamada `• her görselde yazar, tarih ve entry'ye git linki var.` satırı şu dört satırla değişir:

```
• her görselde yazarın avatarı ve adı, tarih ve entry'ye git linki var.
• üstte o sayfada kaçıncı görselde olduğun yazar, mesela 5/12.
• sağ üstten istediğin sayfaya geç.
• kapatınca son baktığın entry'ye gidersin.
```

Gizlilik formunda `açıklama: entry yazıları, yazar adları, tarihler ve görsel linkleri` → `açıklama: entry yazıları, yazar adları ve avatarları, tarihler ve görsel linkleri`.

İzin gerekçesinde `başlığın sonraki sayfalarını` → `başlığın diğer sayfalarını` (son inceleme sonrası, kullanıcı onayı 17.09.2026).

### `PRIVACY.md` değişikliği

`- açık başlık sayfasındaki entry yazılarını, yazar adlarını, tarihleri ve görsel linklerini okur, görselleri tam ekran gösterir.` → `- açık başlık sayfasındaki entry yazılarını, yazar adlarını ve avatarlarını, tarihleri ve görsel linklerini okur, görselleri tam ekran gösterir. avatarlar ekşi'nin görsel sunucusundan yüklenir.`

`son güncelleme: 16.09.2026` → `son güncelleme: 17.09.2026`; `- ilerledikçe aynı başlığın sonraki sayfalarını …` → `- ilerledikçe ya da sayfa kutusundan seçtikçe aynı başlığın diğer sayfalarını …` (son inceleme sonrası, kullanıcı onayı 17.09.2026).

### `CHANGELOG.md` değişikliği

0.1.0 altındaki tek madde şu satırla değişir:

````markdown
- ilk sürüm. başlıklarda story butonu, görselleri kırpmadan tam ekran açan story ekranı, sonraki sayfalara yavaş geçiş, sağ üstte ekşi'deki gibi sayfa kutusu, sayfa içi sayaç, ekşi görselleri (`soz.lk`, `/img`) ve direkt görsel linkleri, her görselde avatar, yazar, tarih ve entry linki, kapatınca son bakılan entry'ye dönüş.
````

### Önceki spec'e not

`docs/superpowers/specs/2026-09-14-eksi-stories-design.md` başındaki `Durum:` satırının altına: `Not: §5 kapatma ve §6 üst bar maddeleri 2026-09-16-sayfa-gostergesi-design.md ile güncellendi.`

## 9. Testler

- `test/helpers/eksi-html.js`: `entryHtml` yeni `avatar` parametresi alır (varsayılan `https://img.ekstat.com/profiles/deneme-1.jpg`) ve footer'a gerçek yapıyı ekler: `<div class="avatar-container"><a href="/biri/<nick>"><img class="avatar" src="<avatar>" data-default="//ekstat.com/img/default-profile-picture-dark.svg" alt="<yazar>" title="<yazar>"></a></div>`. `avatar: null` verilirse `avatar-container` eklenmez.
- `test/entry-parser.test.js`: kişisel avatar mutlak adres olarak okunur; `//ekstat.com/img/default-profile-picture-dark.svg` → `https://ekstat.com/img/default-profile-picture-dark.svg`; `…-light.svg` → koyu sürüm; avatar yoksa `DEFAULT_AVATAR_URL`. Mevcut entry alanı testi `avatarUrl` alanını içerir.
- `test/page-source.test.js`: `load(3)` doğru adresi ister ve sonrasında `next()` sayfa 4'ü ister; `load` ile `next` arasında 1500 ms aralık; eşzamanlı `load` ve `next` aynı anda tek istek; `load` 5xx'te bir kez tekrar dener; `load` sonrası `hasNext()` güncellenir; sürmekte olan `next()` ile aynı sayfayı isteyen `load` ve art arda iki aynı `load` tek istek atar; `load` sürerken çağrılan `next()` yüklenen sayfanın ardından devam eder.
- `test/story-feed.test.js`: tampondaki sayfaya ve tampondaki görselsiz sayfaya istek atmadan geçiş; tamponda olmayan sayfaya atlama (`state.page`, `jumping`, kart durumu, sonuçta ilk story); görselsiz hedef sayfadan sonra arama ve hedefin boş sayfa sayacına girmemesi; atlamadan önce başlayan arka plan yüklemesinin sonucunun yok sayılması; art arda üç atlamada yalnızca ilk ve son sayfanın istenmesi; atlama hatası ve `retry()` ile aynı sayfanın yeniden istenmesi; `pagePosition` ve `pageStoryCount` değerleri; sınır dışı sayfanın sıkıştırılması.
- `test/main.smoke.test.js`: sayaç `1/1`; `.es-avatar` `src` fixture'daki avatar; tek sayfalı başlıkta `.es-pager` gizli; çok sayfalı başlıkta gösterge görünür, açılışta sayfa istenmez ve `»` tıklanınca yalnızca `?p=2` istenir; ikinci sayfaya geçip Esc ile kapatınca `navigate` `…?focusto=<entry id>` ile çağrılır; açılış sayfasındaki entry'de kapatınca `navigate` çağrılmaz; seçim kutusundan sayfa seçilince yalnızca o sayfa istenir, odak story ekranına döner, seçim kutusu odaktayken story durur ve oklar çalışmaz; sayfa sayısı değişmedikçe seçenekler yeniden kurulmaz.

## 10. Playground ve Store görselleri

- `dev/playground.js`:
  - `fakePageSource` `load(page)` metodunu destekler.
  - `makeEntry` her entry'ye üretilmiş bir avatar verir: tek harfli, renkli, yuvarlak SVG data adresi. Ekşi'ye istek atılmaz.
  - "en-boy oranları" senaryosu altı şekli üç sayfaya böler (her sayfada iki şekil, sıra aynı).
- Store ekran görüntüleri yeniden çekilir:
  - `01-dikey.png`: senaryo 0, sayfa 1, ilk story; sağ üstte `[1 ⌄] / 3 »`, sayaç `1/2`, avatar - isim.
  - `02-panorama.png`: senaryo 0, panorama (sayfa 2'nin ikinci story'si); sağ üstte `« [2 ⌄] / 3 »`, sayaç `2/2`.
  - `03-coklu-gorsel.png`: senaryo 1, ilk story; gösterge yok, sayaç `1/4`.

## 11. Doğrulama

1. `npm test` bütün testleri geçer.
2. Playground'da 1280×800 ve 2000×1000 görüntü alanında: gösterge ve şerit çok sayfalı senaryoda görünür, tek sayfalıda görünmez; hiçbir şekilde görsel ya da üst bar göstergenin altında kalmaz; katmanlar görsel kenarlarına oturmaya devam eder; `«`, `»`, son sayfa ve seçim kutusu doğru sayfaya götürür; sayaç doğru sayar; avatar ve isim birlikte görünür.
3. Kullanıcının Chrome'unda (eklenti yenilendikten sonra): story ekranındaki gösterge ekşi'nin kendi göstergesiyle aynı ölçüde görünür; seçim kutusundan bir sayfaya atlanır ve ağ isteklerinde yalnızca o sayfa istenir; başka sayfadayken kapatınca `focusto` adresi açılır ve entry görünür.
4. Store görselleri 1280×800 ölçülür ve gözle kontrol edilir.
