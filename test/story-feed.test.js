import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PageStructureError } from '../src/core/entry-parser.js';
import { createStoryFeed } from '../src/core/story-feed.js';
import { deferred, flush } from './helpers/async.js';

let entrySeq = 1000;
const entry = (id, imageIds = []) => ({
  id,
  author: `yazar ${id}`,
  authorUrl: `https://eksisozluk.com/biri/yazar-${id}`,
  date: '01.01.2026 10:00',
  permalink: `https://eksisozluk.com/entry/${id}`,
  text: '',
  images: imageIds.map((imageId) => ({ kind: 'eksi', id: imageId, sourceHref: `https://soz.lk/i/${imageId}` })),
});
const noImagePage = () => [entry(String(entrySeq++))];
/** `from`–`to` sayfalarının her birinde görseli açılmayan tek entry; görsel kimliği `x<sayfa>`. */
const brokenPages = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => [entry(String(from + i), [`x${from + i}`])]);
/** `fakeResolver`'da açılmayacak `x1`–`x<to>` kimlikleri. */
const brokenIds = (to) => Array.from({ length: to }, (_, i) => `x${i + 1}`);

function fakeResolver(fail = []) {
  const calls = [];
  return {
    calls,
    resolve(ref) {
      calls.push(ref.id);
      return fail.includes(ref.id)
        ? Promise.reject(new Error('görsel yok'))
        : Promise.resolve(`https://cdn.test/${ref.id}.jpg`);
    },
  };
}

/** results: sırayla dönecek sayfa entry dizileri ya da fırlatılacak Error'lar. */
function fakePageSource(results, count) {
  let last = 1;
  const calls = [];
  return {
    calls,
    hasNext: () => last < count,
    async next() {
      calls.push(last + 1);
      const result = results.shift();
      if (result instanceof Error) throw result;
      last += 1;
      return { page: last, count, entries: result ?? [] };
    },
  };
}

function makeFeed({ entries, results = [], count = 1, fail = [] }) {
  const resolver = fakeResolver(fail);
  const pageSource = fakePageSource(results, count);
  const feed = createStoryFeed({ entries, page: 1, pageCount: count, pageSource, resolver });
  return { feed, resolver, pageSource };
}

/** pages: { [sayfa]: entry dizisi }; failures: { [sayfa]: kaç kez ağ hatası }; structure: yapı hatası verecek sayfalar */
function fakeJumpSource({ count, pages = {}, failures = {}, structure = [] }) {
  let last = 1;
  const loads = [];
  const nexts = [];
  const respond = async (pageNumber) => {
    if (structure.includes(pageNumber)) throw new PageStructureError();
    if ((failures[pageNumber] ?? 0) > 0) {
      failures[pageNumber] -= 1;
      throw new Error('ağ');
    }
    last = pageNumber;
    return { page: pageNumber, count, entries: pages[pageNumber] ?? [] };
  };
  return {
    loads,
    nexts,
    hasNext: () => last < count,
    next() {
      nexts.push(last + 1);
      return respond(last + 1);
    },
    load(pageNumber) {
      loads.push(pageNumber);
      return respond(pageNumber);
    },
  };
}

function makeJumpFeed({ entries, count, pages, failures, structure }) {
  const pageSource = fakeJumpSource({ count, pages, failures, structure });
  const feed = createStoryFeed({ entries, page: 1, pageCount: count, pageSource, resolver: fakeResolver() });
  return { feed, pageSource };
}

test("entry'nin görselleri tek grup olarak story'lere dönüşür", () => {
  const { feed } = makeFeed({ entries: [entry('1', ['a', 'b']), entry('2'), entry('3', ['c'])] });
  feed.start();
  assert.equal(feed.state.length, 3);
  assert.deepEqual(
    { id: feed.current().entry.id, imageIndex: feed.current().imageIndex, imageCount: feed.current().imageCount, page: feed.current().page },
    { id: '1', imageIndex: 0, imageCount: 2, page: 1 },
  );
  assert.equal(feed.peek(1).imageIndex, 1);
  feed.next();
  assert.equal(feed.current().imageIndex, 1);
  feed.next();
  assert.equal(feed.current().entry.id, '3');
  assert.equal(feed.current().imageCount, 1);
});

