# ekşi dili metinler: tasarım

Tarih: 2026-09-16
Durum: Bölümler kullanıcıyla onaylandı, spec incelemesi bekliyor

## 1. Kararlar

- **Ton:** ekşi arayüz dili. Her yer küçük harf, kısa ve düz; sözlük terimleri (entry, başlık, yazar, görsel, sayfa) var, espri ve emoji yok. "story" kelimesi kalır.
- **Ad:** `stories for ekşi sözlük` (mevcut adın küçük harfli hali; "x for y" kalıbı marka açısından korunur).
- **Eklenti açıklaması:** `ekşi sözlük başlıklarındaki görselleri story gibi izle.` Kullanıcı kararıyla "resmi değil" ibaresi bu alanda yer almaz; bağımsızlık notu Store açıklamasında, README'de ve tanıtım görselinde kalır.
- **Yöntem:** metinler koddaki mevcut yerlerinde değiştirilir; yeni metin modülü ya da `_locales` yok.
- **Kapsam:** eklenti adı ve açıklaması, sayfadaki buton, story ekranı, geliştirici konsolu uyarıları, `package.json` açıklaması, GitHub repo açıklaması, README, PRIVACY.md, CHANGELOG.md, `store/listing-tr.md`, tanıtım görseli, playground'daki örnek entry yazıları ve bunları gösteren Store ekran görüntüleri.
- **Kapsam dışı:** tasarım dokümanları ve planlar (`docs/superpowers/`), kod yorumları, test adları, `src/core/` içindeki iç hata mesajları, `scripts/` altındaki geliştirme araçlarının çıktıları, playground senaryo adları ve senaryo ipucu yazıları (yalnızca eski "devam ara" etiketine atıf yapan iki yazı güncellenir, bkz. bölüm 7), görsellerin içine çizilen şekil etiketleri ("dikey 9:16" gibi).

## 2. Dil kuralları

1. Her yer küçük harf: marka, ürün adı ve kısaltmalar dahil (ekşi sözlük, ekşi teknoloji, chrome, github, mit, usd). Kod, komut, dosya adı, adres ve markdown link hedefleri bu kuralın dışındadır (`PRIVACY.md`, `LICENSE`, `localStorage`).
2. Türkçe büyük harf dönüşümü: "İ" → "i", "I" → "ı" yalnızca Türkçe kelimede; İngilizce kelime ve kısaltmada "I" → "i".
3. Kısa, düz cümle. Etiketler emir ya da yalın halde ("entry'ye git", "tekrar dene", "aramaya devam").
4. Espri, emoji, ünlem yok. Arayüz glifleri (✕, ❚❚, ·, →, ←) kalır.
5. Hitap gerektiğinde "sen" (ekşi arayüzüyle uyumlu, "siz" yok).
6. "buton" kelimesi kullanılır ("düğme" değil).

## 3. Eklenti kimliği

| yer | yeni metin |
|---|---|
| `manifest.json` `name` | `stories for ekşi sözlük` |
| `manifest.json` `description` | `ekşi sözlük başlıklarındaki görselleri story gibi izle.` |
| `package.json` `description` | `ekşi sözlük başlıklarındaki görselleri story gibi izle.` |
| GitHub repo açıklaması (`gh repo edit onursenture/eksi-stories --description`) | `ekşi sözlük başlıklarındaki görselleri story gibi izle.` |

## 4. Arayüz metinleri

### `src/content/main.js`

| yer | şimdi | yeni |
|---|---|---|
| buton yazısı | `` `story · ${count}` `` | aynı |
| `button.title` | `bu sayfadan itibaren görselleri story olarak izle` | `görselleri story gibi izle` |
| buton `aria-label` | `` `story olarak izle, bu sayfada ${count} görsel` `` | `` `story gibi izle, bu sayfada ${count} görsel` `` |
| konsol, yapı tanınmadı | `[eksi-stories] başlık sayfası yapısı tanınmadı; buton eklenmedi.` | `[eksi-stories] başlık sayfası tanınmadı, buton eklenmedi.` |
| konsol, açılamadı | `[eksi-stories] görüntüleyici açılamadı:` | `[eksi-stories] story açılmadı:` |

### `src/content/loader.js`

