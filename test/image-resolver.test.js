import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createResolver, ImageResolveError } from '../src/core/image-resolver.js';
import { deferred, flush } from './helpers/async.js';
import { parseHtml } from './helpers/dom.js';
import { imagePageHtml } from './helpers/eksi-html.js';

const CDN = 'https://cdn.eksisozluk.com/2026/8/16/q/q1hqzn3x.jpg';
const ok = (body) => ({ ok: true, status: 200, text: async () => body });
const notFound = () => ({ ok: false, status: 404, text: async () => '' });

test('direkt görsel fetch yapılmadan olduğu gibi döner', async () => {
  let calls = 0;
  const resolver = createResolver({ fetch: async () => { calls += 1; }, parseHtml });
  const url = await resolver.resolve({ kind: 'direct', url: 'https://example.com/a.jpg', sourceHref: 'x' });
  assert.equal(url, 'https://example.com/a.jpg');
  assert.equal(calls, 0);
});

test('ekşi görseli /img/<id> sayfasındaki og:image ile çözülür', async () => {
  const requests = [];
  const resolver = createResolver({
    fetch: async (url, init) => {
      requests.push([url, init.credentials]);
      return ok(imagePageHtml({ ogImage: CDN, imageSrc: 'https://cdn.eksisozluk.com/baska.jpg' }));
    },
    parseHtml,
  });
  assert.equal(await resolver.resolve({ kind: 'eksi', id: 'q1hqzn3x' }), CDN);
  assert.deepEqual(requests, [['https://eksisozluk.com/img/q1hqzn3x', 'include']]);
});

test('og:image yoksa #image src kullanılır', async () => {
  const resolver = createResolver({ fetch: async () => ok(imagePageHtml({ imageSrc: CDN })), parseHtml });
  assert.equal(await resolver.resolve({ kind: 'eksi', id: 'q1hqzn3x' }), CDN);
});

test('404 ImageResolveError verir ve aynı id tekrar istenmez', async () => {
  let calls = 0;
  const resolver = createResolver({ fetch: async () => { calls += 1; return notFound(); }, parseHtml });
  const ref = { kind: 'eksi', id: 'yok' };
  await assert.rejects(resolver.resolve(ref), ImageResolveError);
  await assert.rejects(resolver.resolve(ref), ImageResolveError);
  assert.equal(calls, 1);
});

test('sayfada görsel adresi yoksa hata verir', async () => {
  const resolver = createResolver({ fetch: async () => ok(imagePageHtml({})), parseHtml });
  await assert.rejects(resolver.resolve({ kind: 'eksi', id: 'bos' }), /görsel adresi bulunamadı/);
});

test('başarılı sonuç önbelleklenir', async () => {
  let calls = 0;
  const resolver = createResolver({
    fetch: async () => { calls += 1; return ok(imagePageHtml({ ogImage: CDN })); },
    parseHtml,
  });
  await resolver.resolve({ kind: 'eksi', id: 'a' });
  await resolver.resolve({ kind: 'eksi', id: 'a' });
  assert.equal(calls, 1);
});

test('aynı anda en fazla 2 görsel sayfası istenir', async () => {
  const gates = [];
  let active = 0;
  let maxActive = 0;
  const resolver = createResolver({
    fetch: async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      const gate = deferred();
      gates.push(gate);
      await gate.promise;
      active -= 1;
      return ok(imagePageHtml({ ogImage: CDN }));
    },
    parseHtml,
  });
  const results = ['a', 'b', 'c', 'd', 'e'].map((id) => resolver.resolve({ kind: 'eksi', id }));
  await flush();
  assert.equal(gates.length, 2);
  while (gates.length > 0) {
    gates.shift().resolve();
    await flush();
  }
  assert.deepEqual(await Promise.all(results), [CDN, CDN, CDN, CDN, CDN]);
  assert.equal(maxActive, 2);
});
