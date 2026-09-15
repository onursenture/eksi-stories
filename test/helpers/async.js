/** Dışarıdan çözülebilen söz. */
export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Bekleyen tüm mikro görevler bitene kadar bekler. */
export const flush = () => new Promise((resolve) => setImmediate(resolve));
