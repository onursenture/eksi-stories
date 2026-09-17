# sayfa istek sırasının sınırları: uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sayfa isteği sırasının aralık beklemesini sistem saatinden bağımsız yapmak ve README'deki "siteyi yormaz" sözünün sekme başına geçerli olduğunu yazmak.

**Architecture:** `createPageQueue`'nun varsayılan saati `Date.now()` yerine monoton `performance.now()` olur; `run`, `pace` ve başka hiçbir kod değişmez. Yeni test `Date.now`'u bir saat geri alır ve beklemenin 1500 ms'yi geçmediğini doğrular. Belgelerde yalnızca README'deki "siteyi yormaz" maddesi ve iki eski spec'in başındaki `Not:` satırları değişir.

**Tech Stack:** Vanilla JS (MV3 Chrome eklentisi, build yok), `performance.now()`, Node.js `node:test` (`t.mock.method`), jsdom.

**Spec:** [docs/superpowers/specs/2026-09-17-istek-sirasi-sinirlari-design.md](../specs/2026-09-17-istek-sirasi-sinirlari-design.md)

## Global Constraints

- İstek kuralları ve sabitler değişmez: aynı anda tek sayfa isteği; istek başlangıçları arasında en az `PAGE_MIN_GAP_MS` = 1500 ms; 429/5xx/ağ hatasında `PAGE_RETRY_DELAY_MS` = 5000 ms sonra bir tekrar. `src/core/constants.js`'e dokunulmaz.
- `src/core/page-source.js`'te yalnızca `createPageQueue`'nun `now` varsayılanı ve JSDoc'u değişir. `run`, `pace`, `createPageSource`, `src/content/main.js`, `src/core/story-feed.js`, `src/viewer/*` ve `dev/playground.js` değişmez.
- Sekmeler arası kilit (`navigator.locks`), `sessionStorage` ve `focusto` gezintisini geciktirme yazılmaz (spec §3, kullanıcı kararı 17.09.2026).
- Kapatma kuralı aynı kalır: kapatmak hiçbir beklemeyi kısaltmaz, uçuştaki istek kesilmez.
- Kullanıcıya görünen metinler ekşi arayüz dilindedir: küçük harf, kısa, sade. README'de yalnızca "kurallar" bölümündeki "siteyi yormaz" maddesi değişir. PRIVACY, `store/` yazıları ve CHANGELOG değişmez.
- Eski spec'lerin gövdesi değişmez; yalnızca başlarına `Not:` satırı eklenir.
- Kod yorumları ve test adları Türkçedir. Test adları küçük harfle başlar; yorumlar dosyadaki mevcut yorumların üslubunu (cümle başı büyük harf) ve yoğunluğunu izler.
- Commit mesajları şu satırla biter: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Kullanıcıya sormadan push yapılmaz.

## Dosya haritası

| dosya | değişiklik | görev |
|---|---|---|
| `test/page-source.test.js` | saat geri alınınca bekleme testi | 1 |
| `src/core/page-source.js` | `createPageQueue` varsayılan saati ve JSDoc | 1 |
| `README.md` | "siteyi yormaz" maddesine "her sekmede" | 2 |
| `docs/superpowers/specs/2026-09-14-eksi-stories-design.md`, `docs/superpowers/specs/2026-09-17-ortak-istek-sirasi-design.md` | `Not:` satırları | 2 |

Test sayısı: başlangıçta 87, Görev 1 sonunda 88, Görev 2 sonunda 88.

> Plan kodu `90c66d9` üzerinde, temiz kopyada baştan sona denendi. Kırmızı ve yeşil çıktılar, test sayıları ve belge değişikliklerinin tek yerde eşleştiği gözlendi. Yeni test art arda 10 çalıştırmada geçti; `pace` hiç beklemeyecek biçimde bozulunca da düştü.

---

### Task 1: Sıra saatini monoton yap