test('aktif story ve sonraki 2 story çözümlenir', async () => {
  const { feed, resolver } = makeFeed({ entries: [entry('1', ['a', 'b', 'c', 'd', 'e'])] });
  feed.start();
  assert.deepEqual(resolver.calls, ['a', 'b', 'c']);
  await flush();
  assert.equal(feed.current().status, 'ready');
  assert.equal(feed.current().resolvedUrl, 'https://cdn.test/a.jpg');
  feed.next();
  assert.deepEqual(resolver.calls, ['a', 'b', 'c', 'd']);
});

test("aktiften sonra 3'ten az story kalınca sonraki sayfa çekilir", async () => {
  const { feed, pageSource } = makeFeed({
    entries: [entry('1', ['a', 'b', 'c', 'd', 'e'])],
    results: [[entry('2', ['f'])]],
    count: 2,
  });
  feed.start();
  feed.next();
  assert.deepEqual(pageSource.calls, []);
  feed.next();
  assert.deepEqual(pageSource.calls, [2]);
  assert.equal(feed.state.loading, true);
  await flush();
  assert.equal(feed.state.loading, false);
  assert.equal(feed.state.length, 6);
  assert.equal(feed.state.pageCount, 2);
});

test('aynı entry ikinci kez eklenmez', async () => {
  const { feed } = makeFeed({
    entries: [entry('1', ['a'])],
    results: [[entry('1', ['a']), entry('2', ['b'])]],
    count: 2,
  });
  feed.start();
  await flush();
  assert.equal(feed.state.length, 2);
});

test('sonun ötesindeyken yeni story gelince ona geçilir', async () => {
  const { feed } = makeFeed({ entries: [entry('1', ['a'])], results: [[entry('2', ['b'])]], count: 2 });
  feed.start();
  feed.next();
  assert.equal(feed.current(), null);
  assert.equal(feed.state.loading, true);
  await flush();
  assert.equal(feed.current().entry.id, '2');
});

test('art arda 5 görselsiz sayfada durur, continueSearching devam ettirir', async () => {
  const { feed, pageSource } = makeFeed({
    entries: [entry('1', ['a'])],
    results: [noImagePage(), noImagePage(), noImagePage(), noImagePage(), noImagePage(), [entry('2', ['b'])]],
    count: 7,
  });
  feed.start();
  feed.next();
  for (let i = 0; i < 6; i += 1) await flush();
  assert.equal(pageSource.calls.length, 5);
  assert.equal(feed.state.blocked, true);
  assert.equal(feed.state.ended, false);
  assert.equal(feed.current(), null);

  feed.continueSearching();
  await flush();
  assert.equal(pageSource.calls.length, 6);
  assert.equal(feed.state.blocked, false);
  assert.equal(feed.current().entry.id, '2');
});

test('sayfa hatasında errorKind fetch olur; otomatik tekrar yok, retry dener', async () => {
  const { feed, pageSource } = makeFeed({
    entries: [entry('1', ['a'])],
    results: [new Error('ağ'), [entry('2', ['b'])]],
    count: 2,
  });
  feed.start();
  await flush();
  assert.equal(feed.state.errorKind, 'fetch');
  feed.next();
  await flush();
  assert.equal(pageSource.calls.length, 1);

  feed.retry();
  await flush();
  assert.equal(pageSource.calls.length, 2);
  assert.equal(feed.state.errorKind, null);
  assert.equal(feed.current().entry.id, '2');
});

test('yapı hatasında errorKind structure olur ve retry etkisizdir', async () => {
  const { feed, pageSource } = makeFeed({ entries: [], results: [new PageStructureError()], count: 2 });
  feed.start();
  await flush();
  assert.equal(feed.state.errorKind, 'structure');
  feed.retry();
  await flush();
  assert.equal(pageSource.calls.length, 1);
});

