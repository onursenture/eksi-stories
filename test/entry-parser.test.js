import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTopicPage, PageStructureError, parseTopicPage } from '../src/core/entry-parser.js';
import { DEFAULT_AVATAR_URL } from '../src/core/constants.js';
import { parseHtml } from './helpers/dom.js';
import { link, topicPageHtml } from './helpers/eksi-html.js';

const sampleDoc = () => parseHtml(topicPageHtml({
  id: '6459985',
  title: 'deneme fotoğrafları',
  slug: 'deneme-fotograflari',
  current: 3,
  count: 7,
  entries: [
    { id: '101', author: 'birinci yazar', date: '30.06.2019 17:04', content: `göcekten selamlar<br><br>${link('https://soz.lk/i/aaa111', 'görsel')}` },
    { id: '102', author: 'ikinci', date: '30.06.2019 17:09 ~ 17:11', content: `iki foto:<br>${link('https://eksisozluk.com/img/bbb222')} ve ${link('https://i.hizliresim.com/Ccc333.jpg')}` },
    { id: '103', author: 'ucuncu', content: `aynı görsel iki kez ${link('https://soz.lk/i/ddd444')} ${link('/img/ddd444')}` },
    { id: '104', author: 'dorduncu', content: 'görselsiz entry (bkz: <a href="/?q=deneme">deneme</a>)' },
    { id: '105', author: 'besinci', content: `eski host ${link('https://eksiup.com/p/2a44197hckz2')}` },
    { id: '106', author: 'altinci', content: `buyrun;<br>[url=${link('https://hizliresim.com/WXEYdE')}][img]${link('https://i.hizliresim.com/WXEYdE.jpg')}[/img][/url]` },
  ],
}));

const byId = (entries, id) => entries.find((entry) => entry.id === id);

test('isTopicPage başlık sayfasını tanır', () => {
  assert.equal(isTopicPage(sampleDoc()), true);
  assert.equal(isTopicPage(parseHtml('<html><body><h1 id="title">x</h1></body></html>')), false);
});

test('başlık ve sayfa bilgisi okunur', () => {
  const { topic, page, entries } = parseTopicPage(sampleDoc());
  assert.deepEqual(topic, { id: '6459985', title: 'deneme fotoğrafları', slug: 'deneme-fotograflari' });
  assert.deepEqual(page, { current: 3, count: 7 });
  assert.deepEqual(entries.map((entry) => entry.id), ['101', '102', '103', '104', '105', '106']);
});

test('pager yoksa tek sayfa kabul edilir (/entry/<id> sayfası dahil)', () => {
  const doc = parseHtml(topicPageHtml({ entries: [{ id: '1', content: 'tek' }] }));
  assert.deepEqual(parseTopicPage(doc).page, { current: 1, count: 1 });
});

test('entry alanları ve görseli okunur', () => {
  const entry = byId(parseTopicPage(sampleDoc()).entries, '101');
  assert.deepEqual(entry, {
    id: '101',
    author: 'birinci yazar',
    authorUrl: 'https://eksisozluk.com/biri/birinci-yazar',
    avatarUrl: 'https://img.ekstat.com/profiles/deneme-1.jpg',
    date: '30.06.2019 17:04',
    permalink: 'https://eksisozluk.com/entry/101',
    text: 'göcekten selamlar',
    images: [{ kind: 'eksi', id: 'aaa111', sourceHref: 'https://soz.lk/i/aaa111' }],
  });
});

test('birden fazla görsel sırasıyla okunur, linkler metinden çıkarılır', () => {
  const entry = byId(parseTopicPage(sampleDoc()).entries, '102');
  assert.deepEqual(entry.images.map((ref) => ref.kind === 'eksi' ? ref.id : ref.url), [
    'bbb222',
    'https://i.hizliresim.com/Ccc333.jpg',
  ]);
  assert.equal(entry.text, 'iki foto:\nve');
  assert.equal(entry.date, '30.06.2019 17:09 ~ 17:11');
});

test('aynı görsel bir entry içinde tekrar etmez', () => {
  assert.equal(byId(parseTopicPage(sampleDoc()).entries, '103').images.length, 1);
});

test('görselsiz ve desteklenmeyen linkli entry boş görsel listesi döner, link metinleri korunur', () => {
  const { entries } = parseTopicPage(sampleDoc());
  assert.deepEqual(byId(entries, '104').images, []);
  assert.equal(byId(entries, '104').text, 'görselsiz entry (bkz: deneme)');
  assert.deepEqual(byId(entries, '105').images, []);
  assert.equal(byId(entries, '105').text, 'eski host https://eksiup.com/p/2a44197hckz2');
});

test('[url]/[img] kalıntıları metinden temizlenir', () => {
  const entry = byId(parseTopicPage(sampleDoc()).entries, '106');
  assert.deepEqual(entry.images, [{
    kind: 'direct',
    url: 'https://i.hizliresim.com/WXEYdE.jpg',
    sourceHref: 'https://i.hizliresim.com/WXEYdE.jpg',
  }]);
  assert.equal(entry.text, 'buyrun;');
});

test('yapı yoksa PageStructureError fırlatılır', () => {
  assert.throws(() => parseTopicPage(parseHtml('<html><body><form id="login"></form></body></html>')), PageStructureError);
});

test('avatar okunur, açık varsayılan koyuya çevrilir, yoksa varsayılan kullanılır', () => {
  const doc = parseHtml(topicPageHtml({
    entries: [
      { id: '201', content: 'a', avatar: 'https://img.ekstat.com/profiles/ornek-123.jpg' },
      { id: '202', content: 'b', avatar: '//ekstat.com/img/default-profile-picture-dark.svg' },
      { id: '203', content: 'c', avatar: '//ekstat.com/img/default-profile-picture-light.svg' },
      { id: '204', content: 'd', avatar: null },
    ],
  }));
  assert.deepEqual(parseTopicPage(doc).entries.map((entry) => entry.avatarUrl), [
    'https://img.ekstat.com/profiles/ornek-123.jpg',
    'https://ekstat.com/img/default-profile-picture-dark.svg',
    'https://ekstat.com/img/default-profile-picture-dark.svg',
    DEFAULT_AVATAR_URL,
  ]);
});