| yer | şimdi | yeni |
|---|---|---|
| konsol | `[eksi-stories] başlatılamadı:` | `[eksi-stories] başlamadı:` |

### `src/viewer/viewer.js`

| yer | şimdi | yeni |
|---|---|---|
| entry linki | `entry'ye git` | aynı |
| sayfa bilgisi | `` `sayfa ${story.page}/${state.pageCount}` `` | aynı |
| duraklatma simgesi `title` | `duraklatıldı` | `durdu` |
| kapat `aria-label` | `kapat` | aynı |
| yükleniyor `aria-label` | `yükleniyor` | aynı |
| ekran `aria-label` | `` `story görüntüleyici: ${topic.title}` `` | `` `story: ${topic.title}` `` |
| bozuk görsel bildirimi | `görsel yüklenemedi, atlandı` | `görsel açılmadı, geçildi` |
| kart: sonraki sayfa beklenirken | `sonraki sayfa aranıyor…` | `sonraki sayfa yükleniyor…` |
| kart: boş sayfa sınırı | `` `sonraki ${EMPTY_PAGE_LIMIT} sayfada görsel yok` `` | `` `${EMPTY_PAGE_LIMIT} sayfadır görsel yok` `` |
| buton: boş sayfa sınırı | `devam ara` | `aramaya devam` |
| kart: sayfa hatası | `sonraki sayfa alınamadı` | `sayfa gelmedi` |
| buton: sayfa hatası | `tekrar dene` | aynı |
| kart: sayfa okunamadı | `devam edilemedi` | `sayfa okunamadı` |
| kart: hiç görsel yok | `görsel bulunamadı` | `görsel yok` |
| kart: başlık bitti | `başlığın sonuna geldin` | `başlıkta başka görsel yok` |
| buton: başlık bitti | `başa dön` | aynı |
| kart kapat butonu | `kapat` | aynı |

### Testlere etkisi

- `test/manifest.test.js`: ad beklentisi `stories for ekşi sözlük` olur; açıklamada `resmi değildir` arayan satır kaldırılır (132 karakter sınırı kalır).
- `test/main.smoke.test.js`: `story · 2` ve `sayfa 1/1` değişmediği için dokunulmaz.

## 5. `store/listing-tr.md` (tam metin)

````markdown
# chrome web store yazıları

developer dashboard'a kopyalanacak yazılar. store yazılarında "instagram" geçmez.

## paket

- önce `npm test` geçsin, sonra `npm run package` → `dist/eksi-stories-<sürüm>.zip`

## mağaza sayfası (store listing)

