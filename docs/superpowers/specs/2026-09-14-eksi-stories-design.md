# Stories for Ekşi Sözlük — Tasarım Dokümanı

Tarih: 2026-09-14
Durum: Onaylandı (brainstorming sonucu)
Not: §5 kapatma ve §6 üst bar maddeleri 2026-09-16-sayfa-gostergesi-design.md ile güncellendi.
Not: §4 `createPageSource` imzası 2026-09-17-ortak-istek-sirasi-design.md ile güncellendi: sayfa istekleri sekme başına ortak sırada, sayfa kaynağında `dispose()` var.
Not: §2.2 istek disiplini sekme başına geçerlidir; bkz. 2026-09-17-istek-sirasi-sinirlari-design.md.
Not: §2.2, §4, §5 ve §10'daki 5 görselsiz sayfa sınırı 2026-09-17-acilmayan-gorsel-siniri-design.md ile "son açılan görselin sayfasından sonra 5 sayfa" oldu; görselleri açılmayan sayfalar da sayılır.

## 1. Amaç

Herhangi bir Ekşi Sözlük başlık sayfasında, başlığın yanına eklenen bir butona basınca,
o sayfadan itibaren entry'lerdeki görselleri Instagram Stories tarzı tam ekran, otomatik
ilerleyen bir görüntüleyicide izlemek. Örnek başlık: `anın fotoğrafı` (22 bin+ sayfa).

Ürün adı (Chrome Web Store): **Stories for Ekşi Sözlük**. Repo: `onursenture/eksi-stories`.
Lisans: MIT. Resmi değildir; Ekşi Teknoloji ile bağı yoktur.

## 2. Kurallara uygunluk ilkeleri

