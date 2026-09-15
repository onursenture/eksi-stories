import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
  return new RegExp(`^${escaped}$`);
}

test('manifest v3, ad ve açıklama kuralları', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, 'Stories for Ekşi Sözlük');
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.ok([...manifest.description].length <= 132, 'açıklama en fazla 132 karakter olmalı');
  assert.match(manifest.description, /resmi değildir/i);
});

test('ek izin istenmez; yalnızca eksisozluk.com content script', () => {
  assert.equal(manifest.permissions, undefined);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.optional_permissions, undefined);
  assert.equal(manifest.background, undefined);
  assert.deepEqual(manifest.content_scripts.map((script) => script.matches), [['https://eksisozluk.com/*']]);
  for (const resource of manifest.web_accessible_resources) {
    assert.deepEqual(resource.matches, ['https://eksisozluk.com/*']);
  }
});

test('manifest içinde adı geçen dosyalar mevcut', () => {
  const referenced = [
    ...Object.values(manifest.icons),
    ...manifest.content_scripts.flatMap((script) => [...(script.js ?? []), ...(script.css ?? [])]),
  ];
  for (const file of referenced) {
    assert.ok(existsSync(join(ROOT, file)), `eksik dosya: ${file}`);
  }
});

test('ikonlar doğru boyutta PNG', () => {
  for (const [size, file] of Object.entries(manifest.icons)) {
    const buffer = readFileSync(join(ROOT, file));
    assert.equal(buffer.toString('hex', 0, 8), '89504e470d0a1a0a', `${file} PNG değil`);
    assert.equal(buffer.readUInt32BE(16), Number(size), `${file} genişliği`);
    assert.equal(buffer.readUInt32BE(20), Number(size), `${file} yüksekliği`);
  }
});

test('src altındaki js/css dosyaları web_accessible_resources kapsamında', () => {
  const patterns = manifest.web_accessible_resources.flatMap((resource) => resource.resources).map(globToRegExp);
  const files = listFiles(join(ROOT, 'src'))
    .map((file) => relative(ROOT, file).split(sep).join('/'))
    .filter((file) => /\.(js|css)$/.test(file) && file !== 'src/content/button.css');
  for (const file of files) {
    assert.ok(patterns.some((pattern) => pattern.test(file)), `web_accessible_resources dışında: ${file}`);
  }
});
