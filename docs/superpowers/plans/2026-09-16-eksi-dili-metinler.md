# ekşi dili metinler: uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Projedeki kullanıcıya görünen bütün metinleri onaylı spec'e göre ekşi arayüz dilinde, küçük harfli ve sade hale getirmek.

**Architecture:** Arayüz metinleri kodda bugünkü yerlerinde değiştirilir. README, PRIVACY, CHANGELOG ve Store yazıları spec dosyasındaki tam metin bloklarından küçük bir betikle birebir kopyalanır, böylece elle yazım hatası olmaz. Metin değişince Store ekran görüntüleri ve tanıtım görseli yeniden üretilir.

**Tech Stack:** Vanilla JS (MV3 Chrome eklentisi), Node.js 26 `node:test`, jsdom, Playwright MCP araçları (görsel çekimi için).

**Spec:** [docs/superpowers/specs/2026-09-16-eksi-dili-metinler-design.md](../specs/2026-09-16-eksi-dili-metinler-design.md)

## Global Constraints

- Metinlerin tek kaynağı spec dosyasıdır. Spec'te tam metin olarak verilen bloklar (README, PRIVACY, CHANGELOG, `store/listing-tr.md`) harfi harfine kullanılır; yeniden yazılmaz, düzeltilmez.
- Her yer küçük harf: marka, ürün adı ve kısaltmalar dahil (ekşi sözlük, ekşi teknoloji, chrome, github, mit, usd). Kod, komut, dosya adı, adres ve markdown link hedefleri bu kuralın dışındadır (`PRIVACY.md`, `LICENSE`, `localStorage`).
- Kısa, düz cümle; espri, emoji, ünlem yok. Arayüz glifleri (✕, ❚❚, ·, →, ←) kalır. Hitap "sen". "buton" kelimesi kullanılır.
- Eklenti adı: `stories for ekşi sözlük`. Eklenti açıklaması: `ekşi sözlük başlıklarındaki görselleri story gibi izle.` Bu açıklamada "resmi değil" ibaresi yoktur (kullanıcı kararı).
- Metinler koddaki mevcut yerlerinde değişir; yeni metin modülü ya da `_locales` eklenmez.
- Kapsam dışı: `docs/superpowers/` altındaki diğer belgeler, kod yorumları, test adları, `src/core/` iç hata mesajları, `scripts/` araç çıktıları, playground senaryo adları ve ipucu yazıları (spec bölüm 7'de adı geçen iki yazı hariç), görsellerin içine çizilen şekil etiketleri.
- Tüm commit mesajları şu satırla biter: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

## Dosya haritası

| dosya | değişiklik | görev |
|---|---|---|
| `manifest.json`, `package.json` | ad ve açıklama | 1 |
| `test/manifest.test.js` | ad ve açıklama beklentisi | 1 |
| `src/content/main.js`, `src/content/loader.js`, `src/viewer/viewer.js` | arayüz ve konsol metinleri | 1 |
| `README.md`, `PRIVACY.md`, `CHANGELOG.md` | tam metin yenileme | 2 |
| `store/listing-tr.md` | tam metin yenileme | 3 |
| `store/promo-tile.html`, `store/promo-small-440x280.png` | tanıtım görseli yazıları ve yeniden üretim | 3 |
| `dev/playground.html`, `dev/playground.js` | açıklama paragrafı ve örnek entry yazıları | 3 |
| `store/screenshots/*.png` | yeniden çekim | 3 |
| GitHub repo açıklaması | `gh repo edit` | 4 |

## Spec bloğu çıkarma yardımcısı

Görev 2 ve 3 bu yardımcıyı kullanır. Betik repoya eklenmez; geçici klasöre yazılır. Spec'te verilen bir başlığın altındaki ilk ```` ````markdown ```` bloğunu (açılış ve kapanış çizgileri hariç) hedef dosyaya yazar.

```bash
EXTRACT="${TMPDIR:-/tmp}/extract-spec-block.mjs"
cat > "$EXTRACT" <<'EOF'
import { readFileSync, writeFileSync } from 'node:fs';

const SPEC = 'docs/superpowers/specs/2026-09-16-eksi-dili-metinler-design.md';
const [heading, target] = process.argv.slice(2);
const lines = readFileSync(SPEC, 'utf8').split('\n');
const start = lines.indexOf(heading);
if (start < 0) throw new Error(`spec başlığı yok: ${heading}`);
const open = lines.findIndex((line, i) => i > start && line === '````markdown');
const close = lines.findIndex((line, i) => i > open && line === '````');
if (open < 0 || close < 0) throw new Error(`metin bloğu yok: ${heading}`);
writeFileSync(target, `${lines.slice(open + 1, close).join('\n')}\n`);
console.log(`yazıldı: ${target} (${close - open - 1} satır)`);
EOF
```

---

### Task 1: Eklenti kimliği ve arayüz metinleri

**Files:**
- Modify: `test/manifest.test.js:23-26`
- Modify: `manifest.json:3,5`
- Modify: `package.json:4`
- Modify: `src/content/main.js:18,55,88,89`
- Modify: `src/content/loader.js:7`
- Modify: `src/viewer/viewer.js:34,58,173,175,176,178,181,183,185,299`

**Interfaces:**
- Consumes: yok
- Produces: yeni arayüz metinleri. Görev 3'teki ekran görüntüleri bu metinleri gösterir; Görev 2'deki README elle test listesi `başlıkta başka görsel yok` metnine atıf yapar.

- [ ] **Step 1: Manifest testini yeni ad ve açıklamaya göre güncelle (başarısız test)**

`test/manifest.test.js` içinde:

```js
  assert.equal(manifest.name, 'Stories for Ekşi Sözlük');
```

satırını şununla değiştir:

```js
  assert.equal(manifest.name, 'stories for ekşi sözlük');
```

ve

```js
  assert.match(manifest.description, /resmi değildir/i);
```

satırını şununla değiştir:

```js
  assert.equal(manifest.description, 'ekşi sözlük başlıklarındaki görselleri story gibi izle.');
```

- [ ] **Step 2: Testin başarısız olduğunu gör**

Run: `node --test test/manifest.test.js`
Expected: FAIL, `manifest v3, ad ve açıklama kuralları` testinde `'Stories for Ekşi Sözlük' !== 'stories for ekşi sözlük'`

- [ ] **Step 3: manifest.json ve package.json'u güncelle**

`manifest.json`:

```json
  "name": "Stories for Ekşi Sözlük",
```

→

```json
  "name": "stories for ekşi sözlük",
```

```json
  "description": "Ekşi Sözlük başlıklarındaki görselleri story olarak izleyin. Resmi değildir; Ekşi Teknoloji ile bağı yoktur.",
```

→

```json
  "description": "ekşi sözlük başlıklarındaki görselleri story gibi izle.",
```

`package.json`:

```json
  "description": "Stories for Ekşi Sözlük: Chrome eklentisi (resmi değildir)",
```

→

```json
  "description": "ekşi sözlük başlıklarındaki görselleri story gibi izle.",
```

- [ ] **Step 4: Manifest testinin geçtiğini gör**

Run: `node --test test/manifest.test.js`
Expected: `# pass 5`, `# fail 0`

- [ ] **Step 5: Buton ve konsol metinlerini güncelle**

`src/content/main.js` içinde dört satır:

```js
      console.warn('[eksi-stories] başlık sayfası yapısı tanınmadı; buton eklenmedi.');
```

→

```js
      console.warn('[eksi-stories] başlık sayfası tanınmadı, buton eklenmedi.');
```

```js
      console.warn('[eksi-stories] görüntüleyici açılamadı:', error);
```

→

```js
      console.warn('[eksi-stories] story açılmadı:', error);
```

```js
  button.title = 'bu sayfadan itibaren görselleri story olarak izle';
  button.setAttribute('aria-label', `story olarak izle, bu sayfada ${count} görsel`);
```

→

```js
  button.title = 'görselleri story gibi izle';
  button.setAttribute('aria-label', `story gibi izle, bu sayfada ${count} görsel`);
```

`src/content/loader.js`:

```js
    console.warn('[eksi-stories] başlatılamadı:', error);
```

→

```js
    console.warn('[eksi-stories] başlamadı:', error);
```

- [ ] **Step 6: Story ekranı metinlerini güncelle**

`src/viewer/viewer.js` içinde:

```js
  const pausedBadge = el('span', { class: 'es-paused', title: 'duraklatıldı', text: '❚❚' });
```

→

```js
  const pausedBadge = el('span', { class: 'es-paused', title: 'durdu', text: '❚❚' });
```

```js
    'aria-label': `story görüntüleyici: ${topic.title}`,
```

→

```js
    'aria-label': `story: ${topic.title}`,
```

`renderCard` içindeki metin bloğu:

```js
    if (state.loading) {
      text = 'sonraki sayfa aranıyor…';
    } else if (state.blocked) {
      text = `sonraki ${EMPTY_PAGE_LIMIT} sayfada görsel yok`;
      actions.push(actionButton('devam ara', () => feed.continueSearching()));
    } else if (state.errorKind === 'fetch') {
      text = 'sonraki sayfa alınamadı';
      actions.push(actionButton('tekrar dene', () => feed.retry()));
    } else if (state.errorKind === 'structure') {
      text = 'devam edilemedi';
    } else if (state.length === 0) {
      text = 'görsel bulunamadı';
    } else {
      text = 'başlığın sonuna geldin';
      actions.push(actionButton('başa dön', () => feed.goTo(0)));
    }
```

→

```js
    if (state.loading) {
      text = 'sonraki sayfa yükleniyor…';
    } else if (state.blocked) {
      text = `${EMPTY_PAGE_LIMIT} sayfadır görsel yok`;
      actions.push(actionButton('aramaya devam', () => feed.continueSearching()));
    } else if (state.errorKind === 'fetch') {
      text = 'sayfa gelmedi';
      actions.push(actionButton('tekrar dene', () => feed.retry()));
    } else if (state.errorKind === 'structure') {
      text = 'sayfa okunamadı';
    } else if (state.length === 0) {
      text = 'görsel yok';
    } else {
      text = 'başlıkta başka görsel yok';
      actions.push(actionButton('başa dön', () => feed.goTo(0)));
    }
```

```js
  const offSkipped = feed.on('skipped', () => showToast('görsel yüklenemedi, atlandı'));
```

→

```js
  const offSkipped = feed.on('skipped', () => showToast('görsel açılmadı, geçildi'));
```

- [ ] **Step 7: Testleri ve eski metin taramasını çalıştır**

Run: `npm test`
Expected: `# fail 0`

Run:

```bash
grep -rn -E "Stories for Ekşi Sözlük|story olarak izle|yüklenemedi, atlandı|devam ara|bulunamadı|başlığın sonuna geldin|duraklatıldı|görüntüleyici:|aranıyor|alınamadı|edilemedi|başlatılamadı|Instagram|Resmi değildir" src/content src/viewer manifest.json package.json || echo "eski metin yok"
```

Expected: `eski metin yok`

- [ ] **Step 8: Commit**

```bash
git add test/manifest.test.js manifest.json package.json src/content/main.js src/content/loader.js src/viewer/viewer.js
git commit -m "feat: eklenti adı, açıklaması ve arayüz metinlerini ekşi diline çevir

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: README, gizlilik politikası ve değişiklik günlüğü

**Files:**
- Modify: `README.md` (tamamen değişir)
- Modify: `PRIVACY.md` (tamamen değişir)
- Modify: `CHANGELOG.md` (tamamen değişir)

**Interfaces:**
- Consumes: spec bölüm 8, 9 ve 10'daki tam metin blokları; Görev 1'in `başlıkta başka görsel yok` metni (README elle test listesinde geçer)
- Produces: yeni belge metinleri. `PRIVACY.md` Store gizlilik politikası adresi olarak kullanılmaya devam eder.

- [ ] **Step 1: Spec bloğu çıkarma yardımcısını oluştur**

```bash
EXTRACT="${TMPDIR:-/tmp}/extract-spec-block.mjs"
cat > "$EXTRACT" <<'EOF'
import { readFileSync, writeFileSync } from 'node:fs';

const SPEC = 'docs/superpowers/specs/2026-09-16-eksi-dili-metinler-design.md';
const [heading, target] = process.argv.slice(2);
const lines = readFileSync(SPEC, 'utf8').split('\n');
const start = lines.indexOf(heading);
if (start < 0) throw new Error(`spec başlığı yok: ${heading}`);
const open = lines.findIndex((line, i) => i > start && line === '````markdown');
const close = lines.findIndex((line, i) => i > open && line === '````');
if (open < 0 || close < 0) throw new Error(`metin bloğu yok: ${heading}`);
writeFileSync(target, `${lines.slice(open + 1, close).join('\n')}\n`);
console.log(`yazıldı: ${target} (${close - open - 1} satır)`);
EOF
```

- [ ] **Step 2: Üç belgeyi spec'teki bloklardan yaz**

```bash
EXTRACT="${TMPDIR:-/tmp}/extract-spec-block.mjs"
node "$EXTRACT" '## 8. `README.md` (tam metin)' README.md
node "$EXTRACT" '## 9. `PRIVACY.md` (tam metin)' PRIVACY.md
node "$EXTRACT" '## 10. `CHANGELOG.md` (tam metin)' CHANGELOG.md
```

Expected: `yazıldı: README.md (87 satır)`, `yazıldı: PRIVACY.md (29 satır)`, `yazıldı: CHANGELOG.md (5 satır)`

- [ ] **Step 3: Büyük harf taramasını çalıştır**

Run: `grep -n '[A-ZÇĞİÖŞÜ]' README.md PRIVACY.md CHANGELOG.md`
Expected: tam olarak şu üç satır (yalnızca link hedefleri ve kod):

```
README.md:<satır>:veri toplamaz, saklamaz, göndermez. ayrıntı: [privacy.md](PRIVACY.md)
README.md:<satır>:mit, bkz: [license](LICENSE)
PRIVACY.md:<satır>:- çerez, `localStorage` ya da eklenti depolaması kullanmaz.
```

- [ ] **Step 4: Eski metin taramasını çalıştır**

```bash
grep -n -E "Stories for Ekşi Sözlük|Resmi değildir|Gizlilik Politikası|Değişiklik Günlüğü|başlığın sonuna geldin|devam ara|Instagram|izlemenizi" README.md PRIVACY.md CHANGELOG.md || echo "eski metin yok"
```

Expected: `eski metin yok`

- [ ] **Step 5: Linklerin hedeflerini doğrula**

Run: `ls PRIVACY.md LICENSE`
Expected: iki dosya da listelenir (README'deki `PRIVACY.md` ve `LICENSE` link hedefleri geçerli).

- [ ] **Step 6: Commit**

```bash
git add README.md PRIVACY.md CHANGELOG.md
git commit -m "docs: readme, gizlilik ve değişiklik günlüğünü ekşi diline çevir

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Store yazıları, tanıtım görseli, playground örnekleri ve ekran görüntüleri

**Files:**
- Modify: `store/listing-tr.md` (tamamen değişir)
- Modify: `store/promo-tile.html:35-37`
- Modify: `store/promo-small-440x280.png` (yeniden üretilir)
- Modify: `dev/playground.html:13`
- Modify: `dev/playground.js:4-13` ve senaryo tanımları
- Modify: `store/screenshots/01-dikey.png`, `02-panorama.png`, `03-coklu-gorsel.png` (yeniden çekilir)

**Interfaces:**
- Consumes: spec bölüm 5 (Store tam metni), 6 (tanıtım görseli), 7 (playground ve ekran görüntüleri); Görev 1'in arayüz metinleri (ekran görüntülerinde görünür)
- Produces: Store'a yüklenecek güncel yazılar ve görseller

- [ ] **Step 1: Store yazılarını spec'teki bloktan yaz**

```bash
EXTRACT="${TMPDIR:-/tmp}/extract-spec-block.mjs"
cat > "$EXTRACT" <<'EOF'
import { readFileSync, writeFileSync } from 'node:fs';

const SPEC = 'docs/superpowers/specs/2026-09-16-eksi-dili-metinler-design.md';
const [heading, target] = process.argv.slice(2);
const lines = readFileSync(SPEC, 'utf8').split('\n');
const start = lines.indexOf(heading);
if (start < 0) throw new Error(`spec başlığı yok: ${heading}`);
const open = lines.findIndex((line, i) => i > start && line === '````markdown');
const close = lines.findIndex((line, i) => i > open && line === '````');
if (open < 0 || close < 0) throw new Error(`metin bloğu yok: ${heading}`);
writeFileSync(target, `${lines.slice(open + 1, close).join('\n')}\n`);
console.log(`yazıldı: ${target} (${close - open - 1} satır)`);
EOF
node "$EXTRACT" '## 5. `store/listing-tr.md` (tam metin)' store/listing-tr.md
```

Expected: `yazıldı: store/listing-tr.md (73 satır)`

- [ ] **Step 2: Tanıtım görseli yazılarını güncelle**

`store/promo-tile.html` içinde:

```html
      <h1>Stories for Ekşi Sözlük</h1>
      <p>başlıklardaki görselleri tam ekran, story olarak izle</p>
      <small>resmi değildir · açık kaynak</small>
```

→

```html
      <h1>stories for ekşi sözlük</h1>
      <p>başlıklardaki görselleri story gibi izle</p>
      <small>resmi değil · açık kaynak</small>
```

- [ ] **Step 3: Playground açıklama paragrafını güncelle**

`dev/playground.html` içinde:

```html
  <p>Görüntüleyiciyi gerçek <code>story-feed</code> ile, sahte sayfa kaynağı ve üretilmiş görsellerle açar. Ekşi Sözlük'e hiçbir istek atılmaz. <code>?scenario=N</code> ile N. senaryo otomatik açılır.</p>
```

→

```html
  <p>story ekranını gerçek <code>story-feed</code> ile, sahte sayfalar ve üretilmiş görsellerle açar. ekşi'ye hiç istek gitmez. <code>?scenario=n</code> ile n. senaryo kendiliğinden açılır.</p>
```

- [ ] **Step 4: Playground örnek entry yazılarını güncelle**

`dev/playground.js` başındaki blok:

```js
const SHAPES = [
  { label: 'dikey 9:16', w: 1080, h: 1920 },
  { label: 'yatay 16:9', w: 1920, h: 1080 },
  { label: 'kare', w: 1200, h: 1200 },
  { label: 'panorama 4:1', w: 3200, h: 800 },
  { label: 'uzun ekran görüntüsü 1:4', w: 800, h: 3200 },
  { label: 'küçük 320×240', w: 320, h: 240 },
];
const BROKEN_IMAGE = 'data:image/png;base64,AAAA';
const LONG_TEXT = 'bu uzun bir entry metnidir, caption üç satırda kırpılmalı ve tıklayınca açılmalıdır. '.repeat(12);
```

→

```js
const LONG_TEXT = 'sabah vapurundan. martılar simit peşinde, deniz dümdüz, karşı yaka sisin arkasında kaybolmuş. kimse telefonuna bakmıyor, herkes aynı yere bakıyor. iskeleye yanaşana kadar kimse yerinden kalkmadı, ben de kalkmadım. fotoğraf biraz eğri çıktı, olsun.';
const SHAPES = [
  { label: 'dikey 9:16', w: 1080, h: 1920, caption: LONG_TEXT },
  { label: 'yatay 16:9', w: 1920, h: 1080, caption: 'işten çıkınca iskele.' },
  { label: 'kare', w: 1200, h: 1200, caption: 'balkondaki sardunyalar.' },
  { label: 'panorama 4:1', w: 3200, h: 800, caption: 'tepeden bütün şehir, sis daha kalkmamış.' },
  { label: 'uzun ekran görüntüsü 1:4', w: 800, h: 3200, caption: 'uzun bir ekran görüntüsü.' },
  { label: 'küçük 320×240', w: 320, h: 240, caption: 'eski telefondan kalma bir fotoğraf.' },
];
const BROKEN_IMAGE = 'data:image/png;base64,AAAA';
```

"en-boy oranları" senaryosundaki satır:

```js
    entries: SHAPES.map((shape, i) => makeEntry([svgImage(shape, i * 55)], i === 0 ? LONG_TEXT : shape.label)),
```

→

```js
    entries: SHAPES.map((shape, i) => makeEntry([svgImage(shape, i * 55)], shape.caption)),
```

"çoklu görsel + bozuk görsel" senaryosundaki iki satır:

```js
      makeEntry([svgImage(SHAPES[0], 10), BROKEN_IMAGE, svgImage(SHAPES[2], 200)], 'üç görselli entry, ortadaki bozuk'),
      makeEntry([svgImage(SHAPES[1], 120)], 'tek görselli entry'),
```

→

```js
      makeEntry([svgImage(SHAPES[0], 10), BROKEN_IMAGE, svgImage(SHAPES[2], 200)], 'bayram sabahından üç kare.'),
      makeEntry([svgImage(SHAPES[1], 120)], 'tek kare.'),
```

Boş sayfalar senaryosunun iki satırı:

```js
  ['boş sayfalar → devam ara', () => ({
```

→

```js
  ['boş sayfalar → aramaya devam', () => ({
```

```js
    pages: [...Array.from({ length: 5 }, () => [makeEntry([])]), [makeEntry([svgImage(SHAPES[0], 300)], 'devam aradıktan sonra bulundu')]],
```

→

```js
    pages: [...Array.from({ length: 5 }, () => [makeEntry([])]), [makeEntry([svgImage(SHAPES[0], 300)], 'aramaya devam edince bulundu')]],
```

- [ ] **Step 5: Eski metin taramasını ve testleri çalıştır**

```bash
grep -rn -E "Stories for Ekşi Sözlük|Resmi değildir|resmi değildir|story olarak izle|ortadaki bozuk|tek görselli entry|devam ara|bu uzun bir entry metnidir|Görüntüleyiciyi|Instagram|Mağaza girişi" store dev || echo "eski metin yok"
```

Expected: `eski metin yok`

Run: `npm test`
Expected: `# fail 0`

- [ ] **Step 6: Tanıtım görselini ve ekran görüntülerini yeniden üret**

Sunucuyu arka planda başlat: `npm run serve` (http://127.0.0.1:5173).

Playwright MCP araçlarını tek seferde yükle: ToolSearch sorgusu `select:mcp__plugin_playwright_playwright__browser_navigate,mcp__plugin_playwright_playwright__browser_resize,mcp__plugin_playwright_playwright__browser_take_screenshot,mcp__plugin_playwright_playwright__browser_evaluate,mcp__plugin_playwright_playwright__browser_close`. Ekran görüntülerinde `scale: "css"` ve `type: "png"` kullan; `filename` repo köküne göre göreli yoldur.

Story'ler 5 saniyede bir kendiliğinden ilerlediği ve araç turları bu süreyi aşabildiği için her çekimden önce görüntüleyicinin ilerleme süresi yalnızca o sayfa için uzatılır. Bu, görünümü değiştirmez.

1. `browser_resize` 440×280 → `browser_navigate` `http://127.0.0.1:5173/store/promo-tile.html` → `browser_take_screenshot` `filename: "store/promo-small-440x280.png"`.
2. `browser_resize` 1280×800 → `browser_navigate` `http://127.0.0.1:5173/dev/playground.html?scenario=0` → `browser_evaluate` aşağıdaki fonksiyonla (hedef yazı: `LONG_TEXT`'in başı `sabah vapurundan.`) → `browser_take_screenshot` `filename: "store/screenshots/01-dikey.png"`.
3. `browser_navigate` `http://127.0.0.1:5173/dev/playground.html?scenario=0` → `browser_evaluate` (hedef yazı `tepeden bütün şehir, sis daha kalkmamış.`) → `browser_take_screenshot` `filename: "store/screenshots/02-panorama.png"`.
4. `browser_navigate` `http://127.0.0.1:5173/dev/playground.html?scenario=1` → `browser_evaluate` (hedef yazı `bayram sabahından üç kare.`) → `browser_take_screenshot` `filename: "store/screenshots/03-coklu-gorsel.png"`.

`browser_evaluate` fonksiyonu; `TARGET` yerine o adımın hedef yazısını koy:

```js
async () => {
  const TARGET = 'tepeden bütün şehir, sis daha kalkmamış.';
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  for (let t = 0; t < 80 && !document.querySelector('eksi-stories-viewer'); t += 1) await sleep(25);
  const root = document.querySelector('eksi-stories-viewer').shadowRoot;
  root.querySelector('.es-root').style.setProperty('--es-duration', '600000ms');
  const caption = () => root.querySelector('.es-caption').textContent;
  const key = (name) => window.dispatchEvent(new KeyboardEvent('keydown', { key: name }));
  // Araç turu 5 saniyeyi aşarsa hikâye hedefi geçmiş olabilir: önce başa sar, sonra ileri git.
  for (let t = 0; t < 20; t += 1) { key('ArrowLeft'); await sleep(40); }
  for (let t = 0; t < 40 && !caption().startsWith(TARGET); t += 1) { key('ArrowRight'); await sleep(80); }
  for (let t = 0; t < 80 && root.querySelector('.es-frame').classList.contains('is-loading'); t += 1) await sleep(25);
  return { caption: caption().slice(0, 40), paused: root.querySelector('.es-root').classList.contains('is-paused') };
}
```

Her `browser_evaluate` sonucunda `caption` hedef yazıyla başlamalı ve `paused` `false` olmalı.

Bitince `browser_close` çağır, sunucuyu PID ile durdur (`lsof -ti tcp:5173 -sTCP:LISTEN`, ardından `kill <pid>`) ve Playwright'ın ürettiği geçici klasörü sil: `rm -rf .playwright-mcp`.

- [ ] **Step 7: Görselleri doğrula**

```bash
for f in store/promo-small-440x280.png store/screenshots/*.png; do node -e "const b=require('node:fs').readFileSync(process.argv[1]); console.log(process.argv[1], b.readUInt32BE(16) + 'x' + b.readUInt32BE(20))" "$f"; done
```

Expected: `store/promo-small-440x280.png 440x280` ve üç ekran görüntüsü için `1280x800`.

Her görseli Read aracıyla aç ve kontrol et:
- Tanıtım görseli: "stories for ekşi sözlük", "başlıklardaki görselleri story gibi izle", "resmi değil · açık kaynak" yazıları taşmadan görünür.
- `01-dikey.png`: dikey görsel, alt yazı "sabah vapurundan." ile başlar ve üç satırda "…" ile kırpılır; ❚❚ yok.
- `02-panorama.png`: panorama, alt yazı "tepeden bütün şehir, sis daha kalkmamış."; üst ve alt katmanlar görselin kenarlarına oturur; ❚❚ yok.
- `03-coklu-gorsel.png`: üç parçalı ilerleme çubuğu, alt yazı "bayram sabahından üç kare."; ❚❚ yok.

- [ ] **Step 8: Commit**

```bash
git add store/listing-tr.md store/promo-tile.html store/promo-small-440x280.png store/screenshots dev/playground.html dev/playground.js
git commit -m "docs: store yazılarını, tanıtım görselini ve örnek entry'leri ekşi diline çevir

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Paket, canlı kontrol, push ve GitHub açıklaması

**Files:**
- Modify: yok (yalnızca doğrulama, yayın ve GitHub ayarı)

**Interfaces:**
- Consumes: Görev 1–3'ün commit'leri
- Produces: güncel `dist/eksi-stories-0.1.0.zip`, GitHub'da güncel `main` ve repo açıklaması

Bu görevde iki adım kullanıcı onayı ister: eklentiyi Chrome'da yenilemek ve GitHub'a push ile repo açıklamasını değiştirmek. Soruları AskUserQuestion ile sor.

- [ ] **Step 1: Tüm testleri ve son taramayı çalıştır**

Run: `npm test`
Expected: `# fail 0`

```bash
grep -rn -E "Stories for Ekşi Sözlük|story olarak izle|yüklenemedi, atlandı|devam ara|başlığın sonuna geldin|duraklatıldı|görüntüleyici:|aranıyor|alınamadı|edilemedi|başlatılamadı|Instagram" src/content src/viewer manifest.json package.json README.md PRIVACY.md CHANGELOG.md store dev || echo "eski metin yok"
```

Expected: `eski metin yok`

- [ ] **Step 2: Store paketini yeniden üret**

Run: `npm run package && unzip -p dist/eksi-stories-0.1.0.zip manifest.json | grep -E '"(name|description)"'`
Expected:

```
  "name": "stories for ekşi sözlük",
  "description": "ekşi sözlük başlıklarındaki görselleri story gibi izle.",
```

- [ ] **Step 3: Kullanıcının Chrome'unda canlı kontrol**

Kullanıcıdan `chrome://extensions` sayfasında eklenti kartındaki yenile simgesine basmasını iste ve yanıtını bekle. Kart adının "stories for ekşi sözlük", açıklamanın "ekşi sözlük başlıklarındaki görselleri story gibi izle." olduğunu kullanıcıya teyit ettir.

Sonra Claude in Chrome araçlarıyla (tek ToolSearch çağrısında `tabs_context_mcp`, `navigate`, `computer`, `javascript_tool`, `tabs_close_mcp`):
1. `https://eksisozluk.com/entry/91948327` aç.
2. `javascript_tool` ile buton `title` değerini oku. Beklenen: `görselleri story gibi izle`.
3. Butona tıkla, ekranın `aria-label` değerini oku (`document.querySelector('eksi-stories-viewer').shadowRoot.querySelector('.es-root').getAttribute('aria-label')`). Beklenen: `story: ` ile başlar.
4. `ArrowRight` bas, kart metnini ve butonlarını oku. Beklenen: `başlıkta başka görsel yok`, butonlar `başa dön` ve `kapat`.
5. `Escape` bas, sekmeyi kapat.

- [ ] **Step 4: Push ve GitHub repo açıklaması**

Kullanıcıdan push ve repo açıklaması değişikliği için onay al. Onaydan sonra:

```bash
git push origin main
gh repo edit onursenture/eksi-stories --description "ekşi sözlük başlıklarındaki görselleri story gibi izle."
gh repo view onursenture/eksi-stories --json description -q .description
```

Expected: push başarılı; son komut `ekşi sözlük başlıklarındaki görselleri story gibi izle.` yazar.

---

## Plan öz-değerlendirmesi

- **Spec kapsamı:** bölüm 1 kararlar → Global Constraints; bölüm 2 dil kuralları → Global Constraints ve Görev 2 büyük harf taraması; bölüm 3 eklenti kimliği → Görev 1 (manifest, package.json) ve Görev 4 (GitHub açıklaması); bölüm 4 arayüz metinleri ve testlere etkisi → Görev 1; bölüm 5 Store → Görev 3 adım 1; bölüm 6 tanıtım görseli → Görev 3 adım 2 ve 6; bölüm 7 playground ve ekran görüntüleri → Görev 3 adım 3, 4 ve 6; bölüm 8–10 belgeler → Görev 2; bölüm 11 doğrulama → Görev 1 adım 7, Görev 2 adım 3–5, Görev 3 adım 5–7, Görev 4.
- **Tutarlılık:** spec başlıkları çıkarma betiğindeki başlık metinleriyle birebir aynıdır (`## 5. `store/listing-tr.md` (tam metin)`, `## 8. `README.md` (tam metin)`, `## 9. `PRIVACY.md` (tam metin)`, `## 10. `CHANGELOG.md` (tam metin)`). Eski metin taramaları yeni metinlerde geçen "aramaya devam" gibi ifadeleri yakalamaz.