Ekşi Sözlük kullanım koşulları (https://eksisozluk.com/entry/19784395) şunları ister:
şahsi kullanım, ticari kullanım yasağı, sitenin işleyişine müdahale / yavaşlatma yasağı,
alıntıda yazara ve entry'ye link ile atıf, marka adının bağlılık ima edecek şekilde
kullanılmaması. Tasarım bunları şu kararlarla karşılar:

1. **Sadece kullanıcının kendi tarayıcısı ve oturumu.** Çekilen sayfalar kullanıcının zaten
   erişebildiği sayfalardır. Sunucu, analitik, üçüncü parti istek yoktur. Kalıcı depolama
   yoktur; yalnızca sayfa yaşam süresi boyunca bellek içi cache.
2. **İstek disiplini.** Aynı anda en fazla 1 sayfa isteği; sayfa istekleri arasında en az
   1,5 sn; görsel çözümleme eşzamanlılığı en fazla 2; art arda 5 görselsiz sayfadan sonra
   otomatik ilerleme durur ve kullanıcı isterse "devam ara" der. Hata durumunda hızlı
   döngü yoktur (bkz. §7).
3. **Atıf.** Her story'de yazar adı (profil linki), tarih ve "entry'ye git" linki.
4. **Minimum müdahale.** Sayfaya 1 buton eklenir; overlay kapatılınca tamamen kaldırılır.
   Reklamlar, içerik, yerleşim değiştirilmez.
5. **Marka.** Ad "X for Y" kalıbında; README ve Store açıklamasında "resmi değildir" notu.
6. **Açık kaynak, ticari değil.** MIT lisansı; ücret, reklam, bağış çağrısı yok.

## 3. Kapsam

### v1'de var
- Tüm başlık sayfalarında buton (`#title[data-id]` + `#entry-item-list` olan sayfalar).
- Başlangıç: açık olan sayfa; ileri yönde sonraki sayfalar (`?p=N+1`) tembel yüklenir.
- Desteklenen görsel kaynakları:
  - `https://soz.lk/i/<id>` ve `https://eksisozluk.com/img/<id>` → same-origin `/img/<id>`
    sayfasından `og:image` (yedek: `#image[src]`).
  - Yolu `.jpg/.jpeg/.png/.gif/.webp` ile biten her direkt link (herhangi bir host).
- Entry başına birden fazla görsel = tek story grubu (Instagram'daki "aynı kişinin ardışık
  story'leri" modeli).
- Otomatik ilerleme (5 sn), progress çubukları, basılı tutarak duraklatma, klavye ve
  tıklama navigasyonu, entry metni caption'ı, yazar/tarih/entry linki.
- Görsel en-boy oranı serbest; kırpma yok (bkz. §6).

### v1'de yok (bilinçli)
- `eksiup.com/p/<id>` (2019–2023 dönemi legacy host) çözümleme. Bu linkler atlanır.
- hizliresim, imgur vb. sayfa linklerinin çözümlenmesi (yalnızca direkt resim linkleri).
- Geriye doğru sayfa çekme (önceki sayfalar). Geri gitme yalnızca yüklenmiş tampon içinde.
- Ayar ekranı (süre sabit 5 sn).
- Video / GIF dışı animasyon.
- Firefox / Safari paketleri.

### v2 fikirleri (not olarak)
- Çok yüksek görseller için "genişliğe sığdır + dikey kaydır" modu.
- `eksiup.com` desteği (host izni gerektirir).
- Süre ayarı, "en yeniden geriye" başlangıç seçeneği.

## 4. Mimari

Manifest V3, build adımı yok, saf ES module'ler. Tek content script; service worker yok.

**İzinler:** yalnızca `content_scripts.matches: ["https://eksisozluk.com/*"]`. `storage`,
`tabs`, `host_permissions` yok. Same-origin `fetch` content script'ten ek izin gerektirmez.

**Modül yükleme:** Content script'ler ES module olamaz. `src/content/loader.js` classic
script olarak enjekte edilir ve `import(chrome.runtime.getURL('src/content/main.js'))`
çağırır. `src/**` dosyaları `web_accessible_resources` ile yalnızca
`https://eksisozluk.com/*` origin'ine açılır.

### Dosya yapısı

```
eksi-stories/
├── manifest.json
├── src/
│   ├── content/
│   │   ├── loader.js         # classic script; main.js'i dinamik import eder
│   │   ├── main.js           # sayfa tespiti → buton → viewer başlatma
│   │   └── button.css        # buton stili (sayfa seviyesinde, .eksi-stories- prefix'i)
│   ├── core/                 # DOM'a bağımlı olmayan, Node'da test edilen saf mantık
│   │   ├── entry-parser.js   # Document → Entry[]
│   │   ├── image-links.js    # href → ImageRef | null
│   │   ├── image-resolver.js # ImageRef → gerçek URL; cache + eşzamanlılık sınırı
│   │   ├── page-source.js    # sayfalama; throttle'lı fetch
│   │   └── story-feed.js     # Entry → Story; prefetch ve ileri-okuma politikası
│   ├── viewer/
│   │   ├── viewer.js         # Shadow DOM overlay
│   │   └── viewer.css        # shadow root içine inject edilen stil
│   └── icons/                # 16/32/48/128 png
├── test/                     # node:test + jsdom; fixtures/ altında gerçek HTML'ler
├── scripts/package.sh        # Store zip'i üretir (manifest + src)
├── store/                    # listeleme metinleri, ekran görüntüleri
├── docs/superpowers/specs/   # bu doküman
├── README.md · LICENSE · PRIVACY.md · CHANGELOG.md · package.json (yalnızca devDependencies)
```

### Veri modeli

```js
Entry    { id, author, authorUrl, date, permalink, text, images: ImageRef[] }
ImageRef { kind: 'eksi' | 'direct', id?: string, url?: string, sourceHref: string }
Story    { entry, imageIndex, imageCount, ref, resolvedUrl: string|null,
           status: 'pending' | 'ready' | 'failed' }
```

`permalink` = `/entry/<id>`, `authorUrl` = `/biri/<author>`. `text` = `.content` düz metni,
görsel linkleri çıkarılmış ve boşluk normalize edilmiş.

### Modül arayüzleri

- `entry-parser.js`
  - `parseTopicPage(document) → { topic: {id, title, slug}, page: {current, count}, entries: Entry[] }`
  - DOM seçicileri: `#title[data-id][data-title][data-slug]`, `#entry-item-list > li[data-id][data-author]`,
    `li .content`, `li footer .entry-date`, `.pager[data-currentpage][data-pagecount]`.
    Pager yoksa `{current: 1, count: 1}`.
- `image-links.js`
  - `classifyImageLink(href) → ImageRef | null`
  - Aynı entry içinde aynı anahtara (`eksi:<id>` veya direkt URL) sahip tekrarlar elenir.
- `image-resolver.js`
  - `createResolver({ fetch, parseHtml, concurrency = 2 })` → `{ resolve(ref) → Promise<string> }`
  - `eksi` için `GET /img/<id>` (`credentials: 'include'`), `og:image` → yoksa `#image[src]`
    → yoksa hata. Sonuç ve hata `Map` cache'inde; başarısız id tekrar denenmez.
  - `direct` için fetch yok; `resolve` URL'yi olduğu gibi döner.
- `page-source.js`
  - `createPageSource({ fetch, parseHtml, baseUrl, current, count, minGapMs = 1500, now, sleep })`
    → `{ hasNext(), next() → Promise<{ page, entries }> }`
  - Sonraki URL: `baseUrl`'in mevcut query parametreleri korunur, yalnızca `p` güncellenir
    (`a=popular`, `day=`, `nr=true` vb. bozulmaz).
  - Tek uçuşta bir istek; `minGapMs` altında çağrılırsa bekler. 429/5xx/ağ hatasında
    1 kez 5 sn sonra tekrar; sonra hata fırlatır (çağıran karar verir).
  - Yanıtta `#entry-item-list` yoksa `PageStructureError`.
- `story-feed.js`
  - `createStoryFeed({ entries, pageSource, resolver, lookahead = 2, fetchAheadThreshold = 3,
    emptyPageLimit = 5 })`
  - `current()`, `next()`, `prev()`, `goTo(i)`, `state` (`{ index, length, page, ended, blockedOnEmptyPages, error }`),
    `continueSearching()` (boş sayfa sayacını sıfırlayıp ilerlemeye devam eder), `on(event, fn)`.
  - Kurallar: aktif story + sonraki `lookahead` story çözümlenir. Tamponda kalan story sayısı
    `fetchAheadThreshold`'un altına inince ve `pageSource.hasNext()` ise sonraki sayfa çekilir.
    Görselsiz sayfa `emptyPageLimit` kez ardışık gelirse `blockedOnEmptyPages = true`.
- `viewer.js`
  - `openViewer({ feed, topic, onClose })` → `{ close() }`. Feed olaylarını dinler, kendi
    zamanlayıcısını yönetir. DOM dışı mantık içermez.
- `main.js`
  - Sayfa tespiti → `parseTopicPage(document)` → buton (`story · N`) → tıklamada feed + viewer.

## 5. Veri akışı

1. Sayfa yüklenir; `main.js` `#title[data-id]` ve `#entry-item-list` görürse butonu `#title`
   içine (başlık linkinin ardına) ekler. Butonda bu sayfadaki görsel sayısı yazar; 0 ise de
   tıklanabilir (ileri sayfalarda arar).
2. Tıklama: DOM parse edilir, görselli entry'lerden Story listesi oluşur, viewer açılır.
3. Çözümleme: aktif + 2 sonraki story `resolver` ile çözümlenir (eşzamanlı ≤ 2).
4. İleri okuma: tamponda 3'ten az story kalınca ve `current < count` ise `?p=N+1` çekilir
   ve parse edilip eklenir. Tek istek uçuşta; ≥ 1,5 sn aralık; 5 ardışık boş sayfada durur.
5. Geri: yalnızca tampon içinde.
6. Kapatma: overlay ve dinleyiciler kaldırılır, body scroll açılır; son izlenen entry mevcut
   DOM'daysa ona kaydırılır.

Site navigasyonu (sol liste, sayfalama) tam sayfa yenilemesi yaptığı için MutationObserver
veya SPA takibi gerekmez; content script her yüklemede sıfırdan çalışır. "devamını okuyayım"
yalnızca CSS kırpmasıdır; entry içeriği ve görsel linkleri DOM'da tam olarak bulunur.

## 6. Görüntüleyici UI

Overlay `document.body`'ye eklenen tek host div + `attachShadow({mode: 'open'})`. Body scroll
kilitlenir. `role="dialog"`, `aria-label="story görüntüleyici"`; açılınca odak overlay'e gelir.

**Yerleşim — görsele uyan sahne (sabit kart yok):**
- Sahne tüm görünüm alanıdır. Görsel `max-width: 100vw; max-height: 100vh;
  object-fit: contain` ile orijinal en-boy oranında ortalanır. Kırpma yoktur: dikey görsel
  yüksekliği, panorama genişliği doldurur, kare ikisinin küçüğüne sığar.
- Arka plan: aynı görsel `filter: blur(40px) brightness(.4)` ile sahneyi doldurur.
- UI katmanları görselin üstüne biner ve görselin çizilen genişliğine hizalanır: üstte
  progress çubukları + yazar/tarih/entry linki + "sayfa N/M" + ✕; altta caption. İkisi de
  yarı saydam degrade zemin üzerindedir. Katmanlar görselin çizilen genişliğine tam oturur:
  sol ve sağ kenarları görselin kenarlarıyla aynıdır, alt degrade görselin en altına kadar iner
  (kullanıcı kararı, 15.09.2026; önceki `clamp(360px, …, 1200px)` kuralı geniş ve dar
  görsellerde kenarları kaydırıyordu). Dar görsellerde yazar, tarih ve entry linki kısaltılır ya
  da alt satıra kayar; "sayfa N/M", ❚❚ ve ✕ sağ üstte kalır.
- Tıklama bölgeleri ve basılı tutma tüm sahneyi kapsar (bulanık alan dahil). Sol %30 = geri,
  sağ %70 = ileri. Linkler ve ✕ tıklama-ile-ilerlemeyi tetiklemez.
- `ResizeObserver` ile pencere değişince katmanlar yeniden hizalanır.

**Etkileşim:**
- Progress çubukları: mevcut entry'nin görsel sayısı kadar; entry değişince sıfırlanır.
- Görsel başına 5 sn; sayaç `img.onload` sonrası başlar. Yüklenirken spinner.
- Basılı tutma (≥ 200 ms) duraklatır, bırakınca devam. Boşluk tuşu duraklat/devam.
  Duraklatıldığında sağ üstte ❚❚ göstergesi.
- ← → ileri/geri, Esc kapat.
- Caption: entry metni, 3 satıra kırpılır, tıklayınca açılır; boşsa gizlenir.
- Son kart: "başlığın sonuna geldin" + "kapat" / "başa dön". Boş sayfa limiti dolunca:
  "sonraki 5 sayfada görsel yok" + "devam ara". Sayfa hatası: "sonraki sayfa alınamadı" +
  "tekrar dene".
- Buton (sayfada): `#title` içinde, küçük pill; `currentColor` ve yarı saydam zeminle Ekşi'nin
  açık/koyu temasına uyar. Metin: "story · N".

## 7. Hata yönetimi

| Durum | Davranış |
|---|---|
| `/img/<id>` 404 / ağ hatası / `og:image` yok | Story `failed`; otomatik atlanır; 1,5 sn toast "görsel yüklenemedi, atlandı". Aynı id tekrar denenmez. |
| Direkt link `<img>` `onerror` | Aynı: atla + toast. |
| Sayfa fetch'i 429/5xx/ağ hatası | 1 kez 5 sn sonra tekrar; yine olmazsa son kartta "tekrar dene". Hızlı döngü yok. |
| Yanıtta `#entry-item-list` yok (giriş ekranı vb.) | Sayfalama durur; "devam edilemedi" mesajı. |
| Ekşi DOM yapısı değişmiş | Buton eklenmez; konsola tek satır uyarı; sessiz çıkış. |
| Tüm görselleri başarısız entry | Grup atlanır; sayaçlar tutarlı kalır. |
| Overlay açıkken sayfa değişimi | Tam yenileme olduğu için doğal sıfırlanma. |

## 8. Test stratejisi

- **Birim testleri** (`node:test` + `jsdom`, `npm test`; `package.json` yalnızca
  devDependencies içerir, build yoktur):
  - `entry-parser`: gerçek başlık sayfası fixture'ı (10 entry, karışık linkler), görselsiz
    sayfa, pager'sız tek sayfalı başlık, `data-*` alanları, metin temizliği.
  - `image-links`: soz.lk / eksisozluk.com/img / direkt uzantılar (büyük-küçük harf, query
    string) / desteklenmeyen (eksiup, hizliresim sayfa linki, bkz linkleri).
  - `image-resolver`: `/img/<id>` fixture'ından `og:image`; `#image` yedeği; 404'te failed ve
    tekrar denenmeme; eşzamanlılık sınırı (sahte fetch ile aynı anda en fazla 2).
  - `page-source`: URL üretimi (query korunur), `minGapMs` bekleme (sahte `now`/`sleep`),
    tek uçuşta bir istek, 5xx'te tek tekrar, `PageStructureError`.
  - `story-feed`: gruplama, lookahead çözümleme, eşik altına inince sayfa çekme, boş sayfa
    limiti ve `continueSearching`, failed atlama, geri gitme sınırı.
- **Manuel kontrol listesi** (README): paketlenmemiş yükleme; örnek başlık; görselsiz başlık;
  tek sayfalı başlık; `?a=popular` filtresi; açık/koyu tema; klavye; basılı tutma; çok dikey,
  çok geniş, kare görsel; pencere yeniden boyutlandırma; kapatınca entry'ye kaydırma.
- Viewer için otomatik UI testi v1'de yok; mantık `story-feed`'de olduğu için viewer incedir.

## 9. Repo ve yayınlama

**GitHub:** `git init` → MIT `LICENSE`, `README.md` (TR; "resmi değildir" notu; kurulum;
manuel test listesi), `.gitignore`, bu spec → `gh repo create onursenture/eksi-stories --public`
→ ilk commit ve push.

**Chrome Web Store adımları:**
1. Geliştirici hesabı: https://chrome.google.com/webstore/devconsole — tek seferlik 5 $
   kayıt ücreti (kullanıcı yapar).
2. `scripts/package.sh` ile `manifest.json + src/` zip'i (test, docs, store hariç).
3. Listeleme: 128 px ikon, en az 1 ekran görüntüsü (1280×800), kısa açıklama (≤ 132
   karakter), uzun açıklama, kategori (Eğlence / Sosyal). Materyaller `store/` altında.
4. Gizlilik: "veri toplamıyor" beyanı; gizlilik politikası URL'si olarak repodaki
   `PRIVACY.md`.
5. İzin gerekçesi: tek izin `eksisozluk.com` content script; "site içindeki görselleri
   görüntülemek için".
6. İnceleme 1–3 gün; önce "unlisted", sonra "public" yapılabilir.

## 10. Sabitler

| Ad | Değer |
|---|---|
| Story süresi | 5000 ms |
| Basılı tutma eşiği | 200 ms |
| Lookahead (çözümleme) | 2 story |
| Sayfa çekme eşiği | tamponda < 3 story |
| Sayfa istekleri arası min. aralık | 1500 ms |
| Sayfa hatası tekrar gecikmesi | 5000 ms, 1 deneme |
| Görsel çözümleme eşzamanlılığı | 2 |
| Ardışık boş sayfa limiti | 5 |
| Toast süresi | 1500 ms |
| Katman genişliği | görselin çizilen genişliği (kenarlara tam oturur) |
