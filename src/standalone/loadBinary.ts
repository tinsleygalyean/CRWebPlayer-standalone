/**
 * §2g — loadBinary helper
 *
 * On file:// (Android WebView, desktop file open) fetch() rejects and
 * Cache API always fails.  Use XHR instead.  On https:// use fetch so
 * we can take advantage of the HTTP cache when the user IS online.
 *
 * For batched loads, use loadBinaryBatch() which wraps Promise.allSettled
 * so a single missing asset doesn't strand the loading bar.
 */

export function loadBinary(url: string): Promise<ArrayBuffer> {
  if (window.location.protocol === 'file:') {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'arraybuffer';
      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 0) {
          resolve(xhr.response as ArrayBuffer);
        } else {
          reject(new Error(`XHR failed for ${url}: status ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error(`XHR network error for ${url}`));
      xhr.send();
    });
  }
  return fetch(url).then(r => {
    if (!r.ok) throw new Error(`fetch failed for ${url}: ${r.status}`);
    return r.arrayBuffer();
  });
}

export function loadText(url: string): Promise<string> {
  if (window.location.protocol === 'file:') {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'text';
      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 0) {
          resolve(xhr.responseText);
        } else {
          reject(new Error(`XHR failed for ${url}: status ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error(`XHR network error for ${url}`));
      xhr.send();
    });
  }
  return fetch(url).then(r => {
    if (!r.ok) throw new Error(`fetch failed for ${url}: ${r.status}`);
    return r.text();
  });
}

export function loadJSON<T = unknown>(url: string): Promise<T> {
  return loadText(url).then(text => JSON.parse(text) as T);
}

/**
 * Load multiple URLs in parallel; returns an array of settled results.
 * A failed load does NOT reject the batch — it returns { status: 'rejected', reason }.
 */
export function loadBinaryBatch(urls: string[]): Promise<PromiseSettledResult<ArrayBuffer>[]> {
  return Promise.allSettled(urls.map(url => loadBinary(url)));
}
