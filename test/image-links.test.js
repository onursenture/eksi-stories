import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyImageLink, imageRefKey } from '../src/core/image-links.js';

test('soz.lk kısa linki ekşi görseline çevrilir', () => {
  assert.deepEqual(classifyImageLink('https://soz.lk/i/q1hqzn3x'), {
    kind: 'eksi',
    id: 'q1hqzn3x',
    sourceHref: 'https://soz.lk/i/q1hqzn3x',
  });
});

test('eksisozluk.com/img linki mutlak, www ve göreli haliyle ekşi görseline çevrilir', () => {
  assert.equal(classifyImageLink('https://eksisozluk.com/img/ab12cd34').id, 'ab12cd34');
  assert.equal(classifyImageLink('https://www.eksisozluk.com/img/ab12cd34').kind, 'eksi');
  assert.deepEqual(classifyImageLink('/img/ab12cd34'), { kind: 'eksi', id: 'ab12cd34', sourceHref: '/img/ab12cd34' });
});

test('yolu görsel uzantısıyla biten direkt linkler kabul edilir', () => {
  for (const href of [
    'https://i.hizliresim.com/WXEYdE.jpg',
    'https://example.com/a/b/photo.JPEG',
    'https://example.com/x.png?width=800',
    'https://example.com/anim.gif',
    'http://example.com/pic.webp',
  ]) {
    const ref = classifyImageLink(href);
    assert.equal(ref?.kind, 'direct', href);
    assert.equal(ref.url, new URL(href).href);
    assert.equal(ref.sourceHref, href);
  }
});

test('desteklenmeyen linkler null döner', () => {
  for (const href of [
    'https://eksiup.com/p/2a44197hckz2',
    'https://hizliresim.com/WXEYdE',
    'https://eksisozluk.com/?q=yine+bi+g%c3%bcn',
    'https://soz.lk/i/',
    'https://soz.lk/i/abc/extra',
    'https://eksisozluk.com/img/ab-12',
    'https://example.com/photo.jpg.html',
    'javascript:alert(1)',
    'http://[bozuk',
  ]) {
    assert.equal(classifyImageLink(href), null, href);
  }
});

test('imageRefKey aynı görsel için aynı, farklı görsel için farklı anahtar üretir', () => {
  assert.equal(
    imageRefKey(classifyImageLink('https://soz.lk/i/abc123')),
    imageRefKey(classifyImageLink('/img/abc123')),
  );
  assert.notEqual(
    imageRefKey(classifyImageLink('https://example.com/a.jpg')),
    imageRefKey(classifyImageLink('https://example.com/b.jpg')),
  );
});
