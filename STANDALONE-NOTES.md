# CRWebPlayer Standalone Build — Notes

## 1. Engine version

`v0.3.12-standalone` — see `App.ts` and `webpack.standalone.config.js`.

The build embeds a `BUILD_INFO` constant in `crwebplayer.js` via webpack `DefinePlugin`
so the container can surface it in Settings → Debug.

---

## 2. Books and languages included

All (book, language) pairs present in `BookContent/` at build time.  
See `dist/standalone/manifest.csv` for the exact list with file sizes and SHA-256 hashes.

Current catalog: 27 books × ~8–11 languages = ~150 ZIPs.  
Run `node scripts/build-all-standalone.js --book <slug>` to build a single book.

---

## 3. Compliance with `docs/standalone-game-spec.md`

| Rule | Status | Notes |
|------|--------|-------|
| §2a — Promise.race + 5 s timeout on external service init | ✅ | `src/standalone/standalone-entry.ts`: Firebase init wrapped in `withTimeout(5000)`. Loading screen dismisses even if Firebase never responds. |
| §2c — Skip service-worker on `file://` | ✅ | `App.ts → registerServiceWorker()` guards with `window.location.protocol === 'file:'`. The standalone entry never calls `registerServiceWorker` at all. |
| §2d — All asset refs relative (`publicPath: './'`) | ✅ | `webpack.standalone.config.js`: `output.publicPath = './'`. All `src=`, `href=`, and `url()` references in `index.standalone.html` use `./assets/…`. |
| §2e — No `window.location.origin` for asset URLs | ✅ | `StandaloneBookLoader.ts` uses only relative paths. No origin-based URL construction anywhere in the standalone code path. |
| §2f — Analytics / Sentry calls fire-and-forget | ✅ | All `logEvent` calls in `App.ts` and `standalone-entry.ts` are inside `try { … } catch {}` with no `await`. |
| §2g — XHR not fetch on `file://`; no Cache API | ✅ | `src/standalone/loadBinary.ts`: `loadBinary()` picks XHR on `file://`, `fetch` on `https://`. `ContentParser.parseContentJSONFile()` already uses XHR exclusively. `Promise.allSettled` used for batched loads. |
| §2h — Rive fallback WASM | ⚠️  | CRWebPlayer does **not** currently use Rive. If Rive is introduced, `build-engine.js` will fail with an explicit error if `rive_fallback.wasm` is missing, enforcing compliance before the ZIP is produced. |
| §5d — No startup network chatter (`STANDALONE=true`) | ✅ | `webpack.standalone.config.js` sets `DefinePlugin({ STANDALONE: true })`. This flag is available for tree-shaking any Statsig/GTM/feature-flag SDKs when they are added. Firebase `config.ts` uses the static inline config (no dynamic `webConfig` fetch). Firebase Analytics measurement events are the only outbound calls. |
| §8 — `index.html` self-contained | ✅ | `index.standalone.html`: no `<script src="https://…">`, no `navigator.serviceWorker.register()` in inline scripts. Splide CSS/JS bundled locally from `node_modules`. Root `<div id="loadingScreen">` present before `<script>` tag. |

---

## 4. Book / language selection (§3c)

**Both methods are supported.** The engine reads them in priority order:

1. **Query params** (preferred): `index.html?cr_book=<bookslug>&cr_lang=<langcode>`
2. **`manifest.json`** next to `index.html` (written by the container at extract time):
   ```json
   { "books": [{ "bookSlug": "the-lion-runs-and-the-cow-walks", "langCode": "swahili" }] }
   ```

**Recommendation for the container team:** use query params — they require no extra write step at extract time and are already supported.

---

## 5. ZIP structure and three-tier model

All three ZIPs, when extracted **in order** (engine → book → language) into the same directory, produce:

