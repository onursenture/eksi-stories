# stories for ekşi sözlük

ekşi sözlük başlıklarındaki görselleri story tarzında, tam ekran ve otomatik ilerleyen bir
görüntüleyicide izlemenizi sağlayan chrome eklentisi.

> **resmi değildir.** bu proje ekşi sözlük ve ekşi teknoloji ile bağlantılı değildir.
> "ekşi sözlük" adı yalnızca eklentinin hangi site için olduğunu belirtmek için kullanılır.

## özellikler

- her başlık sayfasında başlığın yanında **story · n** butonu (n: bu sayfadaki görsel sayısı).
- bulunduğunuz sayfadan başlayıp ileri doğru akan story'ler. sona yaklaşınca sonraki sayfa
  arka planda, yavaşça yüklenir.
- birden fazla görselli entry'ler tek grup olarak gösterilir; üstte her görsel için bir çubuk.
- görseller kırpılmaz: dikey, yatay, panorama ya da ekran görüntüsü, her biri kendi oranında.
- her story'de yazar, tarih ve entry'ye giden link.
- desteklenen görseller: ekşi görselleri (`soz.lk/i/…`, `eksisozluk.com/img/…`) ve
  `.jpg`, `.png`, `.gif`, `.webp` ile biten doğrudan linkler.

## kısayollar

| eylem | nasıl |
|---|---|
| sonraki / önceki | → / ← ya da ekranın sağına / soluna tıkla |
| duraklat | basılı tut ya da boşluk tuşu |
| metnin tamamı | alttaki metne tıkla |
| kapat | esc ya da ✕ |

## kurulum (geliştirici modu)

1. repoyu indirin: `git clone https://github.com/onursenture/eksi-stories.git`
2. chrome'da `chrome://extensions` adresini açın.
3. sağ üstten **geliştirici modu**nu açın.
4. **paketlenmemiş öğe yükle** düğmesine basın ve repo klasörünü seçin.
5. herhangi bir başlığı açın, örneğin https://eksisozluk.com/anin-fotografi--6459985

kodu değiştirdikten sonra `chrome://extensions` sayfasında eklentinin yenileme düğmesine
basın ve ekşi sekmesini yenileyin.

## kurallara saygı

- yalnızca kişisel kullanım içindir; ticari amaç, reklam veya ücret yoktur.
- her şey sizin tarayıcınızda ve sizin oturumunuzla çalışır; yalnızca zaten görebildiğiniz
  sayfalar okunur.
- siteye yük bindirmemek için istekler sınırlandırılmıştır: sayfa istekleri arasında en az
  1,5 saniye, aynı anda tek sayfa isteği, görsel sayfası çözümlemede en fazla 2 eşzamanlı istek,
  art arda 5 görselsiz sayfadan sonra durma.
- sitenin içeriği, reklamları veya yerleşimi değiştirilmez; yalnızca bir buton ve kapatılınca
  tamamen kaldırılan bir görüntüleyici eklenir.
- her görselde yazara ve entry'ye link verilir.

## gizlilik

eklenti veri toplamaz, saklamaz ve göndermez. ayrıntılar: [privacy.md](PRIVACY.md)

## geliştirme

gereksinim: node.js 22.22 veya üstü (geliştirme node 26 ile yapıldı). build adımı yoktur.

```bash
npm install        # yalnızca test için jsdom
npm test           # birim ve smoke testleri
npm run serve      # http://127.0.0.1:5173/dev/playground.html
npm run icons      # ikonları yeniden üretir
npm run package    # dist/eksi-stories-<sürüm>.zip
```

playground, görüntüleyiciyi ekşi sözlük'e hiç istek atmadan üretilmiş görsellerle açar
(`?scenario=0` … `?scenario=4`).

| klasör | içerik |
|---|---|
| `src/content/` | content script yükleyicisi, buton ve bağlantı kodu |
| `src/core/` | test edilen saf mantık: ayrıştırma, görsel çözümleme, sayfalama, story akışı |
| `src/viewer/` | shadow dom içinde çizen görüntüleyici |
| `test/` | `node:test` + jsdom testleri; sentetik ekşi html üreticileri |
| `dev/` | görüntüleyici playground'u |
| `store/` | chrome web store metinleri ve görselleri |
| `docs/superpowers/` | tasarım dokümanı ve uygulama planı |

## manuel test listesi

- [ ] paketlenmemiş eklenti hatasız yükleniyor (`chrome://extensions` hata göstermiyor).
- [ ] örnek başlıkta buton görünüyor ve görsel sayısı doğru.
- [ ] görselsiz bir başlıkta buton `story · 0`; tıklayınca sonraki sayfalar aranıyor.
- [ ] tek sayfalı bir başlıkta son story'den sonra `başlığın sonuna geldin` kartı.
- [ ] `?a=popular` ya da `?a=nice` filtresiyle açılan başlıkta sonraki sayfa aynı filtreyle yükleniyor.
- [ ] açık ve koyu temada buton okunaklı.
- [ ] klavye (← → boşluk esc) ve basılı tutarak duraklatma çalışıyor.
- [ ] çok dikey, çok geniş ve kare görseller kırpılmadan gösteriliyor.
- [ ] pencere yeniden boyutlandırılınca katmanlar görsele hizalı kalıyor.
- [ ] kapatınca son izlenen entry mevcut sayfadaysa ona kaydırılıyor.
- [ ] devtools network sekmesinde sayfa istekleri arası en az 1,5 sn.

## lisans

mit, bkz. [license](LICENSE).
