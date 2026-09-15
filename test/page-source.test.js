import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PageStructureError } from '../src/core/entry-parser.js';
import { buildPageUrl, createPageSource, PageFetchError } from '../src/core/page-source.js';
import { parseHtml } from './helpers/dom.js';
import { link, topicPageHtml } from './helpers/eksi-html.js';

const TOPIC_URL = 'https://eksisozluk.com/deneme--1000001';
const ok = (body) => ({ ok: true, status: 200, text: async () => body });
const failWith = (status) => ({ ok: false, status, text: async () => '' });
const pageBody = (current, count) => topicPageHtml({
  current,
  count,
  entries: [{ id: `${current}01`, content: link(`https://soz.lk/i/img${current}01`) }],
});

function makeSource(fetch, overrides = {}) {
  const clock = { t: 0, sleeps: [] };
  const source = createPageSource({
    fetch,
    parseHtml,
    baseUrl: TOPIC_URL,
    current: 1,
    count: 5,
    now: () => clock.t,
    sleep: async (ms) => {
      clock.sleeps.push(ms);
      clock.t += ms;
    },
    ...overrides,
  });
  return { source, clock };
}

test('buildPageUrl filtreleri korur, focusto ve hash siler', () => {
  assert.equal(
    buildPageUrl(`${TOPIC_URL}?a=popular&focusto=55#entry`, 4),
    `${TOPIC_URL}?a=popular&p=4`,
  );
  assert.equal(buildPageUrl(`${TOPIC_URL}?p=2`, 3), `${TOPIC_URL}?p=3`);
  assert.equal(buildPageUrl(TOPIC_URL, 2), `${TOPIC_URL}?p=2`);
});

test('sonraki sayfayı çeker, ayrıştırır ve hasNext günceller', async () => {
  const requests = [];
  const { source } = makeSource(async (url, init) => {
    requests.push([url, init.credentials]);
    return ok(pageBody(3, 3));
  }, { baseUrl: `${TOPIC_URL}?p=2`, current: 2, count: 3 });

  assert.equal(source.hasNext(), true);
  const result = await source.next();
  assert.equal(result.page, 3);
  assert.equal(result.count, 3);
  assert.deepEqual(result.entries.map((entry) => entry.id), ['301']);
  assert.deepEqual(requests, [[`${TOPIC_URL}?p=3`, 'include']]);
  assert.equal(source.hasNext(), false);
  await assert.rejects(source.next());
});

test('istekler arasında en az 1500 ms beklenir', async () => {
  const { source, clock } = makeSource(async (url) => {
    const page = Number(new URL(url).searchParams.get('p'));
    return ok(pageBody(page, 10));
  }, { count: 10 });

  await source.next();
  assert.deepEqual(clock.sleeps, []);
  clock.t += 400;
  await source.next();
  assert.deepEqual(clock.sleeps, [1100]);
  clock.t += 2000;
  await source.next();
  assert.deepEqual(clock.sleeps, [1100]);
});

test('uçuşta tek istek olur', async () => {
  let calls = 0;
  const { source } = makeSource(async () => {
    calls += 1;
    return ok(pageBody(2, 5));
  });
  const first = source.next();
  const second = source.next();
  assert.equal(first, second);
  await first;
  assert.equal(calls, 1);
});

test('5xx sonrası 5 sn bekleyip bir kez tekrar dener', async () => {
  const responses = [failWith(503), ok(pageBody(2, 5))];
  const { source, clock } = makeSource(async () => responses.shift());
  assert.equal((await source.next()).page, 2);
  assert.deepEqual(clock.sleeps, [5000]);
});

test('429 da tekrar denenir', async () => {
  const responses = [failWith(429), ok(pageBody(2, 5))];
  const { source } = makeSource(async () => responses.shift());
  assert.equal((await source.next()).page, 2);
});

test('tekrar da başarısızsa PageFetchError; sonraki çağrı aynı sayfayı yeniden dener', async () => {
  let calls = 0;
  const { source } = makeSource(async () => {
    calls += 1;
    if (calls <= 2) throw new TypeError('ağ yok');
    return ok(pageBody(2, 5));
  });
  await assert.rejects(source.next(), (error) => error instanceof PageFetchError && error.status === 0);
  assert.equal(calls, 2);
  assert.equal(source.hasNext(), true);
  assert.equal((await source.next()).page, 2);
});

test('404 tekrar denenmez', async () => {
  let calls = 0;
  const { source } = makeSource(async () => {
    calls += 1;
    return failWith(404);
  });
  await assert.rejects(source.next(), (error) => error instanceof PageFetchError && error.status === 404);
  assert.equal(calls, 1);
});

test('yanıtta başlık yapısı yoksa PageStructureError', async () => {
  const { source } = makeSource(async () => ok('<html><body><form id="login"></form></body></html>'));
  await assert.rejects(source.next(), PageStructureError);
});

test('istenenden farklı sayfa dönerse sayfalama biter', async () => {
  const { source } = makeSource(async () => ok(pageBody(1, 5)));
  const result = await source.next();
  assert.deepEqual(result.entries, []);
  assert.equal(source.hasNext(), false);
});

test('başlık büyüdükçe sayfa sayısı güncellenir', async () => {
  const { source } = makeSource(async () => ok(pageBody(2, 4)), { count: 2 });
  const result = await source.next();
  assert.equal(result.count, 4);
  assert.equal(source.hasNext(), true);
});
