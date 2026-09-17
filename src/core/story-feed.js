import { EMPTY_PAGE_LIMIT, FETCH_AHEAD_THRESHOLD, RESOLVE_LOOKAHEAD } from './constants.js';
import { PageStructureError } from './entry-parser.js';

/**
 * Entry'leri story tamponuna çevirir; gezinme, önden çözümleme, ileri sayfa okuma ve sayfa atlama politikasını yürütür.
 * `index === stories.length` konumu "sonun ötesi"dir: viewer burada bitiş, yükleniyor ya da hata kartı gösterir.
 * Tampon `firstLoadedPage` ile `lastLoadedPage` arasındaki ardışık sayfaların story'lerini tutar.
 */
export function createStoryFeed({
  entries,
  page,
  pageCount,
  pageSource,
  resolver,
  lookahead = RESOLVE_LOOKAHEAD,
  fetchAheadThreshold = FETCH_AHEAD_THRESHOLD,
  emptyPageLimit = EMPTY_PAGE_LIMIT,
}) {
  const stories = [];
  const seenEntryIds = new Set();
  const resolving = new WeakSet();
  const listeners = { change: new Set() };
  let index = 0;
  let knownPageCount = pageCount;
  let loading = false;
  let errorKind = null;
  let started = false;
  let disposed = false;
  let firstLoadedPage = page;
  let lastLoadedPage = page;
  // Önden okuma sınırı bu iki sayfanın büyüğünden sayılır: sayımın başladığı sayfa ve görseli açılan en ileri sayfa (henüz yoksa 0).
  let searchFromPage = page;
  let lastOpenedPage = 0;
  // Her sayfa atlamasında artar; atlamadan önce başlamış arka plan yüklemesinin sonucu yok sayılır.
  let epoch = 0;
  let jumping = false;
  let jumpTarget = null;
  let jumpInFlight = false;
  let failedJump = null;

  appendEntries(entries, page);

  function emit(event, payload) {
    if (disposed) return;
    for (const listener of [...listeners[event]]) listener(payload);
  }

  function appendEntries(list, pageNumber) {
    for (const entry of list) {
      if (seenEntryIds.has(entry.id)) continue;
      seenEntryIds.add(entry.id);
      entry.images.forEach((ref, imageIndex) => {
        stories.push({
          entry,
          page: pageNumber,
          imageIndex,
          imageCount: entry.images.length,
          ref,
          resolvedUrl: null,
          status: 'pending',
        });
      });
    }
  }

  /** Son açılan görselin (yoksa sayımın başladığı) sayfasından sonra `emptyPageLimit` sayfa yüklendiyse önden okuma durur. */
  function searchLimitReached() {
    return lastLoadedPage - Math.max(searchFromPage, lastOpenedPage) >= emptyPageLimit;
  }

  /** Önden okuma sınırda durdu ama başlıkta sonraki sayfa var; "aramaya devam" beklenir. */
  function isBlocked() {
    return pageSource.hasNext() && searchLimitReached();
  }

  function resolveStory(story) {
    if (story.status !== 'pending' || resolving.has(story)) return;
    resolving.add(story);
    resolver.resolve(story.ref).then(
      (url) => {
        if (disposed || story.status !== 'pending') return;
        story.resolvedUrl = url;
        story.status = 'ready';
        emit('change');
      },
      () => markFailed(story),
    );
  }

  function fetchNextPage() {
    if (loading || errorKind !== null || !pageSource.hasNext() || searchLimitReached()) return;
    loading = true;
    const requestEpoch = epoch;
    pageSource.next().then(
      (result) => {
        if (disposed || requestEpoch !== epoch) return;
        loading = false;
        knownPageCount = result.count;
        lastLoadedPage = result.page;
        appendEntries(result.entries, result.page);
        ensureAhead();
        emit('change');
      },
      (error) => {
        if (disposed || requestEpoch !== epoch) return;
        loading = false;
        errorKind = error instanceof PageStructureError ? 'structure' : 'fetch';
        emit('change');
      },
    );
  }

  function ensureAhead() {
    if (disposed || !started) return;
    const end = Math.min(stories.length, index + 1 + lookahead);
    for (let i = index; i < end; i += 1) resolveStory(stories[i]);
    if (stories.length - index - 1 < fetchAheadThreshold) fetchNextPage();
  }

  function moveTo(newIndex) {
    index = newIndex;
    ensureAhead();
    emit('change');
  }

  function start() {
    if (started) return;
    started = true;
    moveTo(0);
  }

  function next() {
    moveTo(Math.min(index + 1, stories.length));
  }

  function prev() {
    moveTo(Math.max(index - 1, 0));
  }

  function goTo(target) {
    moveTo(Math.min(Math.max(target, 0), stories.length));
  }

  /** Sayfa tampondaysa istek atmadan oraya geçer; değilse tamponu o sayfadan yeniden kurar. */
  function goToPage(requested) {
    if (disposed || !Number.isFinite(requested)) return;
    const target = Math.min(Math.max(1, Math.trunc(requested)), Math.max(1, knownPageCount));
    if (target >= firstLoadedPage && target <= lastLoadedPage) {
      // Sayfa görselsizse sonraki sayfaların ilk story'sine geçilir.
      const first = stories.findIndex((story) => story.page >= target);
      moveTo(first === -1 ? stories.length : first);
      return;
    }
    epoch += 1;
    jumping = true;
    jumpTarget = target;
    loading = true;
    errorKind = null;
    searchFromPage = target;
    lastOpenedPage = 0;
    failedJump = null;
    stories.length = 0;
    seenEntryIds.clear();
    index = 0;
    firstLoadedPage = target;
    lastLoadedPage = target - 1;
    emit('change');
    if (!jumpInFlight) runJump();
  }

  /** Aynı anda tek atlama isteği; beklerken başka sayfa seçildiyse biten istekten sonra en son seçilen yüklenir. */
  function runJump() {
    const target = jumpTarget;
    jumpInFlight = true;
    const settle = (apply) => (value) => {
      jumpInFlight = false;
      if (disposed) return;
      if (target !== jumpTarget) {
        runJump();
        return;
      }
      jumping = false;
      loading = false;
      apply(value);
      emit('change');
    };
    pageSource.load(target).then(
      settle((result) => {
        knownPageCount = result.count;
        lastLoadedPage = result.page;
        appendEntries(result.entries, result.page);
        index = 0;
        ensureAhead();
      }),
      settle((error) => {
        errorKind = error instanceof PageStructureError ? 'structure' : 'fetch';
        failedJump = target;
      }),
    );
  }

  /** Görseli açılmayan story atlanmaz: aktifse yerinde kalır, görüntüleyici onu story süresince gösterip geçer. */
  function markFailed(story) {
    if (disposed || story.status === 'failed') return;
    story.status = 'failed';
    story.resolvedUrl = null;
    ensureAhead();
    emit('change');
  }

  /** Görüntüleyici aktif story'nin görseli açılınca çağırır; önden okuma sınırı bu görselin sayfasından yeniden sayılır. */
  function markOpened(story) {
    if (disposed || stories[index] !== story || story.page <= lastOpenedPage) return;
    lastOpenedPage = story.page;
    ensureAhead();
    emit('change');
  }

  function continueSearching() {
    if (!isBlocked()) return;
    searchFromPage = lastLoadedPage;
    ensureAhead();
    emit('change');
  }

  function retry() {
    if (errorKind !== 'fetch') return;
    if (failedJump !== null) {
      goToPage(failedJump);
      return;
    }
    errorKind = null;
    ensureAhead();
    emit('change');
  }

  function dispose() {
    disposed = true;
    listeners.change.clear();
  }

  function on(event, listener) {
    listeners[event].add(listener);
    return () => listeners[event].delete(listener);
  }

  /** Aktif story'nin kendi sayfasındaki sırası ve o sayfanın tampondaki story sayısı. */
  function pageCounter(story) {
    if (!story) return { pagePosition: null, pageStoryCount: null };
    let pagePosition = 0;
    let pageStoryCount = 0;
    stories.forEach((other, i) => {
      if (other.page !== story.page) return;
      pageStoryCount += 1;
      if (i <= index) pagePosition += 1;
    });
    return { pagePosition, pageStoryCount };
  }

  function currentPage(story) {
    if (story) return story.page;
    if (jumping) return jumpTarget;
    return failedJump ?? lastLoadedPage;
  }

  return {
    start,
    next,
    prev,
    goTo,
    goToPage,
    markFailed,
    markOpened,
    continueSearching,
    retry,
    dispose,
    on,
    current: () => stories[index] ?? null,
    peek: (offset = 1) => stories[index + offset] ?? null,
    get state() {
      const story = stories[index] ?? null;
      const blocked = isBlocked();
      return {
        index,
        length: stories.length,
        page: currentPage(story),
        ...pageCounter(story),
        pageCount: knownPageCount,
        loading,
        jumping,
        blocked,
        errorKind,
        ended: index >= stories.length && !loading && !blocked && errorKind === null && !pageSource.hasNext(),
      };
    },
  };
}