test('başarısız olduğu bilinen story gezinmede atlanır', async () => {
  const { feed } = makeFeed({ entries: [entry('1', ['a', 'bad', 'c'])], fail: ['bad'] });
  const skipped = [];
  feed.on('skipped', (story) => skipped.push(story.ref.id));
  feed.start();
  await flush();
  assert.deepEqual(skipped, []);
  feed.next();
  assert.equal(feed.current().ref.id, 'c');
  assert.deepEqual(skipped, ['bad']);
});

test('aktif story başarısız olunca atlanır ve skipped yayılır', async () => {
  const { feed } = makeFeed({ entries: [entry('1', ['bad', 'b'])], fail: ['bad'] });
  const skipped = [];
  feed.on('skipped', (story) => skipped.push(story.ref.id));
  feed.start();
  assert.equal(feed.current().ref.id, 'bad');
  await flush();
  assert.deepEqual(skipped, ['bad']);
  assert.equal(feed.current().ref.id, 'b');
});

test('tamamen başarısız grup tek bildirim verir, geri dönünce tekrar bildirilmez', async () => {
  const { feed } = makeFeed({ entries: [entry('1', ['a']), entry('2', ['bad1', 'bad2']), entry('3', ['c'])], fail: ['bad1', 'bad2'] });
  const skipped = [];
  feed.on('skipped', (story) => skipped.push(story.ref.id));
  feed.start();
  await flush();
  assert.deepEqual(skipped, []);
  feed.next();
  assert.equal(feed.current().ref.id, 'c');
  assert.deepEqual(skipped, ['bad1']);
  feed.prev();
  assert.equal(feed.current().ref.id, 'a');
  assert.deepEqual(skipped, ['bad1']);
});

test('geri giderken başarısız story geriye atlanır; geride yoksa ileri gidilir', () => {
  const { feed } = makeFeed({ entries: [entry('1', ['a', 'b', 'c'])] });
  feed.start();
  feed.next();
  feed.next();
  feed.prev();
  feed.markFailed(feed.current());
  assert.equal(feed.current().ref.id, 'a');
  feed.markFailed(feed.current());
  assert.equal(feed.current().ref.id, 'c');
});

test("prev ilk story'de kalır, goTo(0) başa döner", () => {
  const { feed } = makeFeed({ entries: [entry('1', ['a', 'b', 'c'])] });
  feed.start();
  feed.prev();
  assert.equal(feed.state.index, 0);
  feed.next();
  feed.next();
  feed.goTo(0);
  assert.equal(feed.state.index, 0);
});

test('ended yalnızca sonun ötesinde ve başka sayfa yokken true', () => {
  const { feed } = makeFeed({ entries: [entry('1', ['a'])] });
  feed.start();
  assert.equal(feed.state.ended, false);
  feed.next();
  assert.equal(feed.state.ended, true);
  feed.next();
  assert.equal(feed.state.index, 1);
});

test("görselsiz başlangıç sayfasında start sonun ötesinden başlar ve sayfa arar", () => {
  const { feed, pageSource } = makeFeed({ entries: [entry('1')], results: [[entry('2', ['b'])]], count: 2 });
  feed.start();
  assert.equal(feed.current(), null);
  assert.deepEqual(pageSource.calls, [2]);
});

test('change bildirilir; dispose sonrası olay yayılmaz', async () => {
  const { feed } = makeFeed({ entries: [entry('1', ['a', 'b'])] });
  let changes = 0;
  feed.on('change', () => {
    changes += 1;
  });
  feed.start();
  assert.ok(changes >= 1);
  feed.dispose();
  const before = changes;
  feed.next();
  await flush();
  assert.equal(changes, before);
});

