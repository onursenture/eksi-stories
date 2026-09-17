# sayfa istek sırasının sınırları: tasarım

Tarih: 2026-09-17
Durum: Onaylandı (brainstorming sonucu).

## 1. Sorun

`2026-09-17-ortak-istek-sirasi-design.md` uygulandıktan sonraki son kod incelemesi, o daldan önce de var olan üç konuyu kapsam dışı bıraktı:

1. **Sekmeler arası.** Sıra her `main()` çağrısında, yani sayfa yüklemesi başına kurulur (`src/content/main.js`, `pageQueue = createPageQueue()`). İki ekşi sekmesinde aynı anda story izlenirse iki sekmenin sayfa istekleri paralel gidebilir. README "sayfa istekleri arasında en az 1,5 saniye bekler, aynı anda tek sayfa ister" der, sekmeden söz etmez.
2. **`focusto` gezintisi.** Başka sayfadayken kapatınca `onClose` içinde `pageSource.dispose()`'un hemen ardından `navigate(...?focusto=<entry id>)` çağrılır. Tam sayfa gezintisi, o an uçuştaki sayfa isteğiyle kısa süre çakışabilir. Yeni sayfa boş bir sırayla başlar.
3. **Saat.** `createPageQueue`'nun varsayılan saati `Date.now()`. Bekleme `lastRequestAt + minGapMs - now()` ile hesaplanır.

## 2. Risk değerlendirmesi

### 2.1 Sekmeler arası

- Arka plandaki sekmede story ilerlemez: görüntüleyici `visibilitychange` ile durur (`src/viewer/viewer.js`), ilerleme çizgisinin animasyonu bitmez, `feed.next()` çağrılmaz.
- Arka planda yalnızca başlamış bir okuma zinciri sürer: sayfa yanıtı gelince `ensureAhead()` önde 3'ten az story varsa sonraki sayfayı ister, zincir 5 ardışık görselsiz sayfada durur (`src/core/story-feed.js`). Zincirin istekleri o sekmenin sırasında en az 1500 ms arayla gider.
- En kötü durumda iki sekmede aynı anda 2 sayfa isteği uçuşta olur, herhangi bir 1,5 sn içinde en fazla 2 istek başlar. Bu, iki ekşi sayfasını aynı anda açmakla aynı mertebededir.
- Eklentinin ekşi'ye giden daha büyük akışı `/img/<id>` istekleridir. Görsel çözümleyici de `main()` içinde sekme başına kurulur, istekleri arasında aralık yoktur, en fazla ikişer gider. Yalnızca sayfa isteklerini sekmeler arasında bağlamak "siteyi yormaz"ı belirgin biçimde güçlendirmez. README'deki "ikişer" sözü de sekme başınadır.
- Sonuç: yük riski düşük. README cümlesi kapsamını söylemediği için eksik. Store yazıları ve PRIVACY istek sayısı vermez.

### 2.2 `focusto` gezintisi

- Çakışma yalnızca kapatma anında bir sayfa isteği gerçekten uçuştaysa olur ve o isteğin yanıt süresi kadar sürer (genelde bir saniyeden kısa). Kapatma 1500 ms aralık ya da 5000 ms tekrar beklemesi sırasındaysa `dispose()` sonrasında istek gitmez.
- Gezinti, kullanıcının entry linkine tıklamasıyla aynı sayfa görüntülemedir. Uçuştaki istek zaten gönderilmiştir; yeni sayfa gelince tarayıcının onu kesmesi ek yük getirmez.
- Yeni sayfanın boş sırayla başlaması her gezintide böyledir, kullanıcı ekşi'nin kendi sayfa linkine bastığında da. Aralık kuralının bozulması için eski isteğin başlangıcından sonraki 1,5 sn içinde yeni sayfanın yüklenmesi, butona basılması ve açılan sayfada en fazla 3 görsel olması (açılışta önden sayfa istenir) gerekir. Olsa da tek istek birkaç yüz ms erken gider.
- Gezintiyi geciktirmenin bedeli gerçektir: ekran kalkar, sayfa bir süre yerinde durur, kullanıcı kaydırırken ya da tıklarken birden başka sayfaya gidilir.
- Sonuç: risk çok düşük.

