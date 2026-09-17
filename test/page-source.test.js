import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PageStructureError } from '../src/core/entry-parser.js';
import { buildPageUrl, createPageQueue, createPageSource, PageFetchError } from '../src/core/page-source.js';
import { parseHtml } from './helpers/dom.js';
import { link, topicPageHtml } from './helpers/eksi-html.js';
import { deferred, flush } from './helpers/async.js';

const TOPIC_URL = 'https://eksisozluk.com/deneme--1000001';
const ok = (body) => ({ ok: true, status: 200, text: async () => body });
const failWith = (status) => ({ ok: false, status, text: async () => '' });
const pageBody = (current, count) => topicPageHtml({
  current,
  count,
  entries: [{ id: `${current}01`, content: link(`https://soz.lk/i/img${current}01`) }],
});

/** Tek sekme: sahte saat, ortak sayfa isteği sırası ve bu sıradan oturum açan `open`. `clock.onSleep` bekleme sürerken çalışır. */
function makeTab() {
  const clock = { t: 0, sleeps: [], onSleep: null };
  const sleep = async (ms) => {
    clock.sleeps.push(ms);
    clock.onSleep?.();
    clock.t += ms;
  };
  const queue = createPageQueue({ now: () => clock.t, sleep });
  const open = (fetch, overrides = {}) => createPageSource({
    fetch,
    parseHtml,
    baseUrl: TOPIC_URL,
    current: 1,
    count: 5,
    queue,
    sleep,
    ...overrides,
  });
  return { clock, open };
}

