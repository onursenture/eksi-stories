import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { main } from '../src/content/main.js';
import { createPageQueue } from '../src/core/page-source.js';
import { deferred, flush } from './helpers/async.js';
import { imagePageHtml, link, topicPageHtml } from './helpers/eksi-html.js';

const PAGE_URL = 'https://eksisozluk.com/deneme-basligi--1000001';
const CSS_URL = 'chrome-extension://test/src/viewer/viewer.css';

/** Sayfa başına dört görsel: açılışta ve sayfa atlamada önden sayfa istenmez. */
const pageEntries = (page) => [1, 2, 3, 4].map((n) => ({
  id: `${page}0${n}`,
  author: `sayfa ${page} yazarı`,
  content: link(`https://soz.lk/i/p${page}n${n}`),
}));

function setup(entries, { count = 1, pages = {}, url = PAGE_URL } = {}) {
  const dom = new JSDOM(topicPageHtml({ count, entries }), { url });
  const requests = [];
  const fetchImpl = async (url) => {
    requests.push(url);
    if (url === CSS_URL) return { ok: true, status: 200, text: async () => '.es-root { color: #fff; }' };
    if (url.startsWith('https://eksisozluk.com/img/')) {
      const id = url.split('/').pop();
      return { ok: true, status: 200, text: async () => imagePageHtml({ ogImage: `https://cdn.eksisozluk.com/${id}.jpg` }) };
    }
    const page = Number(new URL(url).searchParams.get('p'));
    if (url.startsWith(`${PAGE_URL}?`) && pages[page]) {
      return { ok: true, status: 200, text: async () => topicPageHtml({ current: page, count, entries: pages[page] }) };
    }
    return { ok: false, status: 404, text: async () => '' };
  };
  return { dom, doc: dom.window.document, requests, fetchImpl };
}

/** `from`–`to` sayfalarının istek adresleri. */
const pageUrls = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => `${PAGE_URL}?p=${from + i}`);

/** Sahte saatli sayfa isteği sırası: beklemeler hemen biter ve `clock.sleeps`'e yazılır. */
function fakeClockQueue() {
  const clock = { t: 0, sleeps: [] };
  const pageQueue = createPageQueue({
    now: () => clock.t,
    sleep: async (ms) => {
      clock.sleeps.push(ms);
      clock.t += ms;
    },
  });
  return { clock, pageQueue };
}

/** 30 sayfalık başlık, sayfa başına dört görsel. `/img/` istekleri 404 döner; kimliği `acilan` ile başlayan görseller açılır. `pages` sayfaları, 1. sayfa dahil, değiştirir. */
function brokenImagesSetup(pages = {}) {
  const allPages = Object.fromEntries(Array.from({ length: 29 }, (_, i) => [i + 2, pageEntries(i + 2)]));
  const tab = setup(pages[1] ?? pageEntries(1), { count: 30, pages: { ...allPages, ...pages } });
  const fetchImpl = async (url, init) => {
    if (url.startsWith('https://eksisozluk.com/img/') && !url.startsWith('https://eksisozluk.com/img/acilan')) {
      tab.requests.push(url);
      return { ok: false, status: 404, text: async () => '' };
    }
    return tab.fetchImpl(url, init);
  };
  return { ...tab, fetchImpl };
}

test('başlık sayfasına görsel sayısıyla tek buton eklenir', async () => {
  const { doc, fetchImpl, requests } = setup([
    { id: '101', content: `${link('https://soz.lk/i/aaa111', 'görsel')} ${link('/img/aaa111')}` },
    { id: '102', content: link('https://example.com/foto.png') },
    { id: '103', content: 'görselsiz' },
  ]);
  await main({ cssUrl: CSS_URL, doc, fetchImpl });
  await main({ cssUrl: CSS_URL, doc, fetchImpl });
  const buttons = doc.querySelectorAll('#title .eksi-stories-button');
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].textContent, 'story · 2');
  assert.deepEqual(requests, [], 'tıklanmadan istek atılmaz');
});

test('başlık sayfası değilse buton eklenmez ve istek atılmaz', async () => {
  const dom = new JSDOM('<html><body><h1>gündem</h1></body></html>', { url: 'https://eksisozluk.com/' });
  await main({
    cssUrl: CSS_URL,
    doc: dom.window.document,
    fetchImpl: async () => {
      throw new Error('istek atılmamalı');
    },
  });
  assert.equal(dom.window.document.querySelector('.eksi-stories-button'), null);
});