test('tampondaki sayfaya atlamak istek atmaz', async () => {
  const { feed, pageSource } = makeJumpFeed({
    entries: [entry('1', ['a', 'b'])],
    count: 3,
    pages: { 2: [entry('2', ['c', 'd'])], 3: [entry('3', ['e', 'f', 'g', 'h'])] },
  });
  feed.start();
  await flush();
  assert.deepEqual(pageSource.nexts, [2]);
  feed.goToPage(2);
  assert.equal(feed.current().ref.id, 'c');
  assert.equal(feed.state.page, 2);
  assert.deepEqual(pageSource.loads, []);
});

test('tampondaki görselsiz sayfaya atlamak istek atmaz, sonraki görsele geçer', async () => {
  const { feed, pageSource } = makeJumpFeed({
    entries: [entry('1', ['a', 'b', 'c', 'd'])],
    count: 3,
    pages: { 2: [entry('2')], 3: [entry('3', ['e'])] },
  });
  feed.start();
  feed.goTo(3);
  await flush();
  assert.deepEqual(pageSource.nexts, [2, 3]);
  feed.goToPage(2);
  assert.equal(feed.current().ref.id, 'e');
  assert.equal(feed.state.page, 3);
  assert.deepEqual(pageSource.loads, []);
});

test('tamponda olmayan sayfaya atlarken yalnızca o sayfa istenir', async () => {
  const { feed, pageSource } = makeJumpFeed({
    entries: [entry('1', ['a', 'b', 'c', 'd'])],
    count: 9,
    pages: { 6: [entry('6', ['x', 'y', 'z', 'w'])] },
  });
  feed.start();
  feed.goToPage(6);
  assert.equal(feed.current(), null);
  assert.equal(feed.state.jumping, true);
  assert.equal(feed.state.loading, true);
  assert.equal(feed.state.page, 6);
  await flush();
  assert.deepEqual(pageSource.loads, [6]);
  assert.deepEqual(pageSource.nexts, []);
  assert.equal(feed.state.jumping, false);
  assert.equal(feed.state.loading, false);
  assert.equal(feed.current().ref.id, 'x');
  assert.equal(feed.state.page, 6);
  assert.equal(feed.state.length, 4);
});

test('görselsiz hedef sayfadan sonra arama sürer ve hedef boş sayfa sayılmaz', async () => {
  const { feed, pageSource } = makeJumpFeed({ entries: [entry('1', ['a', 'b', 'c', 'd'])], count: 20 });
  feed.start();
  feed.goToPage(3);
  for (let i = 0; i < 8; i += 1) await flush();
  assert.deepEqual(pageSource.loads, [3]);
  assert.deepEqual(pageSource.nexts, [4, 5, 6, 7, 8]);
  assert.equal(feed.state.blocked, true);
});

test('atlamadan önce başlayan arka plan yüklemesinin sonucu yok sayılır', async () => {
  const { feed, pageSource } = makeJumpFeed({
    entries: [entry('1', ['a'])],
    count: 9,
    pages: { 2: [entry('2', ['b'])], 7: [entry('7', ['g', 'h', 'i', 'j'])] },
  });
  feed.start();
  assert.deepEqual(pageSource.nexts, [2]);
  feed.goToPage(7);
  await flush();
  assert.equal(feed.state.length, 4);
  assert.equal(feed.current().entry.id, '7');
  assert.equal(feed.state.page, 7);
  assert.equal(feed.state.loading, false);
});

test('art arda atlamada yalnızca sürmekte olan ve en son hedef istenir', async () => {
  const { feed, pageSource } = makeJumpFeed({
    entries: [entry('1', ['a', 'b', 'c', 'd'])],
    count: 9,
    pages: { 5: [entry('5', ['e', 'f', 'g', 'h'])] },
  });
  feed.start();
  feed.goToPage(3);
  feed.goToPage(4);
  feed.goToPage(5);
  for (let i = 0; i < 4; i += 1) await flush();
  assert.deepEqual(pageSource.loads, [3, 5]);
  assert.equal(feed.current().entry.id, '5');
  assert.equal(feed.state.page, 5);
});

