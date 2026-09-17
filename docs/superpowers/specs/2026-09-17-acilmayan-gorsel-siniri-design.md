# açılmayan görsellerde sayfa sınırı: tasarım

Tarih: 2026-09-17
Durum: Onaylandı (brainstorming sonucu). Son incelemeden sonra §3, §8, §9 ve §10 düzeltildi: önde açık ekrandaki kalan risk ölçülen sayılarla yazıldı, hızlı geçişte kart çıkabileceği eklendi, tampondaki sayfaya geçiş için bir test eklendi.
Not: §9'daki önde açık ekran riski 2026-09-17-kendiliginden-ilerleme-hizi-design.md ile ele alındı; §3 ve §7'deki "görsel açılmadı, geçildi" bildirimi aynı belgeyle kalktı.

## 1. Sorun

`2026-09-17-istek-sirasi-sinirlari-design.md` §2.1 ve §7 bu konuyu kapsam dışı bırakıp ayrı tasarıma ayırdı. Sorun o daldan önce de vardı.

- Görsel açılmayınca story kendiliğinden ilerler. `src/core/story-feed.js` içinde `resolveStory` çözümleyici reddedince, `src/viewer/viewer.js` içinde de `loadImage`'daki `image.onerror`, `feed.markFailed(story)` çağırır. `markFailed` aktif story'yi atlatır, `ensureAhead()` de önde 3'ten az story kalınca sonraki sayfayı ister.
- Görselsiz sayfa sınırı (`EMPTY_PAGE_LIMIT`, 5) açılan görseli değil, eklenen story'yi sayar. `appendEntries` görsel referansı ekleyen her sayfada `emptyStreak`'i sıfırlar, bu yüzden görselleri açılmayan sayfalar sınıra hiç takılmaz.
- Story akışı duraklatmadan habersizdir. Sekme gizliyken (`visibilitychange`), boşlukla ya da basılı tutarak durdurulunca, yazı açıkken ya da sayfa kutusu odaktayken yalnızca ilerleme çizgisinin animasyonu durur. `markFailed` ilerletmeye devam eder.
- Bozulan sözler:
  - ilk tasarım §2.2: "art arda 5 görselsiz sayfadan sonra otomatik ilerleme durur";
  - README: "5 görselsiz sayfadan sonra durur".

Yeniden üretim, 17.09.2026 kod incelemesi (jsdom, `main()` ve sahte saatli `createPageQueue`):
- 30 sayfalık başlık, her sayfada 4 soz.lk görseli, bütün `https://eksisozluk.com/img/<id>` istekleri 404 dönüyor.
- Görüntüleyici gizli sekmede durdurulmuşken ve ekrana hiç dokunulmadan 2–30. sayfalar istendi: 29 sayfa isteği, 1500 ms'lik 28 aralık beklemesi, 120 `/img/` isteği.
- Ekran "başlıkta başka görsel yok" kartında kaldı.
- Görseller açılınca aynı durumda hiç sayfa istenmedi.

## 2. Risk değerlendirmesi

### 2.1 Ölçüm

Sanal saatli simülasyon yapıldı. Betik repoya eklenmedi, planda verilir.
- Gerçek `createStoryFeed`, `createPageSource`, `createPageQueue`, `createResolver` ve jsdom ayrıştırması kullanıldı.
- Görüntüleyici durdurulmuş, ekrana dokunulmuyor. Direkt linklerde görüntüleyicinin `onerror` davranışı taklit edildi.
- Başlık 22.000 sayfalık, sayfa yanıtı 300 ms. 10 dakikalık sanal süre ölçüldü ve saate çevrildi.

| durum | sayfa / saat | `/img/` / saat |
|---|---|---|
| sayfada 100 entry, `/img/` 404 (150 ms) | ~470 | ~47.000 |
| sayfada 10 entry (oturum kapalıyken varsayılan), `/img/` 404 (150 ms) | ~2.400 | ~24.000 |
| sayfada 100 entry, `/img/` 429 (50 ms) | ~1.300 | ~131.000 |
| sayfada 100 entry, ölü direkt linkler, 100 ms'de hata | ~360 | 0 |
| sayfada 100 entry, ölü direkt linkler, 3 sn'de zaman aşımı | ~12 | 0 |

