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
  const announced = new WeakSet();
  const listeners = { change: new Set(), skipped: new Set() };
  let index = 0;
  let direction = 1;
  let knownPageCount = pageCount;
  let loading = false;
  let blocked = false;
  let emptyStreak = 0;
  let errorKind = null;
  let started = false;
  let disposed = false;
  let firstLoadedPage = page;
  let lastLoadedPage = page;
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
    let added = 0;
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
        added += 1;
      });
    }
    return added;
  }

  /** `start`tan `step` yönünde ilk başarısız olmayan index; geride yoksa -1, ileride yoksa >= length. */
  function playableFrom(start, step) {
    let i = start;
    while (i >= 0 && i < stories.length && stories[i].status === 'failed') i += step;
    return i;
  }

  function forwardFrom(start) {
    return Math.min(playableFrom(Math.max(start, 0), 1), stories.length);
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
    if (loading || blocked || errorKind !== null || !pageSource.hasNext()) return;
    loading = true;
    const requestEpoch = epoch;
    pageSource.next().then(
      (result) => {
        if (disposed || requestEpoch !== epoch) return;
        loading = false;
        knownPageCount = result.count;
        lastLoadedPage = result.page;
        const added = appendEntries(result.entries, result.page);
        emptyStreak = added > 0 ? 0 : emptyStreak + 1;
        if (emptyStreak >= emptyPageLimit) blocked = true;
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

  function moveTo(newIndex, isNavigationMove = false) {
    const oldIdx = index;
    index = newIndex;

    // Check for crossed failed stories (only for navigation moves, not start)
    if (isNavigationMove) {
      const step = newIndex > oldIdx ? 1 : -1;
      const crossedFailed = [];
      if (step > 0) {
        for (let i = oldIdx + 1; i < newIndex; i++) {
          if (stories[i].status === 'failed') crossedFailed.push(stories[i]);
        }
      } else if (step < 0) {
        for (let i = oldIdx - 1; i > newIndex; i--) {
          if (stories[i].status === 'failed') crossedFailed.push(stories[i]);
        }
      }

      // Emit skipped for first unannnounced crossed failed story
      const unannounced = crossedFailed.find(s => !announced.has(s));
      if (unannounced) {
        for (const s of crossedFailed) announced.add(s);
        emit('skipped', unannounced);
      }
    }

    ensureAhead();
    emit('change');
  }

  function start() {
    if (started) return;
    started = true;
    moveTo(forwardFrom(0), false);
  }

  function next() {
    direction = 1;
    moveTo(forwardFrom(index + 1), true);
  }

  function prev() {
    direction = -1;
    const previous = playableFrom(index - 1, -1);
    moveTo(previous >= 0 ? previous : index, true);
  }

  function goTo(target) {
    direction = 1;
    moveTo(forwardFrom(Math.min(target, stories.length)), true);
  }

  /** Sayfa tampondaysa istek atmadan oraya geçer; değilse tamponu o sayfadan yeniden kurar. */
  function goToPage(requested) {
    if (disposed || !Number.isFinite(requested)) return;
    const target = Math.min(Math.max(1, Math.trunc(requested)), Math.max(1, knownPageCount));
    if (target >= firstLoadedPage && target <= lastLoadedPage) {
      // Sayfa görselsizse sonraki sayfaların ilk story'sine geçilir.
      const first = stories.findIndex((story) => story.page >= target);
      direction = 1;
      moveTo(forwardFrom(first === -1 ? stories.length : first), false);
      return;
    }
    epoch += 1;
    jumping = true;
    jumpTarget = target;
    loading = true;
    blocked = false;
    errorKind = null;
    emptyStreak = 0;
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
        index = forwardFrom(0);
        ensureAhead();
      }),
      settle((error) => {
        errorKind = error instanceof PageStructureError ? 'structure' : 'fetch';
        failedJump = target;
      }),
    );
  }

  function markFailed(story) {
    if (disposed || story.status === 'failed') return;
    story.status = 'failed';
    story.resolvedUrl = null;
    if (stories[index] === story) {
      const oldIdx = index;
      const behind = direction < 0 ? playableFrom(index - 1, -1) : -1;
      index = behind >= 0 ? behind : forwardFrom(index + 1);

      // Collect crossed failed stories (including the active story itself)
      const step = index > oldIdx ? 1 : -1;
      const crossedFailed = [story];
      if (step > 0) {
        for (let i = oldIdx + 1; i < index; i++) {
          if (stories[i].status === 'failed') crossedFailed.push(stories[i]);
        }
      } else if (step < 0) {
        for (let i = oldIdx - 1; i > index; i--) {
          if (stories[i].status === 'failed') crossedFailed.push(stories[i]);
        }
      }

      // Mark all crossed failed as announced
      for (const s of crossedFailed) announced.add(s);

      emit('skipped', story);
    }
    ensureAhead();
    emit('change');
  }

  function continueSearching() {
    if (!blocked) return;
    blocked = false;
    emptyStreak = 0;
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
    listeners.skipped.clear();
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
    continueSearching,
    retry,
    dispose,
    on,
    current: () => stories[index] ?? null,
    peek: (offset = 1) => stories[index + offset] ?? null,
    get state() {
      const story = stories[index] ?? null;
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
