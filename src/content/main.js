import { isTopicPage, parseTopicPage } from '../core/entry-parser.js';
import { createResolver } from '../core/image-resolver.js';
import { createPageQueue, createPageSource } from '../core/page-source.js';
import { createStoryFeed } from '../core/story-feed.js';
import { openViewer } from '../viewer/viewer.js';

const BUTTON_CLASS = 'eksi-stories-button';
const TOPIC_PATH = /^\/(?:[^/]+--\d+|entry\/\d+)\/?$/;
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Content script giriş noktası; loader.js çağırır. chrome.* API'sine bağımlı değildir.
 * `pageQueue` sekmenin ortak sayfa isteği sırasıdır: story ekranı kapatılıp açılsa da aynı anda tek sayfa istenir.
 * @param {{ cssUrl: string, doc?: Document, fetchImpl?: (url: string, init?: object) => Promise<Response>, navigate?: (url: string) => void, pageQueue?: ReturnType<typeof createPageQueue> }} options
 */
export async function main({
  cssUrl,
  doc = document,
  fetchImpl = (url, init) => globalThis.fetch(url, init),
  navigate = (url) => doc.defaultView.location.assign(url),
  pageQueue = createPageQueue(),
}) {
  if (!isTopicPage(doc)) {
    if (TOPIC_PATH.test(doc.location.pathname)) {
      console.warn('[eksi-stories] başlık sayfası tanınmadı, buton eklenmedi.');
    }
    return;
  }
  const title = doc.querySelector('#title[data-id]');
  if (title.querySelector(`.${BUTTON_CLASS}`)) return;

  const parseHtml = (html) => new doc.defaultView.DOMParser().parseFromString(html, 'text/html');
  const resolver = createResolver({ fetch: fetchImpl, parseHtml });

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
        resolver,
        pageQueue,
        onClose: (lastEntryId) => {
          open = false;
          if (lastEntryId && !scrollToEntry(doc, lastEntryId)) {
            // Entry başka sayfada: ekşi o entry'nin sayfasını açıp ona kaydırır.
            navigate(`${doc.location.origin}${doc.location.pathname}?focusto=${encodeURIComponent(lastEntryId)}`);
            return;
          }
          button.focus({ preventScroll: true });
        },
      });
    } catch (error) {
      open = false;
      console.warn('[eksi-stories] story açılmadı:', error);
    }
  });
}

function startStories({ doc, fetchImpl, cssText, resolver, pageQueue, onClose }) {
  const { topic, page, entries } = parseTopicPage(doc);
  const parseHtml = (html) => new doc.defaultView.DOMParser().parseFromString(html, 'text/html');
  const pageSource = createPageSource({
    fetch: fetchImpl,
    parseHtml,
    baseUrl: doc.location.href,
    current: page.current,
    count: page.count,
    queue: pageQueue,
  });
  const feed = createStoryFeed({ entries, page: page.current, pageCount: page.count, pageSource, resolver });
  openViewer({
    feed,
    topic,
    cssText,
    doc,
    onClose: (lastEntryId) => {
      feed.dispose();
      // Bu oturumun sıradaki sayfa işleri istek atmadan düşer; yeniden açılan oturum aynı sırada bekler.
      pageSource.dispose();
      onClose(lastEntryId);
    },
  });
  feed.start();
}

function createButton(doc, count) {
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = BUTTON_CLASS;
  button.title = 'görselleri story gibi izle';
  button.setAttribute('aria-label', `story gibi izle, bu sayfada ${count} görsel`);

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

/** Entry açık sayfadaysa ona kaydırır ve true döner. */
function scrollToEntry(doc, entryId) {
  const items = doc.querySelectorAll('#entry-item-list > li[data-id]');
  const item = Array.from(items).find((li) => li.getAttribute('data-id') === entryId);
  if (!item) return false;
  item.scrollIntoView?.({ block: 'center' });
  return true;
}
