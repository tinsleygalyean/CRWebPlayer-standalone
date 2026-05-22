// Main Entry for the Curious Reader Web Player App
import { ContentParser } from "./src/Parser/ContentParser";
import { PlayBackEngine } from "./src/PlayBackEngine/PlayBackEngine";
import { Workbox } from "workbox-window";
import { Book } from "./src/Models/Models";
import { FirebaseAnalyticsManager } from "./src/Analytics/Firebase/FirebaseManager";
import { campaignId, campaignSource, crUserId } from "./src/common";
import { BookLoader, CrBookLoader } from "./src/Books/BookLoader";
import { GdlBookLoader } from "./src/Books/GdlBookLoader";

export let appVersion: string = "v0.3.12";
export let appName: string = "CRWebPlayer";

let loadingScreen = document.getElementById("loadingScreen");

let sessionStartTime: Date = new Date();
let logged25PercentDownload: boolean = false;
let logged50PercentDownload: boolean = false;
let logged75PercentDownload: boolean = false;
let logged100PercentDownload: boolean = false;

export let firebaseAnalyticsManager: FirebaseAnalyticsManager = FirebaseAnalyticsManager.getInstance();

export class App {
  public bookName: string;
  public contentParser: ContentParser;
  public playBackEngine: PlayBackEngine;
  public contentFilePath: string;
  public imagesPath: string;
  public audioPath: string;
  public broadcastChannel: BroadcastChannel;
  public lang: string;

  constructor(bookName: string, contentFilePath: string, imagesPath: string, audioPath: string) {
    console.log("Curious Reader App " + appVersion + " initializing!");
    this.bookName = bookName;
    this.contentFilePath = contentFilePath;
    this.imagesPath = imagesPath;
    this.audioPath = audioPath;
    // §2f — fire-and-forget; no await in the critical path
    try {
      firebaseAnalyticsManager.logSessionStartWithPayload({
        app: appName,
        version: appVersion,
        cr_user_id: crUserId,
        source: campaignSource,
        campaignId: campaignId,
        book_name: bookName
      });
    } catch { /* swallow — analytics must never block boot */ }
    sessionStartTime = new Date();
    this.contentParser = new ContentParser(contentFilePath);
    this.playBackEngine = new PlayBackEngine(imagesPath, audioPath);
    this.broadcastChannel = new BroadcastChannel("cr-message-channel");
  }

  /**
   * Standard (online) initialization path — registers a service worker for
   * progressive caching.  Not used in the STANDALONE build.
   */
  async initialize() {
    try {
      const book = await this.contentParser.parseBook();
      book.bookName = this.bookName;
      console.log("App initialized with book:", book);
      this.enforceLandscapeMode();
      await this.registerServiceWorker(book);
      this.playBackEngine.initializeBook(book);
      console.log("Initialization completed successfully!");
    } catch (error) {
      console.error("Initialization error:", error);
    }
  }

  /**
   * §2c — Standalone (offline / file://) initialization path.
   *
   * Key differences from initialize():
   *  - Never registers a service worker.
   *  - Dismisses the loading screen immediately after the book is parsed
   *    (no async download progress from a SW).
   *  - Safe to call on file:// protocol; no fetch(), no Cache API.
   */
  async initializeStandalone() {
    try {
      if (loadingScreen) loadingScreen.style.display = "flex";

      const book = await this.contentParser.parseBook();
      book.bookName = this.bookName;
      console.log("[standalone] Book parsed:", book);

      this.enforceLandscapeMode();

      // No service-worker — dismiss loading screen immediately.
      if (loadingScreen) loadingScreen.style.display = "none";

      this.playBackEngine.initializeBook(book);

      // Mark as cached so subsequent launches skip the loading screen.
      try { localStorage.setItem(this.bookName, "true"); } catch { /* ignore */ }

      console.log("[standalone] Initialization completed successfully!");
    } catch (error) {
      console.error("[standalone] Initialization error:", error);
      if (loadingScreen) {
        loadingScreen.innerHTML =
          '<p style="color:red;padding:16px;font-family:sans-serif">' +
          "Failed to load book content. " + String(error) + "</p>";
      }
    }
  }

  enforceLandscapeMode() {
    // @ts-ignore
    if (window.Android && typeof window.Android.setContainerAppOrientation === "function") {
      // @ts-ignore
      window.Android.setContainerAppOrientation("landscape");
    }
  }

