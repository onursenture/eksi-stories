import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PageStructureError } from '../src/core/entry-parser.js';
import { createStoryFeed } from '../src/core/story-feed.js';
import { flush } from './helpers/async.js';

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
