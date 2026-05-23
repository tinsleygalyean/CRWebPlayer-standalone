/**
 * Standalone entry point — replaces App.ts for the STANDALONE=true build.
 *
 * Key differences from the default App.ts:
 *  §2c — No service-worker registration on file://
 *  §2a — Firebase init wrapped in Promise.race with 5 s timeout
 *  §2f — All analytics calls are fire-and-forget (no await)
 *  §2e — No window.location.origin use; paths are always relative
 *  §5d — STANDALONE flag tree-shakes GTM / Statsig; inlined firebaseConfig
 *  §3c — Reads ?cr_book=<slug>&cr_lang=<code>; falls back to manifest.json
 */

import { StandaloneBookLoader } from './StandaloneBookLoader';
import { loadJSON } from './loadBinary';
import { FirebaseAnalyticsManager } from '../Analytics/Firebase/FirebaseManager';

export const appVersion: string = 'v0.3.12-standalone';
export const appName: string = 'CRWebPlayer';

// ── §2a: initialise Firebase with a hard 5 s timeout ─────────────────────────
const ANALYTICS_TIMEOUT_MS = 5_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms)
    ),
  ]);
}

let analyticsManager: FirebaseAnalyticsManager | null = null;

// Fire-and-forget — loading must never block on this.
withTimeout(
  Promise.resolve().then(() => {
    analyticsManager = FirebaseAnalyticsManager.getInstance();
    return analyticsManager;
  }),
  ANALYTICS_TIMEOUT_MS
).catch(() => {
  console.warn('[standalone] Firebase Analytics init timed out or failed — continuing without analytics.');
});

// ── §3c: resolve book + language from query params or manifest.json ───────────
interface OnDiskManifest {
  books: Array<{ bookSlug: string; langCode: string }>;
}

async function resolveBookAndLang(): Promise<{ bookSlug: string; langCode: string }> {
  const params = new URLSearchParams(window.location.search);
  const qBook = params.get('cr_book');
  const qLang = params.get('cr_lang');

  if (qBook && qLang) {
    return { bookSlug: qBook, langCode: qLang };
  }

  // Try manifest.json next to index.html (written by the container at extract time)
  try {
    const manifest = await withTimeout(
      loadJSON<OnDiskManifest>('./manifest.json'),
      3_000
    );
    if (manifest.books && manifest.books.length > 0) {
      const target = qBook
        ? manifest.books.find(b => b.bookSlug === qBook) ?? manifest.books[0]
        : manifest.books[0];

      const langEntry = qLang
        ? manifest.books.find(b => b.bookSlug === target.bookSlug && b.langCode === qLang) ?? target
        : target;

      return { bookSlug: langEntry.bookSlug, langCode: langEntry.langCode };
    }
  } catch {
    // manifest.json missing or malformed — fall through to default
  }

  // Hard default: the first book registered in the engine (overridden by the build)
  return { bookSlug: DEFAULT_BOOK_SLUG, langCode: DEFAULT_LANG_CODE };
}

// These constants are replaced at build time by DefinePlugin when building a
// single-book engine.  For the shared engine they stay as empty strings and the
// manifest / query-param path above is required.
declare const __DEFAULT_BOOK_SLUG__: string;
declare const __DEFAULT_LANG_CODE__: string;
const DEFAULT_BOOK_SLUG: string = (typeof __DEFAULT_BOOK_SLUG__ !== 'undefined') ? __DEFAULT_BOOK_SLUG__ : '';
const DEFAULT_LANG_CODE: string = (typeof __DEFAULT_LANG_CODE__ !== 'undefined') ? __DEFAULT_LANG_CODE__ : '';

// ── standalone-only exit button ──────────────────────────────────────────────
// The upstream web player has no exit affordance — in a regular browser tab the
// back button closes the page. When embedded in a native WebView (no browser
// chrome), the standalone build needs an in-page close button. We render an X
// in the top-right corner and post a message that the RN/iOS/Android container
// can intercept to close the WebView. Falls back to window.close() for testing.
//
// Container integration:
//   - React Native (react-native-webview): listen for onMessage with data === 'cr-exit'
//   - iOS WKWebView: implement userContentController:didReceiveScriptMessage:
//     and register the 'crExit' message handler
//   - Android WebView: addJavascriptInterface(obj, 'CrExit') with a postMessage(s) method
function installExitButton(): void {
  if (document.getElementById('cr-standalone-exit')) return;
  const btn = document.createElement('button');
  btn.id = 'cr-standalone-exit';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Close');
  btn.textContent = '\u00d7'; // × multiplication sign
  btn.style.cssText = [
    'position:fixed', 'top:12px', 'right:12px', 'z-index:10000',
    'width:44px', 'height:44px', 'border:none', 'border-radius:50%',
    'background:rgba(0,0,0,0.55)', 'color:#fff',
    'font-size:28px', 'line-height:44px', 'font-family:sans-serif',
    'text-align:center', 'padding:0', 'cursor:pointer',
    'box-shadow:0 2px 6px rgba(0,0,0,0.3)',
    '-webkit-tap-highlight-color:transparent',
  ].join(';');
  btn.addEventListener('click', () => {
    // React Native WebView
    const w = window as unknown as {
      ReactNativeWebView?: { postMessage: (m: string) => void };
      webkit?: { messageHandlers?: { crExit?: { postMessage: (m: string) => void } } };
      CrExit?: { postMessage: (m: string) => void };
    };
    try { w.ReactNativeWebView?.postMessage('cr-exit'); } catch { /* swallow */ }
    try { w.webkit?.messageHandlers?.crExit?.postMessage('cr-exit'); } catch { /* swallow */ }
    try { w.CrExit?.postMessage('cr-exit'); } catch { /* swallow */ }
    // Broadcast for in-app listeners + fallback for plain browser testing
    try { new BroadcastChannel('cr-message-channel').postMessage({ type: 'cr-exit' }); } catch { /* swallow */ }
    try { window.close(); } catch { /* swallow */ }
  });
  document.body.appendChild(btn);
}

// ── §8: wait for DOM ──────────────────────────────────────────────────────────
async function boot(): Promise<void> {
  installExitButton();
  const { bookSlug, langCode } = await resolveBookAndLang();

  if (!bookSlug || !langCode) {
    document.body.innerHTML =
      '<p style="color:red;font-family:sans-serif;padding:24px">' +
      'No book selected. Open index.html?cr_book=&lt;slug&gt;&amp;cr_lang=&lt;code&gt;</p>';
    return;
  }

  console.log(`[standalone] Loading book="${bookSlug}" lang="${langCode}"`);

  // §2f — log session start fire-and-forget
  if (analyticsManager) {
    try {
      analyticsManager.logSessionStartWithPayload({
        app: appName,
        version: appVersion,
        book_name: bookSlug,
        lang: langCode,
      });
    } catch { /* swallow */ }
  }

  const loader = new StandaloneBookLoader(bookSlug, langCode, analyticsManager);
  await loader.load();
}

// §8 — canvas/root must be in DOM before JS runs; we use DOMContentLoaded
// as a safety net, but HtmlWebpackPlugin injects the script at end of <body>
// so the DOM is already ready by the time this executes.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { boot().catch(console.error); });
} else {
  boot().catch(console.error);
}