Her senaryoda sayfa istekleri arasında en az 1500 ms vardı.

### 2.2 Bulgular

- **Aralık kuralı tutuyor ama süre sınırsız.** Sayfa istekleri sekmenin sırasında en az 1500 ms arayla gider. Zinciri ise yalnızca şunlar durdurur: ilk açılan görsel, başlığın sonu, tekrar denendiği halde gelmeyen ya da okunamayan sayfa, ekranın kapanması.
- **Sorun yalnızca gizli sekmede değil.** Ekran önde açıkken başından kalkılınca ya da ekran durdurulunca da (❚❚ görünürken) aynı zincir çalışır. Yalnızca `document.hidden`'a bakan bir çözüm bu durumları kapsamaz.
- **Asıl yük `/img/` istekleri ve hatalar onları hızlandırıyor.** Normal izlemede story başına bir `/img/` isteği gider, yani 5 sn'de bir. Hata zincirinde istekler yanıt gelir gelmez, en fazla ikişer gider. Sunucu hatayı ne kadar hızlı dönerse zincir o kadar hızlanır; en kötüsü 429.
- **Sayfa boyu çarpan etkisi yapıyor.** Sayfalar kullanıcının oturumuyla istenir (`credentials: 'include'`). Sayfada 100 entry gösteren bir hesapta sayfa başına ~100 `/img/` isteği düşer.
- **Tarayıcı zinciri durdurmuyor.** Chrome'un arka plan kısıtlamaları zamanlayıcıları yavaşlatır ama `fetch` yanıtlarını ve `<img>` hatalarını durdurmaz; zincire güvenilir bir sınır koymaz.

### 2.3 Olasılık ve sonuç

- İki şart birlikte gerekir: uzun bir açılmayan görsel dizisi olmalı ve ekranın başında kimse olmamalı.
- Eski sayfalardaki ölü direkt linkler ve 1. sayfadan açılıp unutulan bir sekme gerçekçi bir durum. Oturum açıkken uzun bir `/img/` 404 dizisi daha az olası, ama 429 gelirse zincir kendini hızlandırır.
- Sonuç: README'deki söz tutmuyor. Store yayınından önce düzeltilmeli.

## 3. Kararlar

- **Kural:** önden sayfa okuma, son açılan görselin sayfasından sonra `EMPTY_PAGE_LIMIT` (5) sayfa yüklenince durur (kullanıcı kararı, 17.09.2026).
  - Görselsiz sayfa da görselleri açılmayan sayfa da sayılır.
  - Sekme gizli, önde ya da durdurulmuş olsun, kural aynıdır. Gizli ya da durdurulmuş ekranda zincir zaten ilk açılan görselde durur.
- **"Açıldı" tanımı:** aktif story'nin görüntüleyicideki `<img>` için `load` olayı gelmiş olmalı. Adresin çözülmüş olması yetmez, çünkü direkt linkler çözülmeden `ready` olur.
- **Sayılmayan sayfalar** bugünkü gibi: açılış sayfası, tamponda olmayıp atlanan sayfa ve "aramaya devam"a basıldığı anda son yüklenen sayfa.
- **Sınır kalıcı değil.** Sınır doluyken tampondaki bir görsel açılırsa önden okuma kendiliğinden sürer. Böylece kullanıcı tampondaki bir görseli daha görmeden kart çıkmaz.
- **Görseller açılıyorsa davranış neredeyse aynı kalır.** İki fark var:
  - Çok seyrek başlıklarda (5 sayfada 2 ya da daha az görsel) önden okuma, sıradaki görsel açılana kadar bekleyebilir.
  - Görseller açılmadan hızla geçilirse, açılan görsel olmadan 5 sayfa yüklenebilir ve kart çıkar. Son incelemedeki simülasyonda sayfada 10 görsel ve 300 ms açılma süresiyle 150 ms'de bir geçişte kart 9. saniyede çıktı; 400 ms'de bir geçişte çıkmadı. `aramaya devam` ya da ← ile sürer.
