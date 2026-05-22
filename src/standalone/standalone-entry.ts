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

// ── §8: wait for DOM ──────────────────────────────────────────────────────────
async function boot(): Promise<void> {
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
