import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { main } from '../src/content/main.js';
import { flush } from './helpers/async.js';
import { imagePageHtml, link, topicPageHtml } from './helpers/eksi-html.js';

const PAGE_URL = 'https://eksisozluk.com/deneme-basligi--1000001';
const CSS_URL = 'chrome-extension://test/src/viewer/viewer.css';

/** Sayfa başına dört görsel: açılışta ve sayfa atlamada önden sayfa istenmez. */
const pageEntries = (page) => [1, 2, 3, 4].map((n) => ({
  id: `${page}0${n}`,
  author: `sayfa ${page} yazarı`,
  content: link(`https://soz.lk/i/p${page}n${n}`),
}));

function setup(entries, { count = 1, pages = {} } = {}) {
  const dom = new JSDOM(topicPageHtml({ count, entries }), { url: PAGE_URL });
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

test('başka sayfadayken kapatınca son bakılan entry focusto adresiyle açılır', async () => {
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
  assert.deepEqual(navigations, [`${PAGE_URL}?focusto=201`]);
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