test('butona tıklayınca viewer açılır, ilk görsel çözülür, Esc ile kapanır', async () => {
  const { dom, doc, requests, fetchImpl } = setup([
    { id: '101', author: 'ilk yazar', content: `merhaba ${link('https://soz.lk/i/aaa111', 'görsel')}` },
  ]);
  await main({ cssUrl: CSS_URL, doc, fetchImpl });
  doc.querySelector('.eksi-stories-button').click();
  await flush();
  await flush();

  const host = doc.querySelector('eksi-stories-viewer');
  assert.ok(host, 'viewer host eklenmeli');
  const shadow = host.shadowRoot;
  assert.equal(shadow.querySelector('.es-root').getAttribute('role'), 'dialog');
  assert.equal(shadow.querySelector('.es-author-name').textContent, 'ilk yazar');
  assert.equal(shadow.querySelector('.es-avatar').getAttribute('src'), 'https://img.ekstat.com/profiles/deneme-1.jpg');
  assert.equal(shadow.querySelector('.es-permalink').getAttribute('href'), 'https://eksisozluk.com/entry/101');
  assert.equal(shadow.querySelector('.es-caption').textContent, 'merhaba');
  assert.equal(shadow.querySelector('.es-counter').textContent, '1/1');
  assert.equal(shadow.querySelector('.es-pager').hidden, true, 'tek sayfalı başlıkta sayfa kutusu yok');
  assert.equal(shadow.querySelector('.es-root').classList.contains('has-pager'), false);
  assert.ok(requests.includes('https://eksisozluk.com/img/aaa111'));
  assert.equal(shadow.querySelector('.es-image').getAttribute('src'), 'https://cdn.eksisozluk.com/aaa111.jpg');
  assert.equal(doc.documentElement.style.overflow, 'hidden');

  doc.querySelector('.eksi-stories-button').click();
  await flush();
  assert.equal(doc.querySelectorAll('eksi-stories-viewer').length, 1, 'açıkken ikinci viewer açılmaz');

  dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(doc.querySelector('eksi-stories-viewer'), null);
  assert.equal(doc.documentElement.style.overflow, '');
});

test('viewer yeniden açılınca aynı görsel sayfası tekrar istenmez', async () => {
  const { dom, doc, requests, fetchImpl } = setup([
    { id: '101', content: link('https://soz.lk/i/aaa111', 'görsel') },
  ]);
  await main({ cssUrl: CSS_URL, doc, fetchImpl });
  doc.querySelector('.eksi-stories-button').click();
  await flush();
  await flush();

  dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }));

  doc.querySelector('.eksi-stories-button').click();
  await flush();
  await flush();

  assert.equal(
    requests.filter((url) => url === 'https://eksisozluk.com/img/aaa111').length,
    1,
  );
  assert.ok(doc.querySelector('eksi-stories-viewer'), 'viewer yeniden açılmalı');
});

test('çok sayfalı başlıkta sayfa kutusu görünür, » sonraki sayfayı açar', async () => {
  const { doc, requests, fetchImpl } = setup(pageEntries(1), { count: 3, pages: { 2: pageEntries(2) } });
  await main({ cssUrl: CSS_URL, doc, fetchImpl });
  doc.querySelector('.eksi-stories-button').click();
  await flush();
  await flush();

  const shadow = doc.querySelector('eksi-stories-viewer').shadowRoot;
  const pageRequests = () => requests.filter((url) => url.startsWith(`${PAGE_URL}?`));
  assert.equal(shadow.querySelector('.es-pager').hidden, false);
  assert.equal(shadow.querySelector('.es-root').classList.contains('has-pager'), true);
  assert.deepEqual([...shadow.querySelectorAll('.es-pager-select option')].map((option) => option.textContent), ['1', '2', '3']);
  assert.equal(shadow.querySelector('.es-pager-select').value, '1');
  assert.equal(shadow.querySelector('.es-pager-last').textContent, '3');
  assert.equal(shadow.querySelector('.es-pager-prev').hidden, true);
  assert.equal(shadow.querySelector('.es-pager-next').hidden, false);
  assert.equal(shadow.querySelector('.es-counter').textContent, '1/4');
  assert.deepEqual(pageRequests(), [], 'açılışta sayfa istenmez');

  shadow.querySelector('.es-pager-next').click();
  assert.equal(shadow.querySelector('.es-card-text').textContent, 'sayfa yükleniyor…');
  for (let i = 0; i < 4; i += 1) await flush();

  assert.deepEqual(pageRequests(), [`${PAGE_URL}?p=2`]);
  assert.equal(shadow.querySelector('.es-author-name').textContent, 'sayfa 2 yazarı');
  assert.equal(shadow.querySelector('.es-pager-select').value, '2');
  assert.equal(shadow.querySelector('.es-pager-prev').hidden, false);
  assert.equal(shadow.querySelector('.es-counter').textContent, '1/4');
});