### 2.3 Saat

- Saat ileri atlarsa bir bekleme kısalır ve tek bir istek çifti 1500 ms'den yakın gidebilir. Önemsizdir.
- Saat geri giderse bekleme, geri gidilen süre kadar uzar. Ortak sıradan önce her oturumun kendi sayacı vardı, kapatıp açmak takılmayı aşıyordu. Şimdi sıra sekmede ortaktır ve kapatmak beklemeyi kısaltmaz (`2026-09-17-ortak-istek-sirasi-design.md` §5). Saat son istekten beri geçen süreden fazla geri alınırsa (elle değiştirme, uzun süre yanlış kalıp düzeltilme) o sekmede sayfa yükleme, sayfa yenilenene kadar takılabilir. Küçük NTP düzeltmelerinin etkisi bir saniyenin altındadır.
- `performance.now()` monotondur: `now()` hiçbir zaman `lastRequestAt`'ten küçük olmadığı için bekleme hiçbir zaman `minGapMs`'yi geçmez. Content script'te, Node'da ve jsdom'da vardır.
- Sonuç: nadir, ama varsayılan saati değiştirmek yeter.

## 3. Kararlar

- **Sekmeler arası:** kod değişmez. README cümlesi "her sekmede" diye netleşir (kullanıcı kararı, 17.09.2026).
- **`focusto`:** kod değişmez, gerekçesi bu belgede durur (kullanıcı kararı, 17.09.2026).
- **Saat:** `createPageQueue`'nun varsayılan saati `performance.now()` olur, bir regresyon testi eklenir (kullanıcı kararı, 17.09.2026).
- Seçilmeyen yaklaşımlar:
  - `navigator.locks` ile sekmeler arası ortak sıra. İzin ve depolama gerektirmez, sekme kapanınca kilit kalkar. Sekmeler ortak saat tutmadığı için aralık, kilidi tutan sekmede son istek başlayalı `minGapMs` geçene kadar kilit bırakılmayarak sağlanır. Bedeli: jsdom'da `navigator.locks` yoktur, testlerde sahte kilit gerekir. Content script'in sayfanın kilitlerini paylaştığı canlı Chrome'da iki sekmeyle doğrulanmalıdır. Bir sekmenin isteği diğerinin 5000 ms tekrar beklemesini bekleyebilir. `/img/` istekleri yine sekme başına kalacağından README'ye yine "her sekmede" girerdi. İleride gerekirse yol budur.
  - `focusto` gezintisini uçuştaki istek bitince yapmak. Sıraya "boşalınca haber ver" ve kesilebilir bir tekrar beklemesi gerekir. Ekran kalktıktan sonra gecikmeli gelen gezinti kullanıcıyı şaşırtır; ekranı istek bitene kadar açık tutmak ayrı arayüz işidir.
  - Son istek anını `sessionStorage` ile yeni sayfaya taşımak. PRIVACY'deki "sekme kapanınca ya da sayfa yenilenince siler" sözü değişir. Sayfalar arasında karşılaştırma duvar saati ister, monoton saat kararıyla çelişir.
  - `Date.now()` kalıp beklemeyi `minGapMs` ile sınırlamak. Geri almada takılmayı önler ama saat ileri atlayınca aralık yine kısalır.
  - Saat için hiçbir şey yapmamak. Saat büyük ölçüde geri alınınca takılma kalırdı.

## 4. Kod (`src/core/page-source.js`)

```js
export function createPageQueue({ minGapMs = PAGE_MIN_GAP_MS, now = () => performance.now(), sleep = defaultSleep } = {})
// → { run(job, signal), pace(signal) }
```

- Yalnızca `now` varsayılanı değişir. `run`, `pace` ve `createPageSource` aynı kalır.
- `createPageQueue` JSDoc'una şu cümle eklenir: "Varsayılan saat monotondur: sistem saati geri alınsa da bekleme `minGapMs`'yi geçmez."
- `performance.now()` her belgede sıfırdan başlar. Sıra sayfa yüklemesi başına kurulduğu için sayfalar arasında karşılaştırma yapılmaz.