- **Kart metni:** `5 sayfadır açılan görsel yok`, buton `aramaya devam` (kullanıcı kararı, 17.09.2026). Metin iki durumu da doğru anlatır: sayfalarda hiç görsel olmaması ve görsellerin açılmaması.
- **Değişmeyenler:**
  - sayfa isteği sırası ve 1500 ms aralık;
  - 429/5xx sonrası 5000 ms bekleyip tek tekrar;
  - `/img/` eşzamanlılığı (2);
  - kapatma davranışı ve sekme başına sıra;
  - "görsel açılmadı, geçildi" bildirimi;
  - `EMPTY_PAGE_LIMIT` adı ve değeri.
- Seçilmeyen yaklaşımlar:
  - **Gizli sekmede açılmayan görseli atlamamak.** Gizli sekmede istekleri neredeyse sıfıra indirir, ama önde açık ya da durdurulmuş ekranı kapsamaz; tek başına yetmez. Bu kuralın üstüne eklenirse, bu kuralın zaten sınırladığı kısa patlamayı küçültür. Bedeli görüntüleyiciyle story akışı arasında yeni bir bağ.
  - **Gizliyken önden sayfa istememek.** Tampondaki bütün görseller için yine `/img/` ister ve önde açık ekranı kapsamaz.
  - **Art arda açılmayan görsel sayısına sınır (N).** `/img/` patlamasını 429 dahil N isteğe indirir.
    - Tek başına seyrek başlıkta zayıf kalır: görselsiz sayfalar bu sayacı artırmaz, tek görselli sayfalar arasında görselsiz sayfalar varsa ~N×5 sayfa gidebilir.
    - Bu kuralın üstüne eklenirse bedeli ikinci bir sayı, story ortasında çıkan yeni bir kart ve ölü linkli eski başlıklarda daha sık kart.
  - **Kalıcı sayaç.** Sayaç her sayfa yüklemesinde artar, görsel açılınca sıfırlanır, sınır dolunca da "aramaya devam"a basılana kadar kapalı kalır. Seyrek başlıkta sınır, tampondaki görsel daha gösterilmeden dolar. Kullanıcı o görseli gördükten sonra çıkan "5 sayfadır açılan görsel yok" kartı yanlış olur.

## 4. Story akışı (`src/core/story-feed.js`)

- `blocked` ve `emptyStreak` değişkenleri kalkar. Yerlerine iki değişken gelir:
  - `searchFromPage`: sayımın başladığı sayfa. Başta açılış sayfası (`page`).
  - `lastOpenedPage`: görseli açılan en ileri story'nin sayfası. Başta 0.
- **Sınır doluluğu:** `lastLoadedPage - Math.max(searchFromPage, lastOpenedPage) >= emptyPageLimit`.
- **`fetchNextPage()`:** sınır doluysa istek atmaz; bugünkü `blocked` koşulunun yerini bu alır. Sayfa gelince yapılan `emptyStreak` hesabı kalkar, `appendEntries`'in döndürdüğü sayı artık kullanılmaz.
- **`state.blocked`:** sınır dolu ve `pageSource.hasNext()` doğruysa true. `ended` tanımı değişmez.
  - Yan etki: sınır başlığın son sayfasında dolarsa bugün "aramaya devam" kartı çıkıyor, basınca "başlıkta başka görsel yok" geliyor. Artık doğrudan "başlıkta başka görsel yok" çıkar.
- **Yeni metot `markOpened(story)`:**
  - `disposed` doğruysa, `story` aktif story değilse (`stories[index] !== story`) ya da `story.page <= lastOpenedPage` ise hiçbir şey yapmaz.
  - Değilse `lastOpenedPage = story.page` yapar, `ensureAhead()` çalıştırır ve `change` yayar.
  - Akışın döndürdüğü nesneye eklenir.
- **`goToPage(page)`:**
  - Tamponda olmayan sayfaya atlanınca `blocked = false` ve `emptyStreak = 0` yerine `searchFromPage = target` ve `lastOpenedPage = 0` yapılır.
  - Tampondaki sayfaya geçişte bu sayılar değişmez.
