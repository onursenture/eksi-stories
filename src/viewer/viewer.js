import {
  EMPTY_PAGE_LIMIT,
  HOLD_THRESHOLD_MS,
  LEFT_TAP_RATIO,
  STORY_DURATION_MS,
  TOAST_MS,
} from '../core/constants.js';

const INTERACTIVE_SELECTOR = 'a, button, .es-caption, .es-card';

/**
 * Tam ekran story görüntüleyicisini açar. Durum feed'dedir; viewer yalnızca çizer ve girdi toplar.
 * @param {{ feed: object, topic: { title: string }, cssText: string, onClose?: (lastEntryId: string | null) => void, doc?: Document }} options
 * @returns {{ close: () => void }}
 */
export function openViewer({ feed, topic, cssText, onClose, doc = document }) {
  const win = doc.defaultView;
  const el = (tag, attrs = {}, children = []) => {
    const node = doc.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'text') node.textContent = value;
      else node.setAttribute(key, value);
    }
    node.append(...children);
    return node;
  };

  // --- DOM ---
  const progress = el('div', { class: 'es-progress' });
  const author = el('a', { class: 'es-author', target: '_blank', rel: 'noopener' });
  const date = el('span', { class: 'es-date' });
  const permalink = el('a', { class: 'es-permalink', target: '_blank', rel: 'noopener', text: "entry'ye git" });
  const pageInfo = el('span', { class: 'es-page' });
  const pausedBadge = el('span', { class: 'es-paused', title: 'duraklatıldı', text: '❚❚' });
  const closeButton = el('button', { class: 'es-close', type: 'button', 'aria-label': 'kapat', text: '✕' });
  const top = el('div', { class: 'es-top' }, [
    progress,
    el('div', { class: 'es-meta' }, [author, date, permalink, el('span', { class: 'es-spacer' }), pageInfo, pausedBadge, closeButton]),
  ]);
  const image = el('img', { class: 'es-image', alt: '', draggable: 'false' });
  const caption = el('div', { class: 'es-caption' });
  const frame = el('div', { class: 'es-frame' }, [image, top, caption]);
  const spinner = el('div', { class: 'es-spinner', role: 'progressbar', 'aria-label': 'yükleniyor' });
  const cardSpinner = el('div', { class: 'es-spinner', 'aria-hidden': 'true' });
  const cardText = el('p', { class: 'es-card-text' });
  const cardActions = el('div', { class: 'es-card-actions' });
  const card = el('div', { class: 'es-card' }, [cardSpinner, cardText, cardActions]);
  const stage = el('div', { class: 'es-stage' }, [frame, spinner, card]);
  const backdrop = el('img', { class: 'es-backdrop', alt: '', 'aria-hidden': 'true' });
  const toast = el('div', { class: 'es-toast', role: 'status' });
  const root = el('div', {
    class: 'es-root',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': `story görüntüleyici: ${topic.title}`,
    tabindex: '-1',
  }, [backdrop, stage, toast]);
  root.style.setProperty('--es-duration', `${STORY_DURATION_MS}ms`);
  for (const node of [pausedBadge, spinner, card, toast]) node.hidden = true;

  const host = doc.createElement('eksi-stories-viewer');
  host.attachShadow({ mode: 'open' }).append(el('style', { text: cssText }), root);
  const preloader = doc.createElement('img');

  // --- durum ---
  const pauseReasons = new Set();
  let shownKey = null;
  let loadingUrl = null;
  let imageLoaded = false;
  let lastEntryId = null;
  let expanded = false;
  let cardKey = null;
  let pressTimer = null;
  let held = false;
  let toastTimer = null;
  let closed = false;

  const storyKey = (story) => `${story.entry.id}:${story.imageIndex}`;
  const referrerPolicyFor = (story) => (story.ref.kind === 'direct' ? 'no-referrer' : '');
  const isOnControl = (event, selector) =>
    event.composedPath().some((node) => node.nodeType === 1 && node.matches(selector));

  function setPaused(reason, paused) {
    if (paused) pauseReasons.add(reason);
    else pauseReasons.delete(reason);
    const isPaused = pauseReasons.size > 0;
    root.classList.toggle('is-paused', isPaused);
    pausedBadge.hidden = !isPaused;
  }

  function setExpanded(value) {
    expanded = value;
    caption.classList.toggle('is-expanded', value);
    setPaused('caption', value);
  }

  function renderProgress(story, running) {
    const segments = [];
    for (let i = 0; i < story.imageCount; i += 1) {
      const segment = el('div', { class: 'es-seg' }, [el('div', { class: 'es-seg-fill' })]);
      if (i < story.imageIndex) segment.classList.add('is-done');
      if (i === story.imageIndex && running) segment.classList.add('is-active');
      segments.push(segment);
    }
    progress.replaceChildren(...segments);
  }

  function showStory(story, key) {
    shownKey = key;
    loadingUrl = null;
    imageLoaded = false;
    lastEntryId = story.entry.id;
    image.removeAttribute('src');
    frame.classList.add('is-loading');
    author.textContent = story.entry.author;
    author.href = story.entry.authorUrl;
    date.textContent = story.entry.date;
    permalink.href = story.entry.permalink;
    caption.textContent = story.entry.text;
    caption.hidden = story.entry.text === '';
    setExpanded(false);
    renderProgress(story, false);
  }

  function preloadNext() {
    const upcoming = feed.peek(1);
    if (upcoming?.status !== 'ready') return;
    preloader.referrerPolicy = referrerPolicyFor(upcoming);
    preloader.src = upcoming.resolvedUrl;
  }

  function loadImage(story, key) {
    const url = story.resolvedUrl;
    loadingUrl = url;
    image.referrerPolicy = referrerPolicyFor(story);
    image.onload = () => {
      if (closed || shownKey !== key || loadingUrl !== url) return;
      imageLoaded = true;
      frame.classList.remove('is-loading');
      spinner.hidden = true;
      backdrop.referrerPolicy = referrerPolicyFor(story);
      backdrop.src = url;
      renderProgress(story, true);
      preloadNext();
    };
    image.onerror = () => {
      if (closed || shownKey !== key || loadingUrl !== url) return;
      feed.markFailed(story);
    };
    image.src = url;
  }

  function actionButton(label, onClick) {
    const button = el('button', { type: 'button', text: label });
    button.addEventListener('click', onClick);
    return button;
  }

  function renderCard(state) {
    shownKey = null;
    frame.hidden = true;
    spinner.hidden = true;
    card.hidden = false;
    cardSpinner.hidden = !state.loading;
    backdrop.removeAttribute('src');

    let text;
    const actions = [];
    if (state.loading) {
      text = 'sonraki sayfa aranıyor…';
    } else if (state.blocked) {
      text = `sonraki ${EMPTY_PAGE_LIMIT} sayfada görsel yok`;
      actions.push(actionButton('devam ara', () => feed.continueSearching()));
    } else if (state.errorKind === 'fetch') {
      text = 'sonraki sayfa alınamadı';
      actions.push(actionButton('tekrar dene', () => feed.retry()));
    } else if (state.errorKind === 'structure') {
      text = 'devam edilemedi';
    } else if (state.length === 0) {
      text = 'görsel bulunamadı';
    } else {
      text = 'başlığın sonuna geldin';
      actions.push(actionButton('başa dön', () => feed.goTo(0)));
    }
    if (cardKey === text) return;
    cardKey = text;
    actions.push(actionButton('kapat', close));
    cardText.textContent = text;
    cardActions.replaceChildren(...actions);
  }

  function render() {
    if (closed) return;
    const story = feed.current();
    const state = feed.state;
    if (!story) {
      renderCard(state);
      return;
    }
    cardKey = null;
    card.hidden = true;
    frame.hidden = false;
    const key = storyKey(story);
    if (key !== shownKey) showStory(story, key);
    if (story.status === 'ready' && loadingUrl !== story.resolvedUrl) loadImage(story, key);
    spinner.hidden = imageLoaded;
    pageInfo.textContent = `sayfa ${story.page}/${state.pageCount}`;
    if (imageLoaded) preloadNext();
  }

  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    win.clearTimeout(toastTimer);
    toastTimer = win.setTimeout(() => {
      toast.hidden = true;
    }, TOAST_MS);
  }

  // --- girdiler ---
  function onPointerDown(event) {
    if (event.button !== 0 || isOnControl(event, INTERACTIVE_SELECTOR)) return;
    stage.setPointerCapture?.(event.pointerId);
    held = false;
    win.clearTimeout(pressTimer);
    pressTimer = win.setTimeout(() => {
      held = true;
      setPaused('hold', true);
    }, HOLD_THRESHOLD_MS);
  }

  function onPointerUp(event) {
    if (pressTimer === null) return;
    win.clearTimeout(pressTimer);
    pressTimer = null;
    if (held) {
      held = false;
      setPaused('hold', false);
      return;
    }
    if (event.clientX / Math.max(1, stage.clientWidth) < LEFT_TAP_RATIO) feed.prev();
    else feed.next();
  }

  function onPointerCancel() {
    win.clearTimeout(pressTimer);
    pressTimer = null;
    if (held) {
      held = false;
      setPaused('hold', false);
    }
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') close();
    else if (event.key === 'ArrowRight') feed.next();
    else if (event.key === 'ArrowLeft') feed.prev();
    else if (event.key === ' ' && !isOnControl(event, 'a, button')) {
      if (!event.repeat) setPaused('user', !pauseReasons.has('user'));
    } else return;
    event.preventDefault();
    event.stopPropagation();
  }

  const onVisibilityChange = () => setPaused('hidden', doc.hidden);

  function close() {
    if (closed) return;
    closed = true;
    offChange();
    offSkipped();
    win.removeEventListener('keydown', onKeyDown, true);
    doc.removeEventListener('visibilitychange', onVisibilityChange);
    win.clearTimeout(pressTimer);
    win.clearTimeout(toastTimer);
    image.onload = null;
    image.onerror = null;
    host.remove();
    doc.documentElement.style.overflow = previousOverflow;
    onClose?.(lastEntryId);
  }

  stage.addEventListener('pointerdown', onPointerDown);
  stage.addEventListener('pointerup', onPointerUp);
  stage.addEventListener('pointercancel', onPointerCancel);
  caption.addEventListener('click', () => setExpanded(!expanded));
  closeButton.addEventListener('click', close);
  progress.addEventListener('animationend', (event) => {
    if (event.animationName === 'es-fill') feed.next();
  });
  win.addEventListener('keydown', onKeyDown, true);
  doc.addEventListener('visibilitychange', onVisibilityChange);
  const offChange = feed.on('change', render);
  const offSkipped = feed.on('skipped', () => showToast('görsel yüklenemedi, atlandı'));

  const previousOverflow = doc.documentElement.style.overflow;
  doc.documentElement.style.overflow = 'hidden';
  doc.body.append(host);
  root.focus({ preventScroll: true });
  render();

  return { close };
}