test("başka sayfadayken kapatınca son bakılan entry'nin sayfası entry işaretiyle açılır", async () => {
  const { dom, doc, fetchImpl } = setup(pageEntries(1), { count: 3, pages: { 2: pageEntries(2) } });
  const navigations = [];
  await main({ cssUrl: CSS_URL, doc, fetchImpl, navigate: (url) => navigations.push(url) });
  doc.querySelector('.eksi-stories-button').click();
  await flush();
  await flush();
  doc.querySelector('eksi-stories-viewer').shadowRoot.querySelector('.es-pager-next').click();
  for (let i = 0; i < 4; i += 1) await flush();

  dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(doc.querySelector('eksi-stories-viewer'), null);
  // ekşi'nin focusto'su başlığın sonundaki yeni entry'lerde sayfayı bulamıyor; story'nin okunduğu sayfa açılır.
  assert.deepEqual(navigations, [`${PAGE_URL}?p=2#eksi-stories-201`]);
});

test("kapatınca açılan sayfa adresi filtreleri korur, focusto'yu siler", async () => {
  const { dom, doc, fetchImpl } = setup(pageEntries(1), {
    count: 3,
    pages: { 2: pageEntries(2) },
    url: `${PAGE_URL}?a=nice&focusto=101`,
  });
  const navigations = [];
  await main({ cssUrl: CSS_URL, doc, fetchImpl, navigate: (url) => navigations.push(url) });
  doc.querySelector('.eksi-stories-button').click();
  await flush();
  await flush();
  doc.querySelector('eksi-stories-viewer').shadowRoot.querySelector('.es-pager-next').click();
  for (let i = 0; i < 4; i += 1) await flush();

  dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.deepEqual(navigations, [`${PAGE_URL}?a=nice&p=2#eksi-stories-201`]);
});

test("entry işaretli adresle açılan sayfada entry'ye kaydırılır, işaret adresten silinir", async () => {
  const { dom, doc, requests, fetchImpl } = setup(pageEntries(2), { count: 3, url: `${PAGE_URL}?p=2#eksi-stories-203` });
  const scrolled = [];
  dom.window.HTMLElement.prototype.scrollIntoView = function scrollIntoView(options) {
    scrolled.push([this.getAttribute('data-id'), options?.block]);
  };
  await main({ cssUrl: CSS_URL, doc, fetchImpl });
  await main({ cssUrl: CSS_URL, doc, fetchImpl });

  assert.deepEqual(scrolled, [['203', 'center']], 'bir kez kaydırılır');
  assert.equal(dom.window.location.href, `${PAGE_URL}?p=2`);
  assert.deepEqual(requests, [], 'istek atılmaz');
});

test("açılış sayfasındaki entry'de kapatınca başka adrese gidilmez", async () => {
  const { dom, doc, fetchImpl } = setup(pageEntries(1), { count: 3 });
  const navigations = [];
  await main({ cssUrl: CSS_URL, doc, fetchImpl, navigate: (url) => navigations.push(url) });
  doc.querySelector('.eksi-stories-button').click();
  await flush();
  await flush();

  dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.deepEqual(navigations, []);
  assert.equal(doc.activeElement, doc.querySelector('.eksi-stories-button'));
});

test('seçim kutusundan sayfa seçilince yalnızca o sayfa istenir, odak story ekranına döner', async () => {
  const { dom, doc, requests, fetchImpl } = setup(pageEntries(1), { count: 3, pages: { 3: pageEntries(3) } });
  await main({ cssUrl: CSS_URL, doc, fetchImpl });
  doc.querySelector('.eksi-stories-button').click();
  await flush();
  await flush();

  const shadow = doc.querySelector('eksi-stories-viewer').shadowRoot;
  const root = shadow.querySelector('.es-root');
  const select = shadow.querySelector('.es-pager-select');

  select.focus();
  assert.equal(root.classList.contains('is-paused'), true);
  assert.equal(shadow.querySelector('.es-paused').hidden, false);

  select.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
  assert.equal(shadow.querySelector('.es-counter').textContent, '1/4');

  select.value = '3';
  select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.equal(shadow.activeElement, root);
  assert.equal(root.classList.contains('is-paused'), false);

  for (let i = 0; i < 4; i += 1) await flush();

  const pageRequests = requests.filter((url) => url.startsWith(`${PAGE_URL}?`));
  assert.deepEqual(pageRequests, [`${PAGE_URL}?p=3`]);
  assert.equal(shadow.querySelector('.es-author-name').textContent, 'sayfa 3 yazarı');
  assert.equal(select.value, '3');
  assert.equal(shadow.querySelector('.es-counter').textContent, '1/4');
});

