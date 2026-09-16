import { createStoryFeed } from '../src/core/story-feed.js';
import { openViewer } from '../src/viewer/viewer.js';

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

function svgImage({ label, w, h }, hue) {
  const fontSize = Math.round(Math.min(w, h) / 10);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="hsl(${hue} 70% 55%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360} 70% 30%)"/>
</linearGradient></defs>
<rect width="100%" height="100%" fill="url(#g)"/>
<rect x="6" y="6" width="${w - 12}" height="${h - 12}" fill="none" stroke="#fff" stroke-width="6"/>
<text x="50%" y="50%" fill="#fff" font-family="system-ui, sans-serif" font-size="${fontSize}" text-anchor="middle" dominant-baseline="middle">${label}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

let entrySeq = 1;
function makeEntry(imageUrls, text = '') {
  const id = String(entrySeq++);
  return {
    id,
    author: `deneme yazar ${id}`,
    authorUrl: `https://eksisozluk.com/biri/deneme-yazar-${id}`,
    date: '14.09.2026 13:28',
    permalink: `https://eksisozluk.com/entry/${id}`,
    text,
    images: imageUrls.map((url) => ({ kind: 'direct', url, sourceHref: url })),
  };
}

function fakePageSource(pages, delayMs = 300) {
  const queue = [...pages];
  const count = pages.filter((page) => !(page instanceof Error)).length + 1;
  let last = 1;
  return {
    count,
    hasNext: () => last < count,
    async next() {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      const item = queue.shift();
      if (item instanceof Error) throw item;
      last += 1;
      return { page: last, count, entries: item };
    },
  };
}

const resolver = { resolve: (ref) => Promise.resolve(ref.url) };

const SCENARIOS = [
  ['en-boy oranları', () => ({
    entries: SHAPES.map((shape, i) => makeEntry([svgImage(shape, i * 55)], shape.caption)),
    pages: [],
  })],
  ['çoklu görsel + bozuk görsel', () => ({
    entries: [
      makeEntry([svgImage(SHAPES[0], 10), BROKEN_IMAGE, svgImage(SHAPES[2], 200)], 'bayram sabahından üç kare.'),
      makeEntry([svgImage(SHAPES[1], 120)], 'tek kare.'),
    ],
    pages: [],
  })],
  ['sayfalama (yavaş)', () => ({
    entries: [makeEntry([svgImage(SHAPES[0], 0)], 'sayfa 1')],
    pages: [[makeEntry([svgImage(SHAPES[1], 90)], 'sayfa 2')], [makeEntry([svgImage(SHAPES[2], 180)], 'sayfa 3')]],
    delayMs: 1500,
  })],
  ['boş sayfalar → aramaya devam', () => ({
    entries: [makeEntry([svgImage(SHAPES[2], 30)], 'sonrasında 5 görselsiz sayfa var')],
    pages: [...Array.from({ length: 5 }, () => [makeEntry([])]), [makeEntry([svgImage(SHAPES[0], 300)], 'aramaya devam edince bulundu')]],
  })],
  ['sayfa hatası → tekrar dene', () => ({
    entries: [makeEntry([svgImage(SHAPES[1], 60)], 'sonraki sayfa bir kez hata verecek')],
    pages: [new Error('ağ hatası'), [makeEntry([svgImage(SHAPES[3], 240)], 'tekrar deneyince geldi')]],
  })],
];

const cssText = await fetch(new URL('../src/viewer/viewer.css', import.meta.url)).then((response) => response.text());
const container = document.querySelector('#scenarios');

SCENARIOS.forEach(([name, build], index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = `${index}: ${name}`;
  button.addEventListener('click', () => {
    const scenario = build();
    const pageSource = fakePageSource(scenario.pages, scenario.delayMs);
    const feed = createStoryFeed({ entries: scenario.entries, page: 1, pageCount: pageSource.count, pageSource, resolver });
    openViewer({
      feed,
      topic: { title: `playground: ${name}` },
      cssText,
      onClose: () => {
        feed.dispose();
        button.focus();
      },
    });
    feed.start();
  });
  container.append(button);
});

const auto = new URLSearchParams(location.search).get('scenario');
if (auto !== null) container.children[Number(auto)]?.click();