- **`continueSearching()`:** sınır dolu değilse hiçbir şey yapmaz. Doluysa `searchFromPage = lastLoadedPage` yapar, `ensureAhead()` çalıştırır ve `change` yayar.
- `createStoryFeed` parametreleri aynı kalır (`emptyPageLimit = EMPTY_PAGE_LIMIT`).

## 5. Görüntüleyici (`src/viewer/viewer.js`)

- `loadImage` içindeki `image.onload`: mevcut koruma ve işlemlerden sonra, en sonda `feed.markOpened(story)` çağrılır.
- `renderCard` içinde `state.blocked` durumunun metni `` `${EMPTY_PAGE_LIMIT} sayfadır açılan görsel yok` `` olur. `aramaya devam` ve `kapat` butonları aynı kalır.
- Önden yükleme görseli (`preloader`) ve bulanık arka plan `markOpened` çağırmaz.

## 6. Metinler ve belgeler

- `README.md`, "kurallar" bölümündeki madde:

  ```markdown
  - siteyi yormaz: her sekmede sayfa istekleri arasında en az 1,5 saniye bekler, aynı anda tek sayfa ister, görsel sayfalarını en fazla ikişer açar, 5 sayfa boyunca görsel açılmazsa durur.
  ```

- `README.md`, "geliştirme" bölümü: `` `?scenario=0` … `?scenario=4` `` → `` `?scenario=0` … `?scenario=5` ``.
- "elle test" listesine madde eklenmez. Görselleri açılmayan bir başlığı canlıda güvenilir biçimde bulmak zor; bu durumu playground senaryosu (§7) karşılar.
- Eski spec'lerin gövdesi değişmez. Önceki güncellemelerdeki gibi başlarındaki `Durum:` satırının ya da son `Not:` satırının altına bir not eklenir:
  - `docs/superpowers/specs/2026-09-14-eksi-stories-design.md`:

    ```markdown
    Not: §2.2, §4, §5 ve §10'daki 5 görselsiz sayfa sınırı 2026-09-17-acilmayan-gorsel-siniri-design.md ile "son açılan görselin sayfasından sonra 5 sayfa" oldu; görselleri açılmayan sayfalar da sayılır.
    ```

  - `docs/superpowers/specs/2026-09-16-sayfa-gostergesi-design.md`:

    ```markdown
    Not: §6'daki boş sayfa sayacı 2026-09-17-acilmayan-gorsel-siniri-design.md ile değişti: atlamada sayım hedef sayfadan başlar, hedef sayfa yine sayılmaz.
    ```

  - `docs/superpowers/specs/2026-09-17-istek-sirasi-sinirlari-design.md`:

    ```markdown
    Not: §2.1 ve §7'de kapsam dışı bırakılan açılmayan görsel konusu 2026-09-17-acilmayan-gorsel-siniri-design.md ile ele alındı.
    ```

  - `docs/superpowers/specs/2026-09-16-eksi-dili-metinler-design.md`:

    ```markdown
    Not: §4'teki boş sayfa sınırı kartı 2026-09-17-acilmayan-gorsel-siniri-design.md ile `${EMPTY_PAGE_LIMIT} sayfadır açılan görsel yok` oldu.
    ```

- Store yazıları, PRIVACY ve CHANGELOG değişmez:
  - Store yazıları ve PRIVACY istek sayısı vermez.
  - CHANGELOG istek kurallarından söz etmez; 0.1.0 da henüz yayınlanmadı.
  - Store ekran görüntülerinde kart görünmez.

## 7. Playground (`dev/playground.js`)

- Senaryo listesinin sonuna yeni senaryo eklenir (`?scenario=5`): `açılmayan görseller → aramaya devam`.
  - 1. sayfa: açılan tek bir görsel. Yazısı: `sonrasında görselleri açılmayan 5 sayfa var`.
  - 2–6. sayfalar: her birinde bozuk tek bir görsel (`BROKEN_IMAGE`).
  - 7. sayfa: açılan tek bir görsel. Yazısı: `aramaya devam edince bulundu`.
- Beklenen akış:
  1. 1. sayfanın görseli açılır.
  2. 2–6. sayfaların her görseli için "görsel açılmadı, geçildi" bildirimi çıkar.
  3. `5 sayfadır açılan görsel yok` kartı gelir.
  4. "aramaya devam"a basınca 7. sayfanın görseli açılır.
