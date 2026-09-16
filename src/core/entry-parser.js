import { DEFAULT_AVATAR_URL, EKSI_ORIGIN } from './constants.js';
import { classifyImageLink, imageRefKey } from './image-links.js';

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;
const BBCODE_RESIDUE = /\[\/?(?:url|img)(?:=[^\]]*)?\]/gi;
const LIGHT_DEFAULT_AVATAR = /default-profile-picture-light\.svg$/;

export class PageStructureError extends Error {
  constructor(message = 'başlık sayfası yapısı bulunamadı') {
    super(message);
    this.name = 'PageStructureError';
  }
}

/** Belge bir başlık (ya da tekil entry) sayfası mı? */
export function isTopicPage(doc) {
  return Boolean(doc.querySelector('#title[data-id]') && doc.querySelector('#entry-item-list'));
}

/**
 * @param {Document} doc
 * @returns {{ topic: {id: string, title: string, slug: string}, page: {current: number, count: number}, entries: object[] }}
 */
export function parseTopicPage(doc) {
  const title = doc.querySelector('#title[data-id]');
  const list = doc.querySelector('#entry-item-list');
  if (!title || !list) throw new PageStructureError();

  const pager = doc.querySelector('.pager[data-currentpage][data-pagecount]');
  const current = pager ? toPositiveInt(pager.getAttribute('data-currentpage'), 1) : 1;
  const count = pager ? Math.max(current, toPositiveInt(pager.getAttribute('data-pagecount'), current)) : current;

  return {
    topic: {
      id: title.getAttribute('data-id'),
      title: title.getAttribute('data-title') ?? title.textContent.trim(),
      slug: title.getAttribute('data-slug') ?? '',
    },
    page: { current, count },
    entries: Array.from(list.querySelectorAll(':scope > li[data-id]'), (li) => parseEntry(li)),
  };
}

function parseEntry(li) {
  const id = li.getAttribute('data-id');
  const content = li.querySelector('.content');
  const authorLink = li.querySelector('footer .entry-author');
  const author = li.getAttribute('data-author') ?? authorLink?.textContent.trim() ?? '';
  const images = [];
  const imageAnchors = new Set();
  const seen = new Set();

  for (const anchor of content?.querySelectorAll('a[href]') ?? []) {
    const ref = classifyImageLink(anchor.getAttribute('href'));
    if (!ref) continue;
    imageAnchors.add(anchor);
    const key = imageRefKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    images.push(ref);
  }

  return {
    id,
    author,
    authorUrl: new URL(authorLink?.getAttribute('href') ?? `/biri/${author.replaceAll(' ', '-')}`, EKSI_ORIGIN).href,
    avatarUrl: readAvatarUrl(li),
    date: li.querySelector('footer .entry-date')?.textContent.trim() ?? '',
    permalink: `${EKSI_ORIGIN}/entry/${id}`,
    text: content ? normalizeText(collectText(content, imageAnchors)) : '',
    images,
  };
}

function readAvatarUrl(li) {
  const src = li.querySelector('footer .avatar-container img.avatar')?.getAttribute('src');
  if (!src) return DEFAULT_AVATAR_URL;
  try {
    return new URL(src, EKSI_ORIGIN).href.replace(LIGHT_DEFAULT_AVATAR, 'default-profile-picture-dark.svg');
  } catch {
    return DEFAULT_AVATAR_URL;
  }
}

function collectText(node, skip) {
  let text = '';
  for (const child of node.childNodes) {
    if (child.nodeType === TEXT_NODE) {
      text += child.nodeValue;
    } else if (child.nodeType === ELEMENT_NODE && !skip.has(child)) {
      text += child.nodeName === 'BR' ? '\n' : collectText(child, skip);
    }
  }
  return text;
}

function normalizeText(raw) {
  return raw
    .replace(BBCODE_RESIDUE, '')
    .replace(/[ \t\r\f\v]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function toPositiveInt(value, fallback) {
  const number = Number.parseInt(value ?? '', 10);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