**ad** (manifest'ten gelir): stories for ekşi sözlük

**özet** (manifest açıklaması): ekşi sözlük başlıklarındaki görselleri story gibi izle.

**açıklama:**

görsel paylaşılan başlıkları sayfa sayfa gezmek yerine story gibi izle.

• başlığın yanında "story · 12" gibi bir buton çıkar. sayı o sayfadaki görsel sayısı.
• basınca görseller o sayfadan başlayarak tam ekran açılır, 5 saniyede bir geçer.
• görseller bitmeye yakın sonraki sayfa yavaşça yüklenir, siteyi yormaz.
• aynı entry'deki görseller art arda gelir.
• görseller kırpılmaz, her biri kendi oranında görünür.
• her görselde yazar, tarih ve entry'ye git linki var.

kısayollar: → ← ile geç, boşlukla ya da basılı tutarak durdur, esc ile kapat.

açtığı görseller: ekşi görselleri (soz.lk, eksisozluk.com/img) ve .jpg, .png, .gif, .webp linkleri.

gizlilik: veri toplamaz, saklamaz, kimseye göndermez. ek izin istemez, sadece eksisozluk.com'da çalışır.

resmi değil, ekşi teknoloji ile bağı yok. açık kaynak: https://github.com/onursenture/eksi-stories

**kategori:** lifestyle > social networking (olmazsa lifestyle > entertainment)

**dil:** türkçe

**görseller:**
- mağaza simgesi: `src/icons/icon-128.png`
- ekran görüntüleri (1280×800): `store/screenshots/01-dikey.png`, `02-panorama.png`, `03-coklu-gorsel.png`
- küçük tanıtım görseli (440×280, zorunlu): `store/promo-small-440x280.png`

**ana sayfa:** https://github.com/onursenture/eksi-stories
**destek:** https://github.com/onursenture/eksi-stories/issues

## gizlilik formu (privacy practices)

**tek amaç:**
ekşi sözlük başlıklarındaki entry görsellerini tam ekran, story gibi göstermek.

**izin gerekçesi (`https://eksisozluk.com/*`):**
sadece eksisozluk.com başlık sayfalarına bir buton ekler. basılınca aynı sitedeki entry'leri, başlığın sonraki sayfalarını ve ekşi görsel sayfalarını (/img/…) okuyup görselleri gösterir. başka siteye eklenmez, başka izin istemez.

**uzak kod:** hayır. bütün kod paketin içinde, dinamik import sadece paketteki dosyaları yükler.

**veri kullanımı:**
- işaretlenecek tür: **website content**. açıklama: entry yazıları, yazar adları, tarihler ve görsel linkleri sadece story ekranı için cihazda, bellekte işlenir. saklanmaz, cihaz dışına gitmez.
- başka tür işaretlenmez.
- üç onay kutusu da işaretlenir: veri satılmaz ya da devredilmez, tek amaç dışında kullanılmaz, kredi ya da borç kararı için kullanılmaz.

**gizlilik politikası adresi:** https://github.com/onursenture/eksi-stories/blob/main/PRIVACY.md

## dağıtım (distribution)

- ücret: ücretsiz
- görünürlük: ilk yayında **unlisted** (liste dışı), sorun çıkmazsa **public**.
- bölgeler: hepsi

## geliştirici hesabı (bir kere, hesap sahibi yapar)

- https://chrome.google.com/webstore/devconsole adresinde google hesabıyla kayıt ol, sözleşmeyi kabul et, bir kerelik 5 usd kayıt ücretini öde.
- yayıncı adını gir, iletişim e-postasını doğrula.
- trader / non-trader beyanı hesap sahibinin sorumluluğunda. ücretsiz, ticari amacı olmayan bir hobi projesi genelde "non-trader" sayılır.
````

## 6. Tanıtım görseli (`store/promo-tile.html` → `store/promo-small-440x280.png`)

| yer | şimdi | yeni |
|---|---|---|
| `<h1>` | `Stories for Ekşi Sözlük` | `stories for ekşi sözlük` |
| `<p>` | `başlıklardaki görselleri tam ekran, story olarak izle` | `başlıklardaki görselleri story gibi izle` |
| `<small>` | `resmi değildir · açık kaynak` | `resmi değil · açık kaynak` |

Görsel 440×280 olarak yeniden üretilir; yerleşim ve renkler değişmez.

## 7. Playground ve ekran görüntüleri

### `dev/playground.html` açıklama paragrafı

```html
<p>story ekranını gerçek <code>story-feed</code> ile, sahte sayfalar ve üretilmiş görsellerle açar. ekşi'ye hiç istek gitmez. <code>?scenario=n</code> ile n. senaryo kendiliğinden açılır.</p>
```

`<title>` ve `<h1>` (`eksi-stories playground`) aynı kalır.

### `dev/playground.js` örnek entry yazıları

`LONG_TEXT` tekrar etmeyen tek bir paragraf olur:

```
sabah vapurundan. martılar simit peşinde, deniz dümdüz, karşı yaka sisin arkasında kaybolmuş. kimse telefonuna bakmıyor, herkes aynı yere bakıyor. iskeleye yanaşana kadar kimse yerinden kalkmadı, ben de kalkmadım. fotoğraf biraz eğri çıktı, olsun.
```

"en-boy oranları" senaryosunda her şeklin yazısı:

| şekil | yazı |
|---|---|
| dikey 9:16 | `LONG_TEXT` |
| yatay 16:9 | `işten çıkınca iskele.` |
| kare | `balkondaki sardunyalar.` |
| panorama 4:1 | `tepeden bütün şehir, sis daha kalkmamış.` |
| uzun ekran görüntüsü 1:4 | `uzun bir ekran görüntüsü.` |
| küçük 320×240 | `eski telefondan kalma bir fotoğraf.` |

"çoklu görsel + bozuk görsel" senaryosu: üç görselli entry `bayram sabahından üç kare.`, tek görselli entry `tek kare.`

Eski buton adına atıf yapan iki geliştirici yazısı yeni etikete uyar: senaryo adı `boş sayfalar → devam ara` → `boş sayfalar → aramaya devam`, ipucu yazısı `devam aradıktan sonra bulundu` → `aramaya devam edince bulundu`.

Yazar adları (`deneme yazar N`) ve tarih aynı kalır.

### Ekran görüntüleri

`store/screenshots/01-dikey.png`, `02-panorama.png`, `03-coklu-gorsel.png` yeni yazılarla 1280×800, duraklatma simgesi olmadan yeniden çekilir. Dikey görseldeki yazı üç satırda kırpılmış görünmelidir.

## 8. `README.md` (tam metin)

````markdown
# stories for ekşi sözlük

ekşi sözlük başlıklarındaki görselleri story gibi izlemek için chrome eklentisi.

> resmi değil, ekşi teknoloji ile bağı yok.

## ne yapar

- başlığın yanına **story · 12** gibi bir buton koyar. sayı o sayfadaki görsel sayısı.
- basınca görseller o sayfadan başlayarak tam ekran açılır. bitince sonraki sayfa yavaşça yüklenir.
- aynı entry'deki görseller art arda gelir, üstte her biri için bir çizgi olur.
- görselleri kırpmaz. dikey, yatay, panorama, ekran görüntüsü, hepsi kendi oranında.
- her görselde yazar, tarih ve entry'ye git linki var.
- ekşi görsellerini (`soz.lk/i/…`, `eksisozluk.com/img/…`) ve `.jpg`, `.png`, `.gif`, `.webp` linklerini açar.

## kısayollar

| ne | nasıl |
|---|---|
| sonraki / önceki | → / ← ya da ekranın sağına / soluna tıkla |
| durdur | basılı tut ya da boşluk |
| entry'nin tamamı | alttaki yazıya tıkla |
| kapat | esc ya da ✕ |

## kurulum

1. repoyu indir: `git clone https://github.com/onursenture/eksi-stories.git`
2. chrome'da `chrome://extensions` sayfasını aç.
3. sağ üstten **geliştirici modu**nu aç.
4. **paketlenmemiş öğe yükle**'ye bas, repo klasörünü seç.
5. bir başlık aç, mesela https://eksisozluk.com/anin-fotografi--6459985

kod değişince `chrome://extensions` sayfasında eklentiyi yenile, sonra ekşi sekmesini yenile.

## kurallar

- sadece kişisel kullanım için. reklam, ücret, ticari amaç yok.
- senin tarayıcında, senin oturumunla çalışır. sadece zaten görebildiğin sayfaları okur.
- siteyi yormaz: sayfa istekleri arasında en az 1,5 saniye bekler, aynı anda tek sayfa ister, görsel sayfalarını en fazla ikişer açar, 5 görselsiz sayfadan sonra durur.
- sitenin yazılarına, reklamlarına, düzenine dokunmaz. sadece bir buton ve kapatınca kaybolan bir ekran ekler.
- her görselde yazara ve entry'ye link verir.

## gizlilik

veri toplamaz, saklamaz, göndermez. ayrıntı: [privacy.md](PRIVACY.md)

## geliştirme

node.js 22.22 ya da üstü lazım. build adımı yok.

```bash
npm install        # sadece testler için jsdom
npm test           # testler
npm run serve      # http://127.0.0.1:5173/dev/playground.html
npm run icons      # ikonları yeniden üret
npm run package    # dist/eksi-stories-<sürüm>.zip
```

playground ekşi'ye hiç istek atmadan sahte görsellerle açılır: `?scenario=0` … `?scenario=4`.

| klasör | içinde |
|---|---|
| `src/content/` | sayfaya eklenen kod ve buton |
| `src/core/` | testli mantık: sayfa okuma, görsel bulma, sayfalama, story akışı |
| `src/viewer/` | story ekranı |
| `test/` | testler ve sahte ekşi sayfaları |
| `dev/` | playground |
| `store/` | chrome web store yazıları ve görselleri |
| `docs/superpowers/` | tasarım ve plan |

## elle test

- [ ] eklenti hatasız yükleniyor.
- [ ] örnek başlıkta buton var, görsel sayısı doğru.
- [ ] görselsiz başlıkta buton `story · 0`, basınca sonraki sayfalara bakıyor.
- [ ] tek sayfalık başlıkta son görselden sonra `başlıkta başka görsel yok` çıkıyor.
- [ ] `?a=popular` ya da `?a=nice` ile açılan başlıkta sonraki sayfa aynı filtreyle geliyor.
- [ ] açık ve koyu temada buton okunuyor.
- [ ] ← → boşluk esc ve basılı tutma çalışıyor.
- [ ] dikey, yatay ve kare görseller kırpılmadan görünüyor.
- [ ] pencere boyu değişince yazılar görselin kenarlarına oturuyor.
- [ ] kapatınca son bakılan entry sayfadaysa oraya kayıyor.
- [ ] devtools network'te sayfa istekleri arası en az 1,5 sn.

## lisans

mit, bkz: [license](LICENSE)
````

## 9. `PRIVACY.md` (tam metin)

````markdown
# gizlilik: stories for ekşi sözlük

son güncelleme: 16.09.2026

stories for ekşi sözlük kişisel veri toplamaz, satmaz, kimseyle paylaşmaz.

## neye bakar

- sadece `https://eksisozluk.com` sayfalarında çalışır.
- açık başlık sayfasındaki entry yazılarını, yazar adlarını, tarihleri ve görsel linklerini okur, görselleri tam ekran gösterir.
- ilerledikçe aynı başlığın sonraki sayfalarını ve ekşi görsel sayfalarını (`/img/…`) senin tarayıcından, senin oturumunla eksisozluk.com'dan ister. bu istekler o sayfaları kendin açınca gidenlerle aynı.

## nerede tutar

- okuduklarını sadece senin cihazında, sekme açıkken bellekte tutar. sekme kapanınca ya da sayfa yenilenince siler.
- çerez, `localStorage` ya da eklenti depolaması kullanmaz.
- sunucusu yok. analitik, takip, reklam yok. hiçbir veri geliştiriciye ya da başkasına gitmez.

## başka sitelerdeki görseller

bir entry başka bir sitedeki görsele link veriyorsa (mesela `https://ornek.com/foto.jpg`) görsel o siteden yüklenir. o site, her görsel isteğinde olduğu gibi ip adresini görebilir. eklenti bu isteklere referrer eklemez.

## izinler

ek izin istemez. sadece eksisozluk.com sayfalarına eklenir.

## iletişim

soru ve bildirimler: https://github.com/onursenture/eksi-stories/issues
````

## 10. `CHANGELOG.md` (tam metin)

````markdown
# değişiklikler

## 0.1.0 (yayınlanmadı)

- ilk sürüm. başlıklarda story butonu, görselleri kırpmadan tam ekran açan story ekranı, sonraki sayfalara yavaş geçiş, ekşi görselleri (`soz.lk`, `/img`) ve direkt görsel linkleri, her görselde yazar, tarih ve entry linki.
````

## 11. Doğrulama

1. `npm test` bütün testleri geçer.
2. Eski metin taraması boş döner. Taranan yerler: `src/content/`, `src/viewer/`, `manifest.json`, `package.json`, `README.md`, `PRIVACY.md`, `CHANGELOG.md`, `store/`, `dev/`. Aranan metinler:
   `Stories for Ekşi Sözlük`, `story olarak izle`, `yüklenemedi, atlandı`, `devam ara`, `bulunamadı`, `başlığın sonuna geldin`, `duraklatıldı`, `görüntüleyici:`, `aranıyor`, `alınamadı`, `edilemedi`, `başlatılamadı`, `Instagram`.
3. Büyük harf taraması: README.md, PRIVACY.md, CHANGELOG.md, `store/listing-tr.md`, tanıtım görseli yazıları ve manifest ad/açıklamasında büyük harf yalnızca kod, adres, dosya adı ve link hedeflerinde kalır.
4. Playground'da dikey görselin yazısı üç satırda kırpılır; kartlar yeni yazıları gösterir.
5. Tanıtım görseli 440×280, ekran görüntüleri 1280×800 ölçülür ve gözle kontrol edilir: yazılar taşmaz, duraklatma simgesi yoktur.
6. Kullanıcının Chrome'unda eklenti yenilendikten sonra butonun ipucu ve story ekranındaki bir kart canlıda kontrol edilir.
7. Push ve GitHub repo açıklaması güncellemesi en sonda, kullanıcı onayıyla yapılır.