test('atlama hatasında tekrar dene aynı sayfayı yeniden ister', async () => {
  const { feed, pageSource } = makeJumpFeed({
    entries: [entry('1', ['a', 'b', 'c', 'd'])],
    count: 9,
    pages: { 4: [entry('4', ['p', 'q', 'r', 's'])] },
    failures: { 4: 1 },
  });
  feed.start();
  feed.goToPage(4);
  await flush();
  assert.equal(feed.state.errorKind, 'fetch');
  assert.equal(feed.state.jumping, false);
  assert.equal(feed.state.page, 4);
  feed.retry();
  await flush();
  assert.deepEqual(pageSource.loads, [4, 4]);
  assert.equal(feed.state.errorKind, null);
  assert.equal(feed.current().entry.id, '4');
});

test('atlamada sayfa okunamazsa structure hatası verir ve tekrar dene etkisizdir', async () => {
  const { feed, pageSource } = makeJumpFeed({
    entries: [entry('1', ['a', 'b', 'c', 'd'])],
    count: 9,
    structure: [8],
  });
  feed.start();
  feed.goToPage(8);
  await flush();
  assert.equal(feed.state.errorKind, 'structure');
  feed.retry();
  await flush();
  assert.deepEqual(pageSource.loads, [8]);
});

test('sayaç sayfa içinde sayar ve yeni sayfada birden başlar', async () => {
  const { feed } = makeJumpFeed({
    entries: [entry('1', ['a', 'b']), entry('2', ['c'])],
    count: 2,
    pages: { 2: [entry('3', ['d'])] },
  });
  feed.start();
  await flush();
  const counter = () => [feed.state.pagePosition, feed.state.pageStoryCount, feed.state.page];
  assert.deepEqual(counter(), [1, 3, 1]);
  feed.next();
  assert.deepEqual(counter(), [2, 3, 1]);
  feed.next();
  assert.deepEqual(counter(), [3, 3, 1]);
  feed.next();
  assert.deepEqual(counter(), [1, 1, 2]);
  feed.next();
  assert.deepEqual([feed.state.pagePosition, feed.state.pageStoryCount, feed.state.page], [null, null, 2]);
});

test('sınır dışı sayfa numarası sayfa aralığına sıkıştırılır', async () => {
  const { feed, pageSource } = makeJumpFeed({
    entries: [entry('1', ['a', 'b', 'c', 'd'])],
    count: 5,
    pages: { 5: [entry('5', ['e'])] },
  });
  feed.start();
  feed.goToPage(99);
  await flush();
  assert.deepEqual(pageSource.loads, [5]);
  feed.goToPage(-3);
  await flush();
  assert.deepEqual(pageSource.loads, [5, 1]);
  feed.goToPage(Number.NaN);
  await flush();
  assert.deepEqual(pageSource.loads, [5, 1]);
});

test('kapatıldıktan sonra reddedilen sayfa isteği hata durumu yaratmaz', async () => {
  const background = deferred();
  const jump = deferred();
  const pageSource = { hasNext: () => true, next: () => background.promise, load: () => jump.promise };
  const loading = createStoryFeed({ entries: [entry('1', ['a'])], page: 1, pageCount: 9, pageSource, resolver: fakeResolver() });
  const jumping = createStoryFeed({ entries: [entry('2', ['b', 'c', 'd', 'e'])], page: 1, pageCount: 9, pageSource, resolver: fakeResolver() });
  loading.start();
  jumping.start();
  jumping.goToPage(7);
  assert.equal(loading.state.loading, true, 'arka planda sonraki sayfa isteniyor');
  assert.equal(jumping.state.jumping, true, '7. sayfaya atlanıyor');

  loading.dispose();
  jumping.dispose();
  background.reject(new DOMException('iptal', 'AbortError'));
  jump.reject(new DOMException('iptal', 'AbortError'));
  await flush();
  assert.equal(loading.state.errorKind, null);
  assert.equal(jumping.state.errorKind, null);
});