- Gerçek tarayıcıda `load` ve `error` olayları tetiklendiği için görüntüleyicideki `markOpened` çağrısı uçtan uca yalnızca burada görülebilir; jsdom görsel yüklemez.
- Mevcut "boş sayfalar → aramaya devam" senaryosunun kodu değişmez, yalnızca yeni kart metnini gösterir.

## 8. Testler

### `test/story-feed.test.js`

Beş yeni test eklenir. Hepsi bugünkü kodda başarısız olur.

1. `görselleri açılmayan sayfalar da 5 sayfa sınırına sayılır`
   - Kurulum: her sayfada açılmayan tek bir görsel var.
   - Beklenen: yalnızca 2–6. sayfalar istenir, `blocked` true, `ended` false olur, aktif story kalmaz.
   - `continueSearching()` sonraki 5 sayfayı ister.
2. `görsel açılınca sayım o görselin sayfasından yeniden başlar`
   - Kurulum: 4. sayfadaki görsel açılıyor, diğerleri açılmıyor.
   - `markOpened` çağrılmadan istekler 6. sayfada durur.
   - Aktif story (4. sayfa) için `markOpened` çağrılınca 7. sayfa kendiliğinden istenir.
   - `next()` ile ilerleyince sayım 4. sayfadan yapılır ve istekler 9. sayfada yeniden durur.
3. `aktif olmayan story için markOpened yok sayılır`
   - Sınır doluyken tampondaki son story (`peek(-1)`) verilir.
   - Beklenen: istek atılmaz, `blocked` değişmez.
4. `sınır son sayfada dolarsa başlık biter`
   - Kurulum: 6 sayfalık başlık, 2–6. sayfalar görselsiz.
   - Beklenen: `blocked` false, `ended` true.
5. `atlamada açılan görselin sayfası sıfırlanır`
   - 10. sayfaya atlanır, oradaki görsel açılır (`markOpened`), sonra 3. sayfaya atlanır.
   - Beklenen: sonraki sayfa olarak yalnızca 4–8. sayfalar istenir ve `blocked` true olur.

Mevcut "art arda 5 görselsiz sayfada durur, continueSearching devam ettirir" ve "görselsiz hedef sayfadan sonra arama sürer ve hedef boş sayfa sayılmaz" testleri değişmeden geçer.

Son incelemeden sonra kullanıcı kararıyla (17.09.2026) bir story akışı testi daha eklendi: `tampondaki sayfaya geçiş sayfa sınırını sıfırlamaz`. 1. testteki gibi sınır 6. sayfada dolar, sonra tampondaki 3. sayfaya geçilir (`goToPage(3)`). Yeni sayfa istenmez ve `blocked` true kalır; tampon içi geçiş sayımı hedef sayfadan yeniden başlatsaydı 7. ve 8. sayfalar istenirdi.

### `test/main.smoke.test.js`

İki yeni test eklenir. İkisi de `main`'e sahte saatli `pageQueue` verir (`now` ve `sleep` testteki saati kullanır) ve bugünkü kodda başarısız olur.

6. `görselleri açılmayan başlıkta gizli sekme 5 sayfadan sonra durur`: bildirilen senaryo.
   - Kurulum: 30 sayfalık başlık, her sayfada 4 soz.lk görseli, bütün `/img/` istekleri 404. Açılıştan sonra testte `document.hidden` true döndürür ve `visibilitychange` olayı gönderilir.
   - Beklenenler:
     - yalnızca `?p=2` … `?p=6` istenir;
     - 24 `/img/` isteği gider;
     - bekleme listesinde dört kez 1500 ms olur;
     - kartta `5 sayfadır açılan görsel yok` metni ve `aramaya devam` butonu görünür.
   - `aramaya devam`a basınca `?p=7` … `?p=11` istenir ve kart yeniden çıkar.
