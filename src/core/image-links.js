import { EKSI_ORIGIN } from './constants.js';

const EKSI_HOSTS = new Set(['eksisozluk.com', 'www.eksisozluk.com']);
const IMAGE_ID = /^[A-Za-z0-9]+$/;
const IMAGE_EXTENSION = /\.(?:jpe?g|png|gif|webp)$/i;

/**
 * Entry içindeki bir link adresini görsel referansına çevirir.
 * @param {string} href Göreli ya da mutlak adres
 * @returns {{kind: 'eksi', id: string, sourceHref: string} | {kind: 'direct', url: string, sourceHref: string} | null}
 */
export function classifyImageLink(href) {
  let url;
  try {
    url = new URL(href, EKSI_ORIGIN);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean);
  const isImagePath = (prefix) => segments.length === 2 && segments[0] === prefix && IMAGE_ID.test(segments[1]);

  if ((host === 'soz.lk' && isImagePath('i')) || (EKSI_HOSTS.has(host) && isImagePath('img'))) {
    return { kind: 'eksi', id: segments[1], sourceHref: href };
  }
  if (IMAGE_EXTENSION.test(url.pathname)) {
    return { kind: 'direct', url: url.href, sourceHref: href };
  }
  return null;
}

/** Aynı görseli bir entry içinde iki kez göstermemek ve önbellek için anahtar. */
export function imageRefKey(ref) {
  return ref.kind === 'eksi' ? `eksi:${ref.id}` : `direct:${ref.url}`;
}