test('görselleri açılmayan sayfalar da 5 sayfa sınırına sayılır', async () => {
  const { feed, pageSource } = makeFeed({
    entries: [entry('1', ['x1'])],
    results: brokenPages(2, 11),
    count: 12,
    fail: brokenIds(11),
  });
  feed.start();
  for (let i = 0; i < 8; i += 1) await flush();
  assert.deepEqual(pageSource.calls, [2, 3, 4, 5, 6]);
  assert.equal(feed.current(), null);
  assert.equal(feed.state.blocked, true);
  assert.equal(feed.state.ended, false);

  feed.continueSearching();
  for (let i = 0; i < 8; i += 1) await flush();
  assert.deepEqual(pageSource.calls, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.equal(feed.state.blocked, true);
});

test('görsel açılınca sayım o görselin sayfasından yeniden başlar', async () => {
  const results = brokenPages(2, 12);
  results[2] = [entry('4', ['ok4'])]; // 4. sayfanın görseli açılır
  const { feed, pageSource } = makeFeed({
    entries: [entry('1', ['x1'])],
    results,
    count: 13,
    fail: brokenIds(12),
  });
  feed.start();
  for (let i = 0; i < 8; i += 1) await flush();
  assert.equal(feed.current().ref.id, 'ok4');
  assert.deepEqual(pageSource.calls, [2, 3, 4, 5, 6]);
  assert.equal(feed.state.blocked, true, 'sınır dolu, 4. sayfanın görseli henüz açılmadı');

  feed.markOpened(feed.current());
  for (let i = 0; i < 8; i += 1) await flush();
  assert.deepEqual(pageSource.calls, [2, 3, 4, 5, 6, 7]);
  assert.equal(feed.state.blocked, false);

  feed.next();
  for (let i = 0; i < 8; i += 1) await flush();
  assert.deepEqual(pageSource.calls, [2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(feed.current(), null);
  assert.equal(feed.state.blocked, true);
});

test('aktif olmayan story için markOpened yok sayılır', async () => {
  const { feed, pageSource } = makeFeed({
    entries: [entry('1', ['x1'])],
    results: brokenPages(2, 11),
    count: 12,
    fail: brokenIds(11),
  });
  feed.start();
  for (let i = 0; i < 8; i += 1) await flush();
  assert.equal(feed.state.blocked, true);

  feed.markOpened(feed.peek(-1));
  for (let i = 0; i < 8; i += 1) await flush();
  assert.deepEqual(pageSource.calls, [2, 3, 4, 5, 6]);
  assert.equal(feed.state.blocked, true);
});

test('sınır son sayfada dolarsa başlık biter', async () => {
  const { feed, pageSource } = makeFeed({
    entries: [entry('1', ['a'])],
    results: [noImagePage(), noImagePage(), noImagePage(), noImagePage(), noImagePage()],
    count: 6,
  });
  feed.start();
  feed.next();
  for (let i = 0; i < 6; i += 1) await flush();
  assert.deepEqual(pageSource.calls, [2, 3, 4, 5, 6]);
  assert.equal(feed.state.blocked, false);
  assert.equal(feed.state.ended, true);
});

test('atlamada açılan görselin sayfası sıfırlanır', async () => {
  const { feed, pageSource } = makeJumpFeed({
    entries: [entry('1', ['a', 'b', 'c', 'd'])],
    count: 30,
    pages: { 10: [entry('10', ['j1', 'j2', 'j3', 'j4'])] },
  });
  feed.start();
  feed.goToPage(10);
  await flush();
  assert.equal(feed.current().ref.id, 'j1');
  feed.markOpened(feed.current());

  feed.goToPage(3);
  for (let i = 0; i < 8; i += 1) await flush();
  assert.deepEqual(pageSource.loads, [10, 3]);
  assert.deepEqual(pageSource.nexts, [4, 5, 6, 7, 8]);
  assert.equal(feed.state.blocked, true);
});
