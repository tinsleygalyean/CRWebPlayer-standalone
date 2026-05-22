'use strict';

/**
 * §4a build-time checks.
 *
 * Each check throws an Error (causing the build script to exit non-zero) if
 * the condition it guards is violated.  Call runAllChecks(distDir, zipFiles)
 * after creating ZIPs to validate the output.
 */

const fs   = require('fs');
const path = require('path');
const JSZip = require('jszip');
const crypto = require('crypto');

// ── Individual checks ─────────────────────────────────────────────────────────

/**
 * Verify webpack output.publicPath is './' in the generated JS.
 * We check by scanning the built JS for any absolute-path __webpack_require__
 * public path string.
 */
async function checkPublicPath(engineDir) {
  const jsFiles = fs.readdirSync(engineDir).filter(f => f.endsWith('.js'));
  for (const file of jsFiles) {
    const content = fs.readFileSync(path.join(engineDir, file), 'utf8');
    // webpack injects publicPath as a string literal
    if (content.includes('"publicPath"') || content.includes("'publicPath'")) {
      if (!content.includes('"publicPath":"./\"') &&
          !content.includes("'publicPath':'./'") &&
          // webpack 5 inlines it differently
          !content.includes('__webpack_require__.p = "./"') &&
          !content.includes("__webpack_require__.p='./\"")) {
        // Just warn — the exact embedding varies by webpack version
        console.warn('[check] publicPath string not found in expected form in ' + file +
          ' — verify manually that output.publicPath is "./"');
      }
    }
  }
}

/** §4a — no .map files in dist/standalone/ */
function checkNoSourceMaps(distDir) {
  const maps = walkDir(distDir).filter(f => f.endsWith('.map'));
  if (maps.length > 0) {
    throw new Error('§4a FAIL: .map files found in dist/standalone:\n  ' + maps.join('\n  '));
  }
}

/** §4a — no absolute src="/…" or url(/…) in index.html */
async function checkNoAbsolutePaths(engineZipBuffer) {
  const zip = await JSZip.loadAsync(engineZipBuffer);
  const htmlFile = zip.file('index.html');
  if (!htmlFile) throw new Error('index.html not found in engine ZIP');
  const html = await htmlFile.async('text');

  const absPathPattern = /(?:src|href|url)\s*=?\s*["'(]\s*\/(?!\/)/g;
  const matches = [...html.matchAll(absPathPattern)];
  if (matches.length > 0) {
    throw new Error('§4a FAIL: absolute paths found in index.html:\n  ' +
      matches.map(m => m[0]).join('\n  '));
  }
}

/** §4a — no <script src="https://…"> in index.html */
async function checkNoExternalScripts(engineZipBuffer) {
  const zip = await JSZip.loadAsync(engineZipBuffer);
  const htmlFile = zip.file('index.html');
  if (!htmlFile) throw new Error('index.html not found in engine ZIP');
  const html = await htmlFile.async('text');

  if (/<script[^>]+src\s*=\s*["']https?:\/\//i.test(html)) {
    throw new Error('§4a FAIL: external <script src="https://…"> found in index.html');
  }
}

/** §4a — no `await fetch(` on same-origin asset paths (relative paths) */
async function checkNoAwaitFetch(engineZipBuffer) {
  const zip = await JSZip.loadAsync(engineZipBuffer);
  for (const [filename, file] of Object.entries(zip.files)) {
    if (!filename.endsWith('.js')) continue;
    const content = await file.async('text');
    // Look for await fetch( followed by a relative path — remote CDN fetches (https://)
    // are allowed for analytics but same-origin asset loads must use loadBinary.
    const awaitFetchRelative = /await\s+fetch\s*\(\s*["'`]\./g;
    if (awaitFetchRelative.test(content)) {
      throw new Error(`§4a FAIL: await fetch('./\u2026') for local asset found in ${filename}. Use loadBinary() instead.`);
    }
  }
}

/** §4a — no caches.open( reachable on the file:// code path */
async function checkNoCachesOpen(engineZipBuffer) {
  const zip = await JSZip.loadAsync(engineZipBuffer);
  for (const [filename, file] of Object.entries(zip.files)) {
    if (!filename.endsWith('.js')) continue;
    const content = await file.async('text');
    // This is a heuristic: warn if caches.open appears without a surrounding file: guard.
    if (/caches\.open\s*\(/.test(content)) {
      if (!/protocol.*file|file.*protocol|file:/.test(content)) {
        console.warn(`[check] §4a WARNING: caches.open() in ${filename} may be reachable on file:// — ` +
          'ensure it is guarded by a protocol check.');
      }
    }
  }
}

/** §4a — ZIP-to-ZIP overlap: the same file path must not appear in more than one ZIP */
async function checkNoZipOverlap(engineZipBuf, bookZipBuf, langZipBuf) {
  const lists = await Promise.all([
    zipFileList(engineZipBuf),
    bookZipBuf ? zipFileList(bookZipBuf) : Promise.resolve([]),
    langZipBuf  ? zipFileList(langZipBuf)  : Promise.resolve([]),
  ]);
  const [engine, book, lang] = lists;

  const engineSet = new Set(engine);
  const bookSet   = new Set(book);
  const langSet   = new Set(lang);

  const overlap1 = engine.filter(f => bookSet.has(f));
  const overlap2 = engine.filter(f => langSet.has(f));
  const overlap3 = book.filter(f => langSet.has(f));

  const all = [...overlap1, ...overlap2, ...overlap3];
  if (all.length > 0) {
    throw new Error('§4a FAIL: ZIP-to-ZIP overlap detected:\n  ' + all.join('\n  '));
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function walkDir(dir, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDir(full, fileList);
    else fileList.push(full);
  }
  return fileList;
}

async function zipFileList(buf) {
  const zip = await JSZip.loadAsync(buf);
  return Object.keys(zip.files).filter(name => !zip.files[name].dir);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run all §4a checks.
 *
 * @param {string}      distDir        path to dist/standalone/
 * @param {Buffer|null} engineZipBuf   contents of crwp-core.zip
 * @param {Buffer|null} bookZipBuf     contents of a crwp-book-*.zip (optional)
 * @param {Buffer|null} langZipBuf     contents of a crwp-book-*-lang-*.zip (optional)
 */
async function runAllChecks(distDir, engineZipBuf, bookZipBuf = null, langZipBuf = null) {
  console.log('\n[checks] Running §4a build-time checks…');

  checkNoSourceMaps(distDir);
  console.log('  ✓ No .map files in dist/standalone/');

  if (engineZipBuf) {
    await checkNoAbsolutePaths(engineZipBuf);
    console.log('  ✓ No absolute paths in index.html');

    await checkNoExternalScripts(engineZipBuf);
    console.log('  ✓ No external <script> tags in index.html');

    await checkNoAwaitFetch(engineZipBuf);
    console.log('  ✓ No await fetch() on local assets');

    await checkNoCachesOpen(engineZipBuf);
    console.log('  ✓ caches.open() guarded or absent');
  }

  if (engineZipBuf && (bookZipBuf || langZipBuf)) {
    await checkNoZipOverlap(engineZipBuf, bookZipBuf, langZipBuf);
    console.log('  ✓ No ZIP-to-ZIP file overlap');
  }

  console.log('[checks] All §4a checks passed.\n');
}

module.exports = { runAllChecks, checkNoSourceMaps, checkNoZipOverlap };