```
index.html
crwebplayer.js
assets/
  splide4.min.css
  splide4.min.js
  fonts/Quicksand_Bold.otf
  images/loadingImg.gif  …
books/
  <bookslug>/
    book.json
    images/          ← from book ZIP
    lang/
      <langcode>/
        text.json    ← renamed from content.json, from language ZIP
        audios/      ← from language ZIP
        fonts/       ← from language ZIP (if present)
        lang.json    ← language metadata, from language ZIP
```

No file overlap between the three ZIPs — enforced by `scripts/lib/build-checks.js §4a`.

---

## 6. Naming — proposed slugs for container team review

**Engine slug:** `crwp` — confirmed; used in all ZIP filenames.

**Book slugs:** see `scripts/lib/content-catalog.js` for the full list.  
Notable decisions:
- Level variants of the same book are mapped to a **single slug** (e.g. `LetsFlyLevel2En` and `LetsFlyHindiLv4` both → `lets-fly`). The level encoding in the source directory name is treated as an internal implementation detail, not a stable identifier.
- Two source directories had duplicate `(book, lang)` targets (noted with `duplicate: true` in the catalog). The first entry is canonical; the second is skipped by all build scripts.

**Language codes:** match Feed The Monster's existing on-device slugs so cached
content survives across releases. Where the FTM spelling differs from the more
standard linguistic form, the FTM spelling wins for back-compat.

Canonical (linguistic) name → FTM slug used here:
- Cape Verdean Creole     → `caboverdecreole`     (formerly proposed `cvkreole`)
- Cape Verdean Portuguese → `caboverdeportuguese` (formerly proposed `cvportuguese`)
- isiZulu                 → `zulu`                (formerly proposed `isizulu`)
- Luganda                 → `lugandan`            (formerly proposed `luganda`)
- Tigrinya                → `tigragna`            (formerly proposed `tigrinya`; source dirs use `Tigirigna`)

Other slugs match FTM as-is: `english`, `hindi`, `swahili`, `french`, `nepali`,
`ukrainian`, `bangla`, `marathi`, `hausa`, `wolof`, `pashto`, `amharic`, `oromo`, `somali`.

---

## 6a. Payload re-encoding (size reduction)

To shrink download size, audio and image assets are re-encoded at build time on the way into each ZIP. Source files in `BookContent/` are never modified.

| Source | Output | ffmpeg / cwebp invocation |
|---|---|---|
| `.mp3` / `.wav` / `.ogg` / `.m4a` / `.aac` / `.flac` | Opus 24 kbps mono in `.webm` | `ffmpeg -c:a libopus -b:a 24k -ac 1 -vbr on -application voip -map_metadata -1` |
| `.jpg` / `.jpeg` / `.png` | WebP quality 80 | `cwebp -q 80 -m 6` |
| `.webm` / `.opus` / `.webp` | passthrough | — |
| Everything else (fonts, JSON, …) | passthrough | — |

The audio file extension inside the ZIP is `.webm`, **not** `.opus`. `<audio>` plays Opus-in-WebM natively on iOS WKWebView ≥ 17.4 and every modern Android WebView and desktop browser. Raw `.opus` has narrower compatibility.

### Default audio encoding (build-all-standalone.js)
`scripts/build-all-standalone.js` defaults to **LC-AAC 48 kbps mono in `.m4a`** (i.e. it sets `USE_M4A_FALLBACK=1` for the spawned per-script builds unless overridden). This is the iOS-safe choice because Safari/WebKit only gained Opus-in-WebM `<audio>` playback in iOS 17.4 (March 2024), and the Curious Reader container still has to run on older iOS versions.

