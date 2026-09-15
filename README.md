# Stories for Ekşi Sözlük

Ekşi Sözlük başlıklarındaki görselleri story tarzında, tam ekran ve otomatik ilerleyen bir
görüntüleyicide izlemenizi sağlayan Chrome eklentisi.

> **Resmi değildir.** Bu proje Ekşi Sözlük ve Ekşi Teknoloji ile bağlantılı değildir.
> "Ekşi Sözlük" adı yalnızca eklentinin hangi site için olduğunu belirtmek için kullanılır.

## Özellikler

- Her başlık sayfasında başlığın yanında **story · N** butonu (N: bu sayfadaki görsel sayısı).
- Bulunduğunuz sayfadan başlayıp ileri doğru akan story'ler. Sona yaklaşınca sonraki sayfa
  arka planda, yavaşça yüklenir.
- Birden fazla görselli entry'ler tek grup olarak gösterilir; üstte her görsel için bir çubuk.
- Görseller kırpılmaz: dikey, yatay, panorama ya da ekran görüntüsü, her biri kendi oranında.
- Her story'de yazar, tarih ve entry'ye giden link.
- Desteklenen görseller: ekşi görselleri (`soz.lk/i/…`, `eksisozluk.com/img/…`) ve
  `.jpg`, `.png`, `.gif`, `.webp` ile biten doğrudan linkler.

## Kısayollar

| Eylem | Nasıl |
|---|---|
| Sonraki / önceki | → / ← ya da ekranın sağına / soluna tıkla |
| Duraklat | Basılı tut ya da boşluk tuşu |
| Metnin tamamı | Alttaki metne tıkla |
| Kapat | Esc ya da ✕ |

## Kurulum (geliştirici modu)

1. Repoyu indirin: `git clone https://github.com/onursenture/eksi-stories.git`
2. Chrome'da `chrome://extensions` adresini açın.
3. Sağ üstten **Geliştirici modu**nu açın.
4. **Paketlenmemiş öğe yükle** düğmesine basın ve repo klasörünü seçin.
5. Herhangi bir başlığı açın, örneğin https://eksisozluk.com/anin-fotografi--6459985

Kodu değiştirdikten sonra `chrome://extensions` sayfasında eklentinin yenileme düğmesine
basın ve ekşi sekmesini yenileyin.

## Kurallara saygı

- Yalnızca kişisel kullanım içindir; ticari amaç, reklam veya ücret yoktur.
- Her şey sizin tarayıcınızda ve sizin oturumunuzla çalışır; yalnızca zaten görebildiğiniz
  sayfalar okunur.
- Siteye yük bindirmemek için istekler sınırlandırılmıştır: sayfa istekleri arasında en az
  1,5 saniye, aynı anda tek sayfa isteği, görsel sayfası çözümlemede en fazla 2 eşzamanlı istek,
  art arda 5 görselsiz sayfadan sonra durma.
- Sitenin içeriği, reklamları veya yerleşimi değiştirilmez; yalnızca bir buton ve kapatılınca
  tamamen kaldırılan bir görüntüleyici eklenir.
- Her görselde yazara ve entry'ye link verilir.

## Gizlilik

Eklenti veri toplamaz, saklamaz ve göndermez. Ayrıntılar: [PRIVACY.md](PRIVACY.md)

## Geliştirme

Gereksinim: Node.js 22.22 veya üstü (geliştirme Node 26 ile yapıldı). Build adımı yoktur.

```bash
npm install        # yalnızca test için jsdom
npm test           # birim ve smoke testleri
npm run serve      # http://127.0.0.1:5173/dev/playground.html
npm run icons      # ikonları yeniden üretir
npm run package    # dist/eksi-stories-<sürüm>.zip
```

Playground, görüntüleyiciyi Ekşi Sözlük'e hiç istek atmadan üretilmiş görsellerle açar
(`?scenario=0` … `?scenario=4`).

| Klasör | İçerik |
|---|---|
| `src/content/` | Content script yükleyicisi, buton ve bağlantı kodu |
| `src/core/` | Test edilen saf mantık: ayrıştırma, görsel çözümleme, sayfalama, story akışı |
| `src/viewer/` | Shadow DOM içinde çizen görüntüleyici |
| `test/` | `node:test` + jsdom testleri; sentetik ekşi HTML üreticileri |
| `dev/` | Görüntüleyici playground'u |
| `store/` | Chrome Web Store metinleri ve görselleri |
| `docs/superpowers/` | Tasarım dokümanı ve uygulama planı |

## Manuel test listesi

- [ ] Paketlenmemiş eklenti hatasız yükleniyor (`chrome://extensions` hata göstermiyor).
- [ ] Örnek başlıkta buton görünüyor ve görsel sayısı doğru.
- [ ] Görselsiz bir başlıkta buton `story · 0`; tıklayınca sonraki sayfalar aranıyor.
- [ ] Tek sayfalı bir başlıkta son story'den sonra `başlığın sonuna geldin` kartı.
- [ ] `?a=popular` ya da `?a=nice` filtresiyle açılan başlıkta sonraki sayfa aynı filtreyle yükleniyor.
- [ ] Açık ve koyu temada buton okunaklı.
- [ ] Klavye (← → boşluk Esc) ve basılı tutarak duraklatma çalışıyor.
- [ ] Çok dikey, çok geniş ve kare görseller kırpılmadan gösteriliyor.
- [ ] Pencere yeniden boyutlandırılınca katmanlar görsele hizalı kalıyor.
- [ ] Kapatınca son izlenen entry mevcut sayfadaysa ona kaydırılıyor.
- [ ] DevTools Network sekmesinde sayfa istekleri arası en az 1,5 sn.

## Lisans

MIT, bkz. [LICENSE](LICENSE).
