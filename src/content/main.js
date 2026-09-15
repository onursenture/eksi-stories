import { isTopicPage, parseTopicPage } from '../core/entry-parser.js';
import { createResolver } from '../core/image-resolver.js';
import { createPageSource } from '../core/page-source.js';
import { createStoryFeed } from '../core/story-feed.js';
import { openViewer } from '../viewer/viewer.js';

const BUTTON_CLASS = 'eksi-stories-button';
const TOPIC_PATH = /^\/(?:[^/]+--\d+|entry\/\d+)\/?$/;
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Content script giriş noktası; loader.js çağırır. chrome.* API'sine bağımlı değildir.
 * @param {{ cssUrl: string, doc?: Document, fetchImpl?: (url: string, init?: object) => Promise<Response> }} options
 */
export async function main({ cssUrl, doc = document, fetchImpl = (url, init) => globalThis.fetch(url, init) }) {
  if (!isTopicPage(doc)) {
    if (TOPIC_PATH.test(doc.location.pathname)) {
      console.warn('[eksi-stories] başlık sayfası yapısı tanınmadı; buton eklenmedi.');
    }
    return;
  }
  const title = doc.querySelector('#title[data-id]');
  if (title.querySelector(`.${BUTTON_CLASS}`)) return;

  const { entries } = parseTopicPage(doc);
  const imageCount = entries.reduce((sum, entry) => sum + entry.images.length, 0);
  const button = createButton(doc, imageCount);
  title.append(button);

  let cssText = null;
  let open = false;
  button.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (open) return;
    open = true;
    try {
      cssText ??= await fetchImpl(cssUrl).then((response) => response.text());
      startStories({
        doc,
        fetchImpl,
        cssText,
        onClose: (lastEntryId) => {
          open = false;
          scrollToEntry(doc, lastEntryId);
          button.focus({ preventScroll: true });
        },
      });
    } catch (error) {
      open = false;
      console.warn('[eksi-stories] görüntüleyici açılamadı:', error);
    }
  });
}

function startStories({ doc, fetchImpl, cssText, onClose }) {
  const { topic, page, entries } = parseTopicPage(doc);
  const parseHtml = (html) => new doc.defaultView.DOMParser().parseFromString(html, 'text/html');
  const resolver = createResolver({ fetch: fetchImpl, parseHtml });
  const pageSource = createPageSource({
    fetch: fetchImpl,
    parseHtml,
    baseUrl: doc.location.href,
    current: page.current,
    count: page.count,
  });
  const feed = createStoryFeed({ entries, page: page.current, pageCount: page.count, pageSource, resolver });
  openViewer({
    feed,
    topic,
    cssText,
    doc,
    onClose: (lastEntryId) => {
      feed.dispose();
      onClose(lastEntryId);
    },
  });
  feed.start();
}

function createButton(doc, count) {
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = BUTTON_CLASS;
  button.title = 'bu sayfadan itibaren görselleri story olarak izle';
  button.setAttribute('aria-label', `story olarak izle, bu sayfada ${count} görsel`);

  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  const ring = doc.createElementNS(SVG_NS, 'circle');
  const dot = doc.createElementNS(SVG_NS, 'circle');
  const attributes = [
    [ring, { cx: '8', cy: '8', r: '6.5', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-dasharray': '9 1.2' }],
    [dot, { cx: '8', cy: '8', r: '3', fill: 'currentColor' }],
  ];
  for (const [node, attrs] of attributes) {
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  }
  svg.append(ring, dot);
  button.append(svg, doc.createTextNode(`story · ${count}`));
  return button;
}

function scrollToEntry(doc, entryId) {
  if (!entryId) return;
  const items = doc.querySelectorAll('#entry-item-list > li[data-id]');
  const item = Array.from(items).find((li) => li.getAttribute('data-id') === entryId);
  item?.scrollIntoView?.({ block: 'center' });
}
