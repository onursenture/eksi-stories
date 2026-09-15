# Chrome Web Store listeleme metinleri (tr)

Developer Dashboard alanlarına kopyalanacak metinler. Store metinlerinde "Instagram" markası
kullanılmaz.

## Paket

- `npm test` geçmeli, ardından `npm run package` → `dist/eksi-stories-<sürüm>.zip`

## Mağaza girişi (Store listing)

**Ad** (manifest'ten): Stories for Ekşi Sözlük

**Özet** (manifest `description`): Ekşi Sözlük başlıklarındaki görselleri story olarak izleyin. Resmi değildir; Ekşi Teknoloji ile bağı yoktur.

**Açıklama:**

Ekşi Sözlük'te fotoğraf paylaşılan başlıkları sayfa sayfa gezmek yerine görselleri story tarzında, tam ekran izleyin.

Nasıl çalışır:
• Herhangi bir başlık sayfasında başlığın yanında "story · N" butonu belirir.
• Butona basınca bulunduğunuz sayfadan itibaren görseller tam ekran açılır ve 5 saniyede bir otomatik ilerler.
• Sona yaklaşınca başlığın sonraki sayfası arka planda, siteye yük bindirmeyecek şekilde yavaşça yüklenir.
• Birden fazla görselli entry'ler tek grup olarak gösterilir.
• Görseller kırpılmaz: dikey, yatay, panorama ya da ekran görüntüsü, her biri kendi oranında.
• Her görselde yazarın adı, tarih ve entry'ye giden link bulunur.

Kısayollar: → ve ← ile sonraki ve önceki görsel, boşluk tuşu ya da basılı tutma ile duraklatma, Esc ile kapatma.

Desteklenen görseller: Ekşi Sözlük görselleri (soz.lk ve eksisozluk.com/img linkleri) ile .jpg, .png, .gif ve .webp ile biten doğrudan görsel linkleri.

Gizlilik: Eklenti veri toplamaz, saklamaz ve göndermez. Ek izin istemez; yalnızca eksisozluk.com sayfalarında çalışır.

Bu eklenti resmi değildir; Ekşi Sözlük ve Ekşi Teknoloji ile bir bağı yoktur. Açık kaynak: https://github.com/onursenture/eksi-stories

**Kategori:** Social Networking (alternatif: Entertainment)

**Dil:** Türkçe

**Grafikler:**
- Mağaza simgesi: `src/icons/icon-128.png`
- Ekran görüntüleri (1280×800): `store/screenshots/01-dikey.png`, `02-panorama.png`, `03-coklu-gorsel.png`
- Küçük tanıtım görseli (440×280, zorunlu): `store/promo-small-440x280.png`

**Ana sayfa URL'si:** https://github.com/onursenture/eksi-stories
**Destek URL'si:** https://github.com/onursenture/eksi-stories/issues

## Gizlilik uygulamaları (Privacy practices)

**Tek amaç:**
Ekşi Sözlük başlık sayfalarındaki entry görsellerini tam ekran, story tarzında bir görüntüleyicide göstermek.

**Host izni gerekçesi (`https://eksisozluk.com/*`):**
Eklenti yalnızca eksisozluk.com başlık sayfalarına bir buton ekler. Kullanıcı butona bastığında aynı sitedeki entry'leri, başlığın sonraki sayfalarını ve ekşi görsel sayfalarını (/img/…) okuyarak görselleri gösterir. Başka hiçbir siteye içerik betiği eklenmez ve başka izin istenmez.

**Uzak kod:** Hayır. Tüm JavaScript eklenti paketinin içindedir; dinamik import yalnızca paketteki dosyaları yükler.

**Veri kullanımı:**
- İşaretlenecek tür: **Website content** (Web sitesi içeriği). Açıklama: entry metinleri, yazar adları, tarihler ve görsel linkleri yalnızca görüntüleyiciyi göstermek için cihazda, bellekte işlenir; saklanmaz ve cihaz dışına gönderilmez.
- Diğer türlerin hiçbiri işaretlenmez.
- Üç sertifikanın üçü de işaretlenir: veriler satılmaz ya da aktarılmaz; tek amaç dışında kullanılmaz; kredi değerlendirmesi veya borç verme için kullanılmaz.

**Gizlilik politikası URL'si:** https://github.com/onursenture/eksi-stories/blob/main/PRIVACY.md

## Dağıtım (Distribution)

- Ücret: Ücretsiz
- Görünürlük: İlk yayında **Unlisted** (liste dışı); sorunsuz kullanımdan sonra **Public**.
- Bölgeler: Tümü

## Geliştirici hesabı (tek seferlik, hesap sahibi yapar)

- https://chrome.google.com/webstore/devconsole adresinde Google hesabıyla kayıt, geliştirici sözleşmesini kabul ve tek seferlik 5 USD kayıt ücreti.
- Yayıncı adı ve iletişim e-postası doğrulaması.
- Trader / non-trader beyanı: beyan hesap sahibinin sorumluluğundadır. Ücretsiz ve ticari amaç gütmeyen bir hobi projesi genellikle "non-trader" kapsamındadır.
