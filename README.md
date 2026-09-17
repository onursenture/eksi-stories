# stories for ekşi sözlük

ekşi sözlük başlıklarındaki görselleri story gibi izlemek için chrome eklentisi.

> resmi değil, ekşi teknoloji ile bağı yok.

## ne yapar

- başlığın yanına **story · 12** gibi bir buton koyar. sayı o sayfadaki görsel sayısı.
- basınca görseller o sayfadan başlayarak tam ekran açılır. bitince sonraki sayfa yavaşça yüklenir.
- aynı entry'deki görseller art arda gelir, üstte her biri için bir çizgi olur.
- görselleri kırpmaz. dikey, yatay, panorama, ekran görüntüsü, hepsi kendi oranında.
- her görselde yazarın avatarı ve adı, tarih ve entry'ye git linki var.
- üstte o sayfada kaçıncı görselde olduğun yazar, mesela 5/12.
- alttaki sayfa kutusuyla ekşi'deki gibi sayfa değiştirebilirsin.
- kapatınca son baktığın entry'ye gider.
- ekşi görsellerini (`soz.lk/i/…`, `eksisozluk.com/img/…`) ve `.jpg`, `.png`, `.gif`, `.webp` linklerini açar.

## kısayollar

| ne | nasıl |
|---|---|
| sonraki / önceki | → / ← ya da ekranın sağına / soluna tıkla |
| durdur | basılı tut ya da boşluk |
| entry'nin tamamı | alttaki yazıya tıkla |
| sayfa değiştir | alttaki sayfa kutusu, « ya da » |
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
- siteyi yormaz: her sekmede sayfa istekleri arasında en az 1,5 saniye bekler, aynı anda tek sayfa ister, görsel sayfalarını en fazla ikişer açar, 5 sayfa boyunca görsel açılmazsa durur.
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

playground ekşi'ye hiç istek atmadan sahte görsellerle açılır: `?scenario=0` … `?scenario=5`.

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
- [ ] başka sayfadayken kapatınca son bakılan entry açılıyor.
- [ ] çok sayfalı başlıkta altta ekşi'deki gibi sayfa kutusu var, sayfa değişiyor.
- [ ] sayaç sayfa içinde doğru sayıyor, sonraki sayfada 1'den başlıyor.
- [ ] avatarlar görünüyor, avatarı olmayan yazarda varsayılan çizim var.
- [ ] devtools network'te sayfa istekleri arası en az 1,5 sn.

## lisans

mit, bkz: [license](LICENSE)