**Files:**
- Modify: `test/page-source.test.js` (dosya sonu)
- Modify: `src/core/page-source.js:23-28` (`createPageQueue` JSDoc'u ve imzası)

**Interfaces:**
- Consumes: yok
- Produces: `createPageQueue({ minGapMs = PAGE_MIN_GAP_MS, now = () => performance.now(), sleep = defaultSleep } = {})` → `{ run(job: () => Promise<T>, signal: AbortSignal): Promise<T>, pace(signal: AbortSignal): Promise<void> }`. Dönen nesne ve davranışı aynıdır; yalnızca `now` verilmediğinde kullanılan saat değişir.

- [ ] **Step 1: Başarısız testi yaz**

`test/page-source.test.js` dosyasının sonuna, son testten (`kapatıldıktan sonra next ve load istek atmadan reddedilir`) sonra bir boş satır bırakıp ekle:

```js
test("sistem saati geri alınsa da aralık beklemesi 1500 ms'yi geçmez", async (t) => {
  const sleeps = [];
  const queue = createPageQueue({
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
  const { signal } = new AbortController();
  const realNow = Date.now;
  await queue.run(() => queue.pace(signal), signal);
  t.mock.method(Date, 'now', () => realNow() - 60 * 60 * 1000); // saat bir saat geri alınır
  await queue.run(() => queue.pace(signal), signal);
  assert.equal(sleeps.length, 1);
  assert.ok(sleeps[0] > 0 && sleeps[0] <= 1500, `bekleme ${sleeps[0]} ms`);
});
```

Notlar:
- `now` bilerek verilmez: test varsayılan saati sınar. `sleep` sahtedir, gerçekten beklemez.
- `pace`, sözleşmesine uygun olarak `run` işinin içinden çağrılır.
- `t.mock.method` mock'u test bitince kendiliğinden geri alır; elle geri almaya gerek yoktur.
- `createPageQueue` dosyanın import satırında zaten var; import değişmez.

- [ ] **Step 2: Testin başarısız olduğunu gör**

Run: `node --test test/page-source.test.js`
Expected: FAIL: `ℹ tests 24`, `ℹ pass 23`, `ℹ fail 1`. Hata: `AssertionError [ERR_ASSERTION]: bekleme 3601500 ms` (sayı 1-2 ms farklı olabilir).

- [ ] **Step 3: Varsayılan saati değiştir**

`src/core/page-source.js` içinde:

```js
/**
 * Sekmedeki bütün sayfa isteklerinin ortak sırası: aynı anda tek iş, istek başlangıçları arasında en az `minGapMs`.
 * Story ekranı kapatılıp açılınca da kurallar sürsün diye sekme başına bir kez kurulur.
 * @returns {{ run: (job: () => Promise<any>, signal: AbortSignal) => Promise<any>, pace: (signal: AbortSignal) => Promise<void> }}
 */
export function createPageQueue({ minGapMs = PAGE_MIN_GAP_MS, now = () => Date.now(), sleep = defaultSleep } = {}) {
```

→

```js
/**
 * Sekmedeki bütün sayfa isteklerinin ortak sırası: aynı anda tek iş, istek başlangıçları arasında en az `minGapMs`.
 * Story ekranı kapatılıp açılınca da kurallar sürsün diye sekme başına bir kez kurulur.
 * Varsayılan saat monotondur: sistem saati geri alınsa da bekleme `minGapMs`'yi geçmez.
 * @returns {{ run: (job: () => Promise<any>, signal: AbortSignal) => Promise<any>, pace: (signal: AbortSignal) => Promise<void> }}
 */
export function createPageQueue({ minGapMs = PAGE_MIN_GAP_MS, now = () => performance.now(), sleep = defaultSleep } = {}) {
```

Dosyada başka hiçbir şeyi değiştirme.

- [ ] **Step 4: Testleri çalıştır**

Run: `node --test test/page-source.test.js`
Expected: PASS: `ℹ tests 24`, `ℹ pass 24`, `ℹ fail 0`

Run: `npm test`
Expected: PASS: `ℹ tests 88`, `ℹ pass 88`, `ℹ fail 0`

- [ ] **Step 5: Commit**

```bash
git add test/page-source.test.js src/core/page-source.js
git commit -m "$(cat <<'EOF'
fix: sayfa aralığını monoton saatle ölç

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: "siteyi yormaz" sözünü sekme başına netleştir

**Files:**
- Modify: `README.md:43`
- Modify: `docs/superpowers/specs/2026-09-14-eksi-stories-design.md:6` (altına satır)
- Modify: `docs/superpowers/specs/2026-09-17-ortak-istek-sirasi-design.md:4` (altına satır)

**Interfaces:**
- Consumes: Görev 1'deki varsayılan saat (`performance.now()`); ortak sıra spec'ine düşülen not bunu anar.
- Produces: yok

- [ ] **Step 1: README maddesini değiştir**

`README.md`, "kurallar" bölümünde:

```markdown
- siteyi yormaz: sayfa istekleri arasında en az 1,5 saniye bekler, aynı anda tek sayfa ister, görsel sayfalarını en fazla ikişer açar, 5 görselsiz sayfadan sonra durur.
```

→

```markdown
- siteyi yormaz: her sekmede sayfa istekleri arasında en az 1,5 saniye bekler, aynı anda tek sayfa ister, görsel sayfalarını en fazla ikişer açar, 5 görselsiz sayfadan sonra durur.
```

README'de başka satıra dokunma; "elle test" listesi aynı kalır.

- [ ] **Step 2: Eski spec'lere not ekle**

`docs/superpowers/specs/2026-09-14-eksi-stories-design.md` içinde şu satırın:

```markdown
Not: §4 `createPageSource` imzası 2026-09-17-ortak-istek-sirasi-design.md ile güncellendi: sayfa istekleri sekme başına ortak sırada, sayfa kaynağında `dispose()` var.
```

hemen altına ekle:

```markdown
Not: §2.2 istek disiplini sekme başına geçerlidir; bkz. 2026-09-17-istek-sirasi-sinirlari-design.md.
```

`docs/superpowers/specs/2026-09-17-ortak-istek-sirasi-design.md` içinde şu satırın:

```markdown
Durum: Onaylandı (brainstorming sonucu).
```

hemen altına ekle:

```markdown
Not: §3 `createPageQueue`'nun varsayılan saati 2026-09-17-istek-sirasi-sinirlari-design.md ile `performance.now()` oldu; sekmeler arası sıra ve kapatınca yapılan `focusto` gezintisi aynı belgede gerekçesiyle kapsam dışı bırakıldı.
```

İki spec'in gövdesine dokunma. PRIVACY, `store/` ve CHANGELOG değişmez.

- [ ] **Step 3: Değişiklikleri doğrula**

Run: `grep -n "her sekmede" README.md`
Expected: tek satır, `43:- siteyi yormaz: her sekmede sayfa istekleri arasında en az 1,5 saniye bekler, …` ile başlar.

Run: `grep -c "istek-sirasi-sinirlari-design.md" docs/superpowers/specs/2026-09-14-eksi-stories-design.md docs/superpowers/specs/2026-09-17-ortak-istek-sirasi-design.md`
Expected: iki dosya için de `:1`

Run: `git diff --stat`
Expected: yalnızca `README.md` ve iki spec; özet satırı `3 files changed, 3 insertions(+), 1 deletion(-)`

Run: `npm test`
Expected: PASS: `ℹ tests 88`, `ℹ pass 88`, `ℹ fail 0`

- [ ] **Step 4: Commit**

```bash
git add README.md docs/superpowers/specs/2026-09-14-eksi-stories-design.md docs/superpowers/specs/2026-09-17-ortak-istek-sirasi-design.md
git commit -m "$(cat <<'EOF'
docs: siteyi yormaz sözünü sekme başına netleştir

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Teslim (görevlerden sonra; alt ajana verilmez)

Kullanıcıya soruları AskUserQuestion ile sor.

1. Dalın kapsamını doğrula. Run: `git diff --stat main...HEAD`. Expected: yalnızca şu 7 dosya: `README.md`, `docs/superpowers/plans/2026-09-17-istek-sirasi-sinirlari.md`, `docs/superpowers/specs/2026-09-14-eksi-stories-design.md`, `docs/superpowers/specs/2026-09-17-istek-sirasi-sinirlari-design.md`, `docs/superpowers/specs/2026-09-17-ortak-istek-sirasi-design.md`, `src/core/page-source.js`, `test/page-source.test.js`.
2. Bütün dalın son incelemesi (superpowers:requesting-code-review), bulgular için düzeltme turu.
3. Canlı Chrome kontrolü gerekmez (spec §8.4): normal koşullarda davranış değişmez.
4. Birleştirme ve push kararı kullanıcıdadır (superpowers:finishing-a-development-branch). `1da68f9` 17.09.2026 08:36'da push edildi; bu dalın commit'leri yereldir. Push yalnızca açık onayla yapılır.