test('sayfa sayısı değişmedikçe seçim kutusunun seçenekleri yeniden kurulmaz', async () => {
  const { dom, doc, fetchImpl } = setup(pageEntries(1), { count: 3 });
  await main({ cssUrl: CSS_URL, doc, fetchImpl });
  doc.querySelector('.eksi-stories-button').click();
  await flush();
  await flush();

  const shadow = doc.querySelector('eksi-stories-viewer').shadowRoot;
  const select = shadow.querySelector('.es-pager-select');
  const firstOption = select.options[0];

  dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight' }));
  assert.equal(shadow.querySelector('.es-counter').textContent, '2/4');
  assert.equal(select.options.length, 3);
  assert.equal(select.options[0], firstOption);
});

test('kapatıp hemen yeniden açınca kapanan oturumun sayfası istenmez, sayfa istekleri üst üste binmez', async () => {
  const { dom, doc, fetchImpl } = setup([pageEntries(1)[0]], { count: 9, pages: { 2: pageEntries(2), 7: pageEntries(7) } });
  const clock = { t: 0, sleeps: [] };
  const pageQueue = createPageQueue({
    now: () => clock.t,
    sleep: async (ms) => {
      clock.sleeps.push(ms);
      clock.t += ms;
    },
  });
  const pageRequests = [];
  const heldResponses = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const slowFetch = async (url, init) => {
    if (!url.startsWith(`${PAGE_URL}?`)) return fetchImpl(url, init);
    pageRequests.push(url);
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    const held = deferred();
    heldResponses.push(held);
    await held.promise;
    inFlight -= 1;
    return fetchImpl(url, init);
  };
  const navigations = [];
  await main({ cssUrl: CSS_URL, doc, fetchImpl: slowFetch, navigate: (url) => navigations.push(url), pageQueue });

  doc.querySelector('.eksi-stories-button').click();
  await flush();
  await flush();
  assert.deepEqual(pageRequests, [`${PAGE_URL}?p=2`], 'tek görselli sayfada sonraki sayfa arka planda istenir');

  const select = doc.querySelector('eksi-stories-viewer').shadowRoot.querySelector('.es-pager-select');
  select.value = '7';
  select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(doc.querySelector('eksi-stories-viewer'), null);
  doc.querySelector('.eksi-stories-button').click();
  for (let i = 0; i < 4; i += 1) await flush();
  assert.deepEqual(pageRequests, [`${PAGE_URL}?p=2`], 'eski yanıt gelmeden yeni sayfa isteği başlamaz');

  heldResponses[0].resolve();
  for (let i = 0; i < 4; i += 1) await flush();
  assert.deepEqual(pageRequests, [`${PAGE_URL}?p=2`, `${PAGE_URL}?p=2`], 'yeni oturum sırayı devralır');
  assert.deepEqual(clock.sleeps, [1500]);

  heldResponses[1].resolve();
  for (let i = 0; i < 4; i += 1) await flush();
  assert.deepEqual(pageRequests, [`${PAGE_URL}?p=2`, `${PAGE_URL}?p=2`], 'kapanan oturumun 7. sayfası istenmez');
  assert.equal(maxInFlight, 1);
  assert.deepEqual(navigations, []);
  const shadow = doc.querySelector('eksi-stories-viewer').shadowRoot;
  assert.equal(shadow.querySelector('.es-author-name').textContent, 'sayfa 1 yazarı');
  assert.equal(shadow.querySelector('.es-counter').textContent, '1/1');
});

