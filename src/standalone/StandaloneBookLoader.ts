/**
 * Standalone book loader — replaces CrBookLoader for the STANDALONE=true build.
 *
 * Path layout (after three ZIPs are extracted into the same directory):
 *
 *   index.html
 *   crwebplayer.js
 *   books/
 *     <bookSlug>/
 *       book.json                    ← book-level metadata
 *       images/                      ← illustrations (from Book ZIP)
 *       lang/
 *         <langCode>/
 *           text.json                ← content.json renamed (from Language ZIP)
 *           audios/                  ← narration audio (from Language ZIP)
 *           fonts/                   ← optional per-language fonts
 *
 * §2g — all asset loads use loadBinary (XHR on file://, fetch on https://)
 * §2e — all paths are relative; never window.location.origin
 */

import { App } from '../../App';
import { FirebaseAnalyticsManager } from '../Analytics/Firebase/FirebaseManager';

export class StandaloneBookLoader {
  private bookSlug: string;
  private langCode: string;
  private analytics: FirebaseAnalyticsManager | null;

  constructor(bookSlug: string, langCode: string, analytics: FirebaseAnalyticsManager | null) {
    this.bookSlug = bookSlug;
    this.langCode = langCode;
    this.analytics = analytics;
  }

  async load(): Promise<void> {
    const { bookSlug, langCode } = this;

    // All paths are relative to index.html — no leading slash (§2d)
    const contentFilePath = `./books/${bookSlug}/lang/${langCode}/text.json`;
    const imagesPath      = `./books/${bookSlug}/images/`;
    const audioPath       = `./books/${bookSlug}/lang/${langCode}/audios/`;

    const app = new App(
      `${bookSlug}::${langCode}`,
      contentFilePath,
      imagesPath,
      audioPath
    );

    // Expose lang to App so it can pass it to the service-worker cache key.
    // In standalone mode the service worker is never registered, but App.lang
    // is read in the loading-progress handler — set it to avoid undefined.
    (app as any).lang = langCode;

    await app.initializeStandalone();
  }
}