## 5. Test (`test/page-source.test.js`)

Yeni test: `sistem saati geri alınsa da aralık beklemesi 1500 ms'yi geçmez`.

- Sıra `now` verilmeden, sahte `sleep` ile kurulur. `sleep` her bekleme süresini bir listeye yazar ve hemen döner.
- `pace`, sözleşmesine uygun olarak `run` işinin içinden çağrılır: `queue.run(() => queue.pace(signal), signal)`. `signal`, hiç iptal edilmeyen bir `AbortController`'dan gelir.
- İlk `run` bittikten sonra `Date.now`, `t.mock.method(Date, 'now', ...)` ile gerçek değerinin bir saat gerisini döndürür. Mock test bitince kendiliğinden geri alınır. Sonra ikinci `run` çalışır.
- Beklenen: listede tek bir bekleme olur, 0'dan büyüktür ve 1500 ms'yi geçmez. Tek bekleme şartı, varsayılan saatle aralığın hâlâ beklendiğini de sabitler. Bugünkü kodda bu bekleme yaklaşık 3.601.500 ms olduğu için test başarısız olur.
- Mevcut testler saati dışarıdan verir ve değişmez. `test/main.smoke.test.js`'te `pageQueue` verilmeyen testler varsayılan sırayı gerçek `performance.now()` ile kullanır.

## 6. Belgeler

- `README.md`, "kurallar" bölümündeki madde:

  ```markdown
  - siteyi yormaz: her sekmede sayfa istekleri arasında en az 1,5 saniye bekler, aynı anda tek sayfa ister, görsel sayfalarını en fazla ikişer açar, 5 görselsiz sayfadan sonra durur.
  ```

- `docs/superpowers/specs/2026-09-14-eksi-stories-design.md`: başındaki son `Not:` satırının altına şu satır eklenir:

  ```markdown
  Not: §2.2 istek disiplini sekme başına geçerlidir; bkz. 2026-09-17-istek-sirasi-sinirlari-design.md.
  ```

- `docs/superpowers/specs/2026-09-17-ortak-istek-sirasi-design.md`: `Durum:` satırının altına şu satır eklenir:

  ```markdown
  Not: §3 `createPageQueue`'nun varsayılan saati 2026-09-17-istek-sirasi-sinirlari-design.md ile `performance.now()` oldu; sekmeler arası sıra ve kapatınca yapılan `focusto` gezintisi aynı belgede gerekçesiyle kapsam dışı bırakıldı.
  ```

- Eski spec'lerin gövdesi değişmez, önceki güncellemelerdeki gibi yalnızca not düşülür.
- PRIVACY, store yazıları ve CHANGELOG değişmez. PRIVACY ve store yazıları istek sayısı vermez. CHANGELOG istek kurallarından söz etmez ve 0.1.0 henüz yayınlanmadı.

## 7. Kapsam dışı

- Sekmeler arası ortak sayfa sırası ve `/img/` isteklerini sekmeler arasında sınırlamak (bkz. §3).
- `focusto` gezintisinin zamanlaması ve yeni sayfaya sıra durumu taşımak (bkz. §3).
- Kapatınca uçuştaki isteği ya da 5000 ms tekrar beklemesini kesmek (`2026-09-17-ortak-istek-sirasi-design.md` §2, kullanıcı kararı).

## 8. Doğrulama

1. Yeni test, `now` varsayılanı değişmeden önce başarısız olur.
2. Değişiklikten sonra `npm test`: 88 test geçer.
3. `git diff main --stat` yalnızca şunları gösterir: `src/core/page-source.js`, `test/page-source.test.js`, `README.md`, iki eski spec'e eklenen birer `Not:` satırı, bu belge ve planı.
4. Canlı Chrome kontrolü gerekmez: normal koşullarda davranış değişmez. `1da68f9`'un bekleyen canlı kontrolü ayrı iştir.