test('açılmayan görsel ekranda kalır, süresi dolunca sonraki story gelir', async () => {
  const { dom, doc, requests, fetchImpl } = brokenImagesSetup({
    1: [
      { id: '101', author: 'sayfa 1 yazarı', content: link('https://soz.lk/i/acilan101') },
      ...pageEntries(1).slice(1, 3),
      { id: '104', author: 'sayfa 1 yazarı', content: link('https://soz.lk/i/acilan104') },
    ],
  });
  const assignedSources = [];
  const srcDescriptor = Object.getOwnPropertyDescriptor(dom.window.HTMLImageElement.prototype, 'src');
  // Önden yükleme görseli DOM'da değil: atanan adresler görsel öğelerinin src'sinden izlenir.
  Object.defineProperty(dom.window.HTMLImageElement.prototype, 'src', {
    configurable: true,
    get() {
      return srcDescriptor.get.call(this);
    },
    set(value) {
      assignedSources.push(value);
      srcDescriptor.set.call(this, value);
    },
  });
  const { pageQueue } = fakeClockQueue();
  await main({ cssUrl: CSS_URL, doc, fetchImpl, pageQueue });
  doc.querySelector('.eksi-stories-button').click();
  for (let i = 0; i < 10; i += 1) await flush();

  const shadow = doc.querySelector('eksi-stories-viewer').shadowRoot;
  const counter = () => shadow.querySelector('.es-counter').textContent;
  const activeFill = () => shadow.querySelector('.es-seg.is-active .es-seg-fill');
  const backdrop = shadow.querySelector('.es-backdrop');
  const pageRequests = () => requests.filter((url) => url.startsWith(`${PAGE_URL}?`));
  const imageRequests = () => requests.filter((url) => url.startsWith('https://eksisozluk.com/img/'));
  /** jsdom animasyon çalıştırmaz: aktif çizginin bitişi elle tetiklenir. */
  const finishStory = () => {
    assert.ok(activeFill(), 'çizgi dolmaya başladı');
    const ended = new dom.window.Event('animationend', { bubbles: true });
    Object.defineProperty(ended, 'animationName', { value: 'es-fill' });
    activeFill().dispatchEvent(ended);
  };
  const settle = async () => {
    for (let i = 0; i < 10; i += 1) await flush();
  };

  shadow.querySelector('.es-image').dispatchEvent(new dom.window.Event('load')); // jsdom görsel yüklemez, açılma elle tetiklenir
  assert.equal(backdrop.getAttribute('src'), 'https://cdn.eksisozluk.com/acilan101.jpg');
  assert.equal(imageRequests().length, 3);

  finishStory();
  const failedFill = activeFill();
  await settle();
  const failed = shadow.querySelector('.es-failed');
  assert.equal(counter(), '2/4', 'açılmayan story atlanmaz');
  assert.ok(failed, 'görsel açılmadı yazısı var');
  assert.equal(failed.hidden, false);
  assert.equal(failed.textContent, 'görsel açılmadı');
  assert.equal(shadow.querySelector('.es-stage > .es-spinner').hidden, true);
  assert.equal(backdrop.hasAttribute('src'), false, 'arka plan boşalır');
  assert.equal(shadow.querySelector('.es-toast'), null, 'geçildi bildirimi yok');
  assert.equal(activeFill(), failedFill, 'yeni yanıtlar çizgiyi baştan başlatmaz');
  assert.equal(imageRequests().length, 4);
  assert.deepEqual(pageRequests(), pageUrls(2, 2));

  finishStory();
  await settle();
  assert.equal(counter(), '3/4');
  assert.equal(failed.hidden, false);
  assert.ok(assignedSources.includes('https://cdn.eksisozluk.com/acilan104.jpg'), 'açılmayan story ekrandayken sıradaki görsel önden yüklenir');

  dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowLeft' }));
  assert.equal(counter(), '2/4');
  assert.ok(activeFill(), 'geri dönülen açılmayan story\'de çizgi yeniden dolar');
  dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowLeft' }));
  assert.equal(counter(), '1/4');
  assert.equal(failed.hidden, true, 'açılan görsele dönünce yazı kalkar');
});

