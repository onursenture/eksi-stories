import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { main } from '../src/content/main.js';
import { flush } from './helpers/async.js';
import { imagePageHtml, link, topicPageHtml } from './helpers/eksi-html.js';

const PAGE_URL = 'https://eksisozluk.com/deneme-basligi--1000001';
const CSS_URL = 'chrome-extension://test/src/viewer/viewer.css';

function setup(entries) {
  const dom = new JSDOM(topicPageHtml({ entries }), { url: PAGE_URL });
  const requests = [];
  const fetchImpl = async (url) => {
    requests.push(url);
    if (url === CSS_URL) return { ok: true, status: 200, text: async () => '.es-root { color: #fff; }' };
    if (url.startsWith('https://eksisozluk.com/img/')) {
      const id = url.split('/').pop();
      return { ok: true, status: 200, text: async () => imagePageHtml({ ogImage: `https://cdn.eksisozluk.com/${id}.jpg` }) };
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
  assert.equal(shadow.querySelector('.es-author').textContent, 'ilk yazar');
  assert.equal(shadow.querySelector('.es-permalink').getAttribute('href'), 'https://eksisozluk.com/entry/101');
  assert.equal(shadow.querySelector('.es-caption').textContent, 'merhaba');
  assert.equal(shadow.querySelector('.es-page').textContent, 'sayfa 1/1');
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
