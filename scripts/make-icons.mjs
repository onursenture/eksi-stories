import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT_DIR = new URL('../src/icons/', import.meta.url);
const SIZES = [
  { size: 16, padding: 0 },
  { size: 32, padding: 1 },
  { size: 48, padding: 2 },
  { size: 128, padding: 16 },
];
const SAMPLES = 4; // piksel başına 4x4 örnek: kenar yumuşatma

const BACKGROUND = [28, 31, 36];
const RING = [255, 255, 255];
const DOT = [255, 213, 74];

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit derinliği
  header[9] = 6; // RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0; // filtre: yok
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// (u, v) ∈ [0, 1]² → renk ya da null (şeffaf)
function shade(u, v) {
  const corner = 0.22;
  const dx = Math.max(Math.abs(u - 0.5) - (0.5 - corner), 0);
  const dy = Math.max(Math.abs(v - 0.5) - (0.5 - corner), 0);
  if (dx * dx + dy * dy > corner * corner) return null;
  const x = u - 0.5;
  const y = v - 0.5;
  const radius = Math.hypot(x, y);
  if (radius < 0.12) return DOT;
  if (radius > 0.25 && radius < 0.34) {
    const angle = (Math.atan2(y, x) * 180) / Math.PI + 180;
    const inGap = [30, 150, 270].some((center) => Math.abs(((angle - center + 540) % 360) - 180) < 12);
    if (!inGap) return RING;
  }
  return BACKGROUND;
}

function render(size, padding) {
  const rgba = Buffer.alloc(size * size * 4);
  const art = size - padding * 2;
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let covered = 0;
      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const u = (px + (sx + 0.5) / SAMPLES - padding) / art;
          const v = (py + (sy + 0.5) / SAMPLES - padding) / art;
          if (u < 0 || u > 1 || v < 0 || v > 1) continue;
          const color = shade(u, v);
          if (!color) continue;
          red += color[0];
          green += color[1];
          blue += color[2];
          covered += 1;
        }
      }
      if (covered === 0) continue;
      const offset = (py * size + px) * 4;
      rgba[offset] = Math.round(red / covered);
      rgba[offset + 1] = Math.round(green / covered);
      rgba[offset + 2] = Math.round(blue / covered);
      rgba[offset + 3] = Math.round((covered / (SAMPLES * SAMPLES)) * 255);
    }
  }
  return rgba;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const { size, padding } of SIZES) {
  writeFileSync(new URL(`icon-${size}.png`, OUT_DIR), encodePng(size, render(size, padding)));
  console.log(`yazıldı: src/icons/icon-${size}.png`);
}