function makeSource(fetch, overrides = {}) {
  const { clock, open } = makeTab();
  return { source: open(fetch, overrides), clock };
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

test('load istenen sayfayı çeker, next ondan sonraki sayfadan devam eder', async () => {
  const requests = [];
  const { source } = makeSource(async (url) => {
    requests.push(url);
    const page = Number(new URL(url).searchParams.get('p'));
    return ok(pageBody(page, 6));
  }, { count: 6 });
  const loaded = await source.load(3);
  assert.equal(loaded.page, 3);
  assert.equal(loaded.count, 6);
  assert.deepEqual(loaded.entries.map((entry) => entry.id), ['301']);
  assert.equal(source.hasNext(), true);
  assert.equal((await source.next()).page, 4);
  assert.deepEqual(requests, [`${TOPIC_URL}?p=3`, `${TOPIC_URL}?p=4`]);
});

test('load son sayfayı yüklerse hasNext false olur', async () => {
  const { source } = makeSource(async () => ok(pageBody(5, 5)));
  await source.load(5);
  assert.equal(source.hasNext(), false);
});

test('load ve next aynı anda tek istek atar, aralarında 1500 ms beklenir', async () => {
  const requests = [];
  const firstResponse = deferred();
  const { source, clock } = makeSource(async (url) => {
    requests.push(url);
    const page = Number(new URL(url).searchParams.get('p'));
    if (page === 2) await firstResponse.promise;
    return ok(pageBody(page, 9));
  }, { count: 9 });
  const both = Promise.all([source.next(), source.load(7)]);
  await flush();
  assert.deepEqual(requests, [`${TOPIC_URL}?p=2`], 'ilk yanıt gelmeden ikinci istek başlamaz');
  firstResponse.resolve();
  await both;
  assert.deepEqual(requests, [`${TOPIC_URL}?p=2`, `${TOPIC_URL}?p=7`]);
  assert.deepEqual(clock.sleeps, [1500]);
});

test('load sürmekte olan next ile aynı sayfayı isterse ikinci istek atılmaz', async () => {
  const requests = [];
  const { source } = makeSource(async (url) => {
    requests.push(url);
    return ok(pageBody(2, 5));
  });
  const fromNext = source.next();
  const fromLoad = source.load(2);
  const [nextResult, loadResult] = await Promise.all([fromNext, fromLoad]);
  assert.equal(nextResult.page, 2);
  assert.equal(loadResult.page, 2);
  assert.deepEqual(requests, [`${TOPIC_URL}?p=2`]);
});

test('load sürerken çağrılan next, yüklenen sayfanın ardından devam eder', async () => {
  const requests = [];
  const { source } = makeSource(async (url) => {
    requests.push(url);
    const page = Number(new URL(url).searchParams.get('p'));
    return ok(pageBody(page, 10));
  }, { current: 3, count: 10 });
  const [loadResult, nextResult] = await Promise.all([source.load(8), source.next()]);
  assert.equal(loadResult.page, 8);
  assert.equal(nextResult.page, 9);
  assert.deepEqual(requests, [`${TOPIC_URL}?p=8`, `${TOPIC_URL}?p=9`]);
});

test('aynı sayfaya art arda iki load tek istek atar', async () => {
  const requests = [];
  const { source } = makeSource(async (url) => {
    requests.push(url);
    return ok(pageBody(5, 5));
  });
  const [result1, result2] = await Promise.all([source.load(5), source.load(5)]);
  assert.equal(result1.page, 5);
  assert.equal(result2.page, 5);
  assert.deepEqual(requests, [`${TOPIC_URL}?p=5`]);
});

test('load 5xx hatasında 5 sn sonra bir kez tekrar dener', async () => {
  const responses = [failWith(502), ok(pageBody(4, 5))];
  const { source, clock } = makeSource(async () => responses.shift());
  assert.equal((await source.load(4)).page, 4);
  assert.deepEqual(clock.sleeps, [5000]);
});

test('aynı sıradaki iki oturumun istekleri üst üste binmez, aralarında 1500 ms beklenir', async () => {
  const { clock, open } = makeTab();
  const requests = [];
  const firstResponse = deferred();
  const fetch = async (url) => {
    requests.push(url);
    if (requests.length === 1) await firstResponse.promise;
    return ok(pageBody(2, 5));
  };
  const both = Promise.all([open(fetch).next(), open(fetch).next()]);
  await flush();
  assert.deepEqual(requests, [`${TOPIC_URL}?p=2`], 'ilk yanıt gelmeden ikinci oturum istek atmaz');
  firstResponse.resolve();
  await both;
  assert.deepEqual(requests, [`${TOPIC_URL}?p=2`, `${TOPIC_URL}?p=2`]);
  assert.deepEqual(clock.sleeps, [1500]);
});

test('kapatılan oturumun uçuştaki isteği beklenir, sıradaki işi istek atmadan düşer', async () => {
  const { clock, open } = makeTab();
  const requests = [];
  const firstResponse = deferred();
  const fetch = async (url) => {
    requests.push(url);
    if (requests.length === 1) await firstResponse.promise;
    return ok(pageBody(Number(new URL(url).searchParams.get('p')), 9));
  };
  const closed = open(fetch, { count: 9 });
  const inFlight = assert.rejects(closed.next(), { name: 'AbortError' });
  const queued = assert.rejects(closed.load(7), { name: 'AbortError' });
  await flush();
  closed.dispose();
  const reopened = open(fetch, { count: 9 }).next();
  await flush();
  assert.deepEqual(requests, [`${TOPIC_URL}?p=2`], 'uçuştaki yanıt gelmeden yeni istek başlamaz');
  firstResponse.resolve();
  await inFlight;
  await queued;
  assert.equal((await reopened).page, 2);
  assert.deepEqual(requests, [`${TOPIC_URL}?p=2`, `${TOPIC_URL}?p=2`]);
  assert.deepEqual(clock.sleeps, [1500]);
});

test('aralık beklenirken kapatılırsa istek atılmaz, sonraki oturum fazladan beklemez', async () => {
  const { clock, open } = makeTab();
  const requests = [];
  const fetch = async (url) => {
    requests.push(url);
    return ok(pageBody(Number(new URL(url).searchParams.get('p')), 9));
  };
  const closed = open(fetch, { count: 9 });
  await closed.next();
  clock.onSleep = () => closed.dispose(); // 1500 ms aralık beklenirken kapanır
  await assert.rejects(closed.next(), { name: 'AbortError' });
  clock.onSleep = null;
  assert.equal((await open(fetch, { count: 9 }).next()).page, 2);
  assert.deepEqual(requests, [`${TOPIC_URL}?p=2`, `${TOPIC_URL}?p=2`]);
  assert.deepEqual(clock.sleeps, [1500]);
});

test('uçuştaki istek 503 dönerken kapatılırsa 5 sn beklenir, tekrar isteği atılmaz', async () => {
  let calls = 0;
  const { source, clock } = makeSource(async () => {
    calls += 1;
    source.dispose(); // yanıt gelmeden story ekranı kapanır
    return failWith(503);
  });
  await assert.rejects(source.next(), { name: 'AbortError' });
  assert.equal(calls, 1);
  assert.deepEqual(clock.sleeps, [5000]);
});

test('kapatıldıktan sonra next ve load istek atmadan reddedilir', async () => {
  let calls = 0;
  const { source } = makeSource(async () => {
    calls += 1;
    return ok(pageBody(2, 5));
  });
  await source.load(2);
  source.dispose();
  source.dispose();
  await assert.rejects(source.load(2), { name: 'AbortError' }, 'son sonuç da kullanılmaz');
  await assert.rejects(source.next(), { name: 'AbortError' });
  assert.equal(calls, 1);
});

test('önden okuma hakları bitince sonraki sayfa bir hak dolana kadar bekler', async () => {
  const starts = [];
  const { source, clock } = makeSource(async (url) => {
    starts.push(clock.t);
    return ok(pageBody(Number(new URL(url).searchParams.get('p')), 20));
  }, { count: 20 });
  const round = [1500, 1500, 1500, 1500, 1500, 1500, 1000, 1500, 3500];

  for (let i = 0; i < 8; i += 1) await source.next();
  assert.deepEqual(starts, [0, 1500, 3000, 4500, 6000, 7500, 10000, 15000]);
  assert.deepEqual(clock.sleeps, round);

  clock.t += 60000; // bir dakika istek yok: haklar en fazla 5'e dolar
  for (let i = 0; i < 8; i += 1) await source.next();
  assert.deepEqual(starts.slice(8), [75000, 76500, 78000, 79500, 81000, 82500, 85000, 90000]);
  assert.deepEqual(clock.sleeps, [...round, ...round]);
});

test('sayfa atlama hak harcamaz', async () => {
  const { source, clock } = makeSource(async (url) => ok(pageBody(Number(new URL(url).searchParams.get('p')), 12)), { count: 12 });
  for (let i = 0; i < 6; i += 1) await source.next();
  assert.deepEqual(clock.sleeps, [1500, 1500, 1500, 1500, 1500]);
  await source.load(9);
  await source.next();
  assert.deepEqual(clock.sleeps, [1500, 1500, 1500, 1500, 1500, 1500, 1500], 'load hak harcasaydı sonraki istekten önce hak beklenirdi');
});

test('hak beklerken kapatılınca istek atılmaz ve hak harcanmaz', async () => {
  const { clock, open } = makeTab();
  const requests = [];
  const fetch = async (url) => {
    requests.push(url);
    return ok(pageBody(Number(new URL(url).searchParams.get('p')), 12));
  };
  const closed = open(fetch, { count: 12 });
  for (let i = 0; i < 6; i += 1) await closed.next();
  clock.onSleep = () => {
    if (clock.sleeps.at(-1) === 1000) closed.dispose(); // hak beklenirken kapanır
  };
  await assert.rejects(closed.next(), { name: 'AbortError' });
  clock.onSleep = null;
  assert.equal(requests.length, 6, 'hak beklenirken kapanan oturum istek atmaz');
  assert.deepEqual(clock.sleeps, [1500, 1500, 1500, 1500, 1500, 1500, 1000]);

  assert.equal((await open(fetch, { count: 12 }).next()).page, 2);
  assert.equal(requests.length, 7);
  assert.deepEqual(clock.sleeps, [1500, 1500, 1500, 1500, 1500, 1500, 1000], 'hak harcanmadığı için yeni oturum beklemez');
});

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
