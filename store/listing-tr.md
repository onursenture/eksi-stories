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
• her görselde yazarın avatarı ve adı, tarih ve entry'ye git linki var.
• üstte o sayfada kaçıncı görselde olduğun yazar, mesela 5/12.
• sağ üstten istediğin sayfaya geç.
• kapatınca son baktığın entry'ye gidersin.

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
sadece eksisozluk.com başlık sayfalarına bir buton ekler. basılınca aynı sitedeki entry'leri, başlığın diğer sayfalarını ve ekşi görsel sayfalarını (/img/…) okuyup görselleri gösterir. başka siteye eklenmez, başka izin istemez.

**uzak kod:** hayır. bütün kod paketin içinde, dinamik import sadece paketteki dosyaları yükler.

**veri kullanımı:**
- işaretlenecek tür: **website content**. açıklama: entry yazıları, yazar adları ve avatarları, tarihler ve görsel linkleri sadece story ekranı için cihazda, bellekte işlenir. saklanmaz, cihaz dışına gitmez.
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