7. `görsel açılınca önden okuma o görselin sayfasından sürer`
   - Kurulum: 1–5. sayfalarda 4'er görsel var, `/img/` istekleri 404 döner. 6. sayfada `/img/` isteği başarılı dönen tek bir görsel var. Sonraki sayfaların `/img/` istekleri yine 404 döner.
   - `load` olayı tetiklenmeden istekler `?p=6`'da durur ve `.es-image`'in `src` değeri 6. sayfanın görselidir.
   - `.es-image` üzerinde `load` olayı tetiklenince `?p=7` istenir.
   - Görüntüleyicideki `markOpened` çağrısını sabitler. jsdom görsel yüklemediği için olay elle tetiklenir.

Test sayısı 88'den 96'ya çıkar.

## 9. Kapsam dışı

- **Sunucu hata verince `/img/` isteklerini yavaşlatmak ve 429/5xx görsel hatasını kalıcı olarak önbelleğe almamak.** Bu çözümleyicinin işi; v0.2'ye park edilen maddeyle birlikte ele alınır.
  - Bu tasarımdan sonra kalan en kötü durum: sınır dolana kadar açılış sayfasının ve 5 sayfanın `/img/` istekleri.
  - Sayfada 100 entry'de bu ~600 istek eder: 404'te ~45 sn, 429'da ~15 sn sürer. Sayfada 10 entry'de ~60 istek.
- **Önde açık ve durdurulmamış ekranda arada bir görseli açılan ama çoğu açılmayan başlık.** Son açılan görselin sayfasından sonraki 5 sayfa içinde yeni bir görsel açıldıkça zincir sürer; bu sınır onu durdurmaz. Açılan her görsel 5 sn gösterilir, ama açılmayanlar hızla atlandığı için hız eski hataya yakındır. Son incelemedeki simülasyon (10 dk, sayfada 100 entry):
  - her 5 sayfada bir görsel açılıyor, diğerlerinde `/img/` 404 dönüyor: ~417 sayfa/saat, ~41.700 `/img/`/saat;
  - her 5 sayfada bir görsel açılıyor, diğerleri ölü direkt link: ~324 sayfa/saat, `/img/` isteği yok;
  - her 6 sayfada bir görsel açılıyorsa zincir 89 sn'de durur; gizli ya da durdurulmuş ekranda ilk açılan görselde durur;
  - karşılaştırma: bütün görseller açılırken normal oynatma, sayfada 100 entry ile saatte ~7 sayfa ve ~720 `/img/` ister.

  Kullanıcı kararı (17.09.2026): bu dal böyle birleşir; kalan risk Store yayınından önce ayrı bir tasarımla ele alınır (art arda açılmayan görsel sınırı ya da `/img/` hatasında yavaşlama).
- Gizli ya da durdurulmuş ekranda açılmayan görseli bekletmek ve art arda açılmayan görsel sınırı (bkz. §3).
- Sekmeler arası sıra, `focusto` gezintisinin zamanlaması ve kapatınca uçuştaki isteği kesmek (`2026-09-17-istek-sirasi-sinirlari-design.md` §3 ve §7).

## 10. Doğrulama

1. Yeni testler değişiklikten önce başarısız olur.
2. Değişiklikten sonra `npm test` ile 96 test geçer.
3. Simülasyon betiği (planda) yeniden çalıştırılır. Beş senaryonun hepsinde şunlar görülür:
   - açılıştan sonra en fazla 5 sayfa isteği;
   - en fazla 6 × (sayfa başına görsel) `/img/` isteği;
   - sayfa istekleri arasında en az 1500 ms.
4. Playground uygulama içi tarayıcıda denenir:
   - yeni senaryoda bildirimler, kart metni ve `aramaya devam` çalışır;
   - "boş sayfalar" senaryosunda yeni kart metni görünür;
   - diğer senaryolar aynı kalır.
5. `git diff main --stat` yalnızca şu dosyaları gösterir: `src/core/story-feed.js`, `src/viewer/viewer.js`, `dev/playground.js`, `test/story-feed.test.js`, `test/main.smoke.test.js`, `README.md`, `Not:` satırı eklenen dört eski spec, bu belge ve planı.
6. Canlı Chrome kontrolü isteğe bağlı. Görseller açılırken davranış değişmez; görüntüleyicideki `load` bağlantısı playground'da gerçek tarayıcıda görülebilir.