We use LC-AAC, **not HE-AAC**. HE-AAC requires `libfdk_aac` (non-free, not in Homebrew's default ffmpeg) or `aac_at` (macOS-only AudioToolbox); stock ffmpeg's native AAC encoder rejects HE-AAC with `Profile not supported!`. LC-AAC at 48 kbps mono works with every ffmpeg install and is still a meaningful reduction from the source MP3s.

Pass `--opus` (or set `USE_M4A_FALLBACK=0`) to opt in to Opus 24 kbps in `.webm` for ~50% smaller language ZIPs, once the iOS support floor is 17.4+.

The lower-level scripts (`build-book.js`, `build-lang.js`) read `USE_M4A_FALLBACK` from the environment directly and have no default — they encode whatever the caller asks for.

### Codec support
| Encoder | Container | iOS WKWebView `<audio>` | Android WebView | Desktop |
|---|---|---|---|---|
| LC-AAC 48 kbps mono **(default)** | `.m4a` | iOS 11+ | 5.0+ | all current |
| Opus 24 kbps mono (`--opus`) | `.webm` | iOS 17.4+ only | 5.0+ | all current |
| WebP q80 (images) | `.webp` | iOS 14+ | 4.4+ | all current |

### Word-by-word highlight sync — safety guarantees
The player drives word highlighting by comparing per-word `start`/`end` timestamps (in seconds) from `content.json` against `<audio>.currentTime`. To make sure re-encoding does not desync this:

1. The ffmpeg command line contains **no** `-ss`, `-t`, filters, or resampling — only codec, bitrate, channel layout, and metadata strip. Nothing that could change duration.
2. Every audio conversion is verified with `ffprobe`. If input and output duration differ by more than **50 ms** the build **aborts with an explicit error**. (50 ms is well below the perceptual word-sync threshold; Opus packets are 20 ms by default, so frame-boundary rounding alone can produce 20–40 ms of legitimate drift.)
3. `content.json` is parsed in memory; only string values whose extension matches a known media format are rewritten (`.mp3` → `.webm`, `.jpg` → `.webp`). All numeric values — including the per-word `start`/`end` arrays — are passed through unchanged.

### Cache
Converted assets are cached at `dist/.asset-cache/<sha256>.<ext>` so repeat builds skip re-encoding. The cache directory is git-ignored. Delete it to force a full re-encode.

---

## 7. Known issues / deviations

1. **`sw.js` not emitted in standalone build.** The standalone entry point never registers a service worker, so no Workbox precache manifest is generated. The container team can walk the extracted directory directly (§3d says this is fine).

2. **`book.json` titles are empty strings.** Localised book titles are not stored in the source `content.json` — they are only encoded in the BookContent directory names. The `titleByLang` fields in `book.json` are intentionally left blank for the container team to fill in from their content management system.

3. **Audio duration estimate is a rough proxy.** `lang.json.audioDurationSeconds` is estimated from file sizes (128 kbps average). Replace with a proper duration scan using `ffprobe` or similar if needed.

4. **Images assumed to be shared across all language versions.** The build script copies images from the first language variant's `content/images/` directory. If illustrations genuinely differ across languages for a given title, the canonical source directory should be set explicitly in `content-catalog.js`.

5. **`ContentParser.ts` path references.** `StandaloneBookLoader` passes relative paths (`./books/<slug>/lang/<code>/text.json`, etc.) to `ContentParser` and `PlayBackEngine`. `ContentParser.parseContentJSONFile()` already uses XHR (§2g ✅). `PlayBackEngine` builds image/audio `src` attributes by concatenating `imagesPath + filename` and `audioPath + filename` — both are relative in standalone mode.

---

## 8. Verification steps (§9)

1. Run: `npm run build:standalone`
2. Unzip `crwp-core.zip`, `crwp-book-the-lion-runs-and-the-cow-walks.zip`, and  
   `crwp-book-the-lion-runs-and-the-cow-walks-lang-swahili.zip` into the same temp directory.
3. Open `index.html?cr_book=the-lion-runs-and-the-cow-walks&cr_lang=swahili`  
   in desktop Chrome with **DevTools → Network → Offline**.
4. Must reach a playable state in **under 10 seconds** with **zero JS errors**.
5. Repeat on Android Chrome (or the Curious Reader container) with **airplane mode on**.  
   Expected: **zero `NETGUARD_BLOCK` log lines**.