test('görsel açılınca önden okuma o görselin sayfasından sürer', async () => {
  const noImagePages = Object.fromEntries(Array.from({ length: 29 }, (_, i) => [i + 2, [{ id: `${i + 2}01`, content: 'görselsiz' }]]));
  const { dom, doc, requests, fetchImpl } = setup([{ id: '101', content: 'görselsiz' }], {
    count: 30,
    pages: { ...noImagePages, 6: [{ id: '601', author: 'sayfa 6 yazarı', content: link('https://soz.lk/i/acilan601') }] },
  });
  const { pageQueue } = fakeClockQueue();
  await main({ cssUrl: CSS_URL, doc, fetchImpl, pageQueue });
  doc.querySelector('.eksi-stories-button').click();
  for (let i = 0; i < 10; i += 1) await flush();

  const shadow = doc.querySelector('eksi-stories-viewer').shadowRoot;
  const image = shadow.querySelector('.es-image');
  const pageRequests = () => requests.filter((url) => url.startsWith(`${PAGE_URL}?`));
  assert.equal(shadow.querySelector('.es-author-name').textContent, 'sayfa 6 yazarı');
  assert.equal(image.getAttribute('src'), 'https://cdn.eksisozluk.com/acilan601.jpg');
  assert.deepEqual(pageRequests(), pageUrls(2, 6), 'görsel açılmadan sınır dolar');

  image.dispatchEvent(new dom.window.Event('load')); // jsdom görsel yüklemez, açılma elle tetiklenir
  for (let i = 0; i < 10; i += 1) await flush();
  assert.deepEqual(pageRequests(), pageUrls(2, 11), 'sayım açılan görselin sayfasından yeniden başlar');
});

test('sekme gizlenince ekran durur, görününce sürer', async () => {
  const { dom, doc, fetchImpl } = setup(pageEntries(1));
  await main({ cssUrl: CSS_URL, doc, fetchImpl });
  doc.querySelector('.eksi-stories-button').click();
  for (let i = 0; i < 4; i += 1) await flush();

  const shadow = doc.querySelector('eksi-stories-viewer').shadowRoot;
  const root = shadow.querySelector('.es-root');
  let hidden = false;
  Object.defineProperty(doc, 'hidden', { configurable: true, get: () => hidden });
  hidden = true;
  doc.dispatchEvent(new dom.window.Event('visibilitychange'));
  assert.equal(root.classList.contains('is-paused'), true, 'gizli sekmede ekran durur');
  assert.equal(shadow.querySelector('.es-paused').hidden, false);

  hidden = false;
  doc.dispatchEvent(new dom.window.Event('visibilitychange'));
  assert.equal(root.classList.contains('is-paused'), false, 'sekme görününce ekran sürer');
});

test('görselsiz sayfalardan sonra kart çıkar, aramaya devam sonraki sayfaları hakla okur', async () => {
  const noImagePages = Object.fromEntries(Array.from({ length: 29 }, (_, i) => [i + 2, [{ id: `${i + 2}01`, content: 'görselsiz' }]]));
  const { dom, doc, requests, fetchImpl } = setup([{ id: '101', content: link('https://soz.lk/i/acilan101') }], { count: 30, pages: noImagePages });
  const { clock, pageQueue } = fakeClockQueue();
  await main({ cssUrl: CSS_URL, doc, fetchImpl, pageQueue });
  doc.querySelector('.eksi-stories-button').click();
  for (let i = 0; i < 10; i += 1) await flush();

  const shadow = doc.querySelector('eksi-stories-viewer').shadowRoot;
  const pageRequests = () => requests.filter((url) => url.startsWith(`${PAGE_URL}?`));
  shadow.querySelector('.es-image').dispatchEvent(new dom.window.Event('load')); // jsdom görsel yüklemez, açılma elle tetiklenir
  const ended = new dom.window.Event('animationend', { bubbles: true });
  Object.defineProperty(ended, 'animationName', { value: 'es-fill' });
  shadow.querySelector('.es-seg.is-active .es-seg-fill').dispatchEvent(ended);
  for (let i = 0; i < 10; i += 1) await flush();
  assert.equal(shadow.querySelector('.es-card-text').textContent, '5 sayfadır açılan görsel yok');
  assert.deepEqual(pageRequests(), pageUrls(2, 6));
  assert.deepEqual(clock.sleeps, [1500, 1500, 1500, 1500]);

  const continueButton = [...shadow.querySelectorAll('.es-card-actions button')].find((button) => button.textContent === 'aramaya devam');
  assert.ok(continueButton, 'aramaya devam butonu var');
  continueButton.click();
  for (let i = 0; i < 10; i += 1) await flush();
  assert.deepEqual(pageRequests(), pageUrls(2, 11));
  assert.equal(shadow.querySelector('.es-card-text').textContent, '5 sayfadır açılan görsel yok');
  assert.deepEqual(clock.sleeps, [1500, 1500, 1500, 1500, 1500, 1500, 1000, 1500, 3500, 1500, 3500, 1500, 3500], 'haklar bitince sayfalar 5 sn arayla okunur');
});