  async registerServiceWorker(book: Book) {
    // §2c — skip service-worker registration on file://
    if (window.location.protocol === 'file:') {
      console.log("[App] Skipping service-worker registration on file:// protocol.");
      if (loadingScreen) loadingScreen.style.display = "none";
      return;
    }

    if ("serviceWorker" in navigator) {
      try {
        let wb = new Workbox("/sw.js", {});
        await wb.register();
        await navigator.serviceWorker.ready;
        if (localStorage.getItem(book.bookName) == null) {
          loadingScreen!.style.display = "flex";
          this.broadcastChannel.postMessage({
            command: "Cache",
            data: {
              lang: this.lang,
              bookData: book,
              contentFile: this.contentFilePath,
            },
          });
        } else {
          loadingScreen!.style.display = "none";
        }

        this.broadcastChannel.onmessage = (event) => {
          console.log(event.data.command);
          if (event.data.command == "Activated") {
            this.broadcastChannel.postMessage({
              command: "Cache",
              data: {
                lang: this.lang,
                bookData: book,
                contentFile: this.contentFilePath,
              },
            });
          }
          if (event.data.command == "CachingProgress") {
            let progressValue = parseInt(event.data.data.progress);
            handleLoadingMessage(event, progressValue);
          }
          if (event.data.command == "UpdateFound") {
            handleUpdateFoundMessage();
          }
        };
      } catch (error) {
        console.log("Error Registering Service Worker", error);
      }
    }
  }
}

export function handleLoadingMessage(event, progressValue): void {
  let progressBar = document.getElementById("progressBar");
  if (progressValue < 100) {
    progressBar!.style.width = progressValue + "%";
  }

  if (progressValue >= 25 && !logged25PercentDownload) {
    logged25PercentDownload = true;
    logDownloadProgressWithPayloadToFirebase("download_25", event.data.data.bookName);
  }
  if (progressValue >= 50 && !logged50PercentDownload) {
    logged50PercentDownload = true;
    logDownloadProgressWithPayloadToFirebase("download_50", event.data.data.bookName);
  }
  if (progressValue >= 75 && !logged75PercentDownload) {
    logged75PercentDownload = true;
    logDownloadProgressWithPayloadToFirebase("download_75", event.data.data.bookName);
  }
  if (progressValue >= 100) {
    loadingScreen!.style.display = "none";
    if (!logged100PercentDownload) {
      logged100PercentDownload = true;
      logDownloadProgressWithPayloadToFirebase("download_completed", event.data.data.bookName);
    }
    localStorage.setItem(event.data.data.bookName, "true");
    readLanguageDataFromCacheAndNotifyAndroidApp(event.data.data.bookName);
  }
}

export function logDownloadProgressWithPayloadToFirebase(eventName: string, bookName: string): void {
  if (!sessionStartTime) sessionStartTime = new Date();
  let timeSpent = new Date().getTime() - sessionStartTime.getTime();
  // §2f — fire-and-forget
  try {
    firebaseAnalyticsManager.logDownloadProgressWithPayload(eventName, {
      app: appName,
      version: appVersion,
      book_name: bookName,
      cr_user_id: crUserId,
      ms_since_session_start: timeSpent,
    });
  } catch { /* swallow */ }
}

export function readLanguageDataFromCacheAndNotifyAndroidApp(bookName: string) {
  // @ts-ignore
  if (window.Android) {
    let isContentCached: boolean = localStorage.getItem(bookName) !== null;
    // @ts-ignore
    window.Android.cachedStatus(isContentCached);
  }
}

export function handleUpdateFoundMessage(): void {
  let text = "Update Found.\nPlease accept the update by pressing Ok.";
  if (confirm(text) == true) {
    window.location.reload();
  }
}

function createBookLoader(bookName: string) {
  if (bookName.startsWith("gdl-")) {
    return new GdlBookLoader(bookName);
  }
  return new CrBookLoader(bookName);
}

// ── Default (non-standalone) boot ────────────────────────────────────────────
// This block only runs when App.ts is used as the webpack entry (non-standalone
// build).  The STANDALONE build uses src/standalone/standalone-entry.ts instead
// and never reaches this code.
if (typeof STANDALONE === 'undefined' || !STANDALONE) {
  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);
  let bookName = urlParams.get("book");

  const defaultBookName: string = "LetsFlyLevel2En";
  if (bookName == null) bookName = defaultBookName;

  console.log("Book Name: " + bookName);

  const loader: BookLoader = createBookLoader(bookName);
  loader.load();
}

// Make STANDALONE a typed global so TS doesn't error when we reference it above.
declare const STANDALONE: boolean | undefined;
