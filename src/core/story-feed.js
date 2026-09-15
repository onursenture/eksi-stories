import { EMPTY_PAGE_LIMIT, FETCH_AHEAD_THRESHOLD, RESOLVE_LOOKAHEAD } from './constants.js';
import { PageStructureError } from './entry-parser.js';

/**
 * Entry'leri story tamponuna çevirir; gezinme, önden çözümleme ve ileri sayfa okuma politikasını yürütür.
 * `index === stories.length` konumu "sonun ötesi"dir: viewer burada bitiş, yükleniyor ya da hata kartı gösterir.
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
    pageSource.next().then(
      (result) => {
        if (disposed) return;
        loading = false;
        knownPageCount = result.count;
        const added = appendEntries(result.entries, result.page);
        emptyStreak = added > 0 ? 0 : emptyStreak + 1;
        if (emptyStreak >= emptyPageLimit) blocked = true;
        ensureAhead();
        emit('change');
      },
      (error) => {
        if (disposed) return;
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
    moveTo(forwardFrom(0));
  }

  function next() {
    direction = 1;
    moveTo(forwardFrom(index + 1));
  }

  function prev() {
    direction = -1;
    const previous = playableFrom(index - 1, -1);
    moveTo(previous >= 0 ? previous : index);
  }

  function goTo(target) {
    direction = 1;
    moveTo(forwardFrom(Math.min(target, stories.length)));
  }

  function markFailed(story) {
    if (disposed || story.status === 'failed') return;
    story.status = 'failed';
    story.resolvedUrl = null;
    if (stories[index] === story) {
      const behind = direction < 0 ? playableFrom(index - 1, -1) : -1;
      index = behind >= 0 ? behind : forwardFrom(index + 1);
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

  return {
    start,
    next,
    prev,
    goTo,
    markFailed,
    continueSearching,
    retry,
    dispose,
    on,
    current: () => stories[index] ?? null,
    peek: (offset = 1) => stories[index + offset] ?? null,
    get state() {
      return {
        index,
        length: stories.length,
        pageCount: knownPageCount,
        loading,
        blocked,
        errorKind,
        ended: index >= stories.length && !loading && !blocked && errorKind === null && !pageSource.hasNext(),
      };
    },
  };
}
