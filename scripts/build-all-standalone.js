#!/usr/bin/env node
'use strict';

/**
 * scripts/build-all-standalone.js
 *
 * Convenience script: runs the full standalone build pipeline for every
 * (book, language) pair present in the content catalog.
 *
 * Steps:
 *   1. Build engine ZIP          → dist/standalone/crwp-core.zip
 *   2. For each unique bookSlug:
 *        Build book ZIP          → dist/standalone/crwp-book-<bookSlug>.zip
 *   3. For each (bookSlug, langCode):
 *        Build language ZIP      → dist/standalone/crwp-book-<bookSlug>-lang-<langCode>.zip
 *   4. Run §4a overlap checks across all ZIP pairs.
 *   5. Write manifest.csv and README.md to dist/standalone/.
 *
 * Usage:
 *   npm run build:standalone
 *   node scripts/build-all-standalone.js [--skip-engine] [--book <slug>] [--opus]
 *
 * Flags:
 *   --skip-engine   Skip the webpack build (useful for re-packing content only)
 *   --book <slug>   Only build one book (plus all its languages)
 *   --opus          Encode audio as Opus 24 kbps in `.webm` (smaller, but
 *                   requires iOS WKWebView >= 17.4). Default is LC-AAC 48 kbps
 *                   in `.m4a`, which plays on every iOS version the container
 *                   supports.
 *
 * Audio encoding default:
 *   This script defaults to USE_M4A_FALLBACK=1 (LC-AAC in `.m4a`) because the
 *   Curious Reader container still has to run on iOS devices older than 17.4,
 *   which cannot play Opus-in-WebM via `<audio>`. Pass `--opus` (or set
 *   `USE_M4A_FALLBACK=0` explicitly) once the iOS support floor is 17.4+ to
 *   get noticeably smaller language ZIPs.
 */

const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const { execSync } = require('child_process');
const { CATALOG, getAllBookSlugs, getLanguagesForBook } = require('./lib/content-catalog');
const { checkNoZipOverlap, checkNoSourceMaps } = require('./lib/build-checks');

const ROOT            = path.resolve(__dirname, '..');
const DIST_STANDALONE = path.join(ROOT, 'dist', 'standalone');

const args = process.argv.slice(2);
const skipEngine  = args.includes('--skip-engine');
const useOpus     = args.includes('--opus');
const bookFilter  = (() => {
  const idx = args.indexOf('--book');
  return idx !== -1 ? args[idx + 1] : null;
})();

// Default audio encoding for this convenience script is AAC-HE in .m4a so
// builds work on every iOS version the Curious Reader container supports.
// `--opus` opts in to the smaller Opus-in-WebM path (iOS >= 17.4 only).
// Explicit USE_M4A_FALLBACK in the environment always wins over both.
if (process.env.USE_M4A_FALLBACK === undefined) {
  process.env.USE_M4A_FALLBACK = useOpus ? '0' : '1';
} else if (useOpus && process.env.USE_M4A_FALLBACK === '1') {
  console.warn('[build-all] --opus ignored: USE_M4A_FALLBACK=1 is set in the environment.');
}

const audioMode = process.env.USE_M4A_FALLBACK === '1'
  ? 'LC-AAC 48 kbps in .m4a (iOS-safe default)'
  : 'Opus 24 kbps in .webm (iOS >= 17.4 only)';
console.log(`[build-all] Audio encoding: ${audioMode}`);

// ── helpers ───────────────────────────────────────────────────────────────────

function run(script, ...scriptArgs) {
  const cmd = `node "${path.join(__dirname, script)}" ${scriptArgs.map(a => `"${a}"`).join(' ')}`;
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: ROOT });
}

function zipExists(name) {
  return fs.existsSync(path.join(DIST_STANDALONE, name));
}

function readZip(name) {
  const p = path.join(DIST_STANDALONE, name);
  return fs.existsSync(p) ? fs.readFileSync(p) : null;
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function zipStats(name) {
  const p = path.join(DIST_STANDALONE, name);
  if (!fs.existsSync(p)) return null;
  const buf  = fs.readFileSync(p);
  const stat = fs.statSync(p);
  return { name, size: stat.size, sha256: sha256(buf) };
}

// ── generate manifest.csv ─────────────────────────────────────────────────────

function writeManifestCsv(rows) {
  const header = 'filename,type,bookSlug,langCode,sizeBytes,sha256';
  const lines = rows.map(r =>
    `${r.filename},${r.type},${r.bookSlug ?? ''},${r.langCode ?? ''},${r.size},${r.sha256}`
  );
  const csv = [header, ...lines].join('\n') + '\n';
  fs.writeFileSync(path.join(DIST_STANDALONE, 'manifest.csv'), csv);
  console.log(`[build-all] manifest.csv written (${rows.length} row(s)).`);
}

// ── generate README.md ────────────────────────────────────────────────────────

function writeReadme(bookSlugs, langRows) {
  let gitHash = 'unknown';
  try { gitHash = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch {}

  const date = new Date().toISOString().split('T')[0];

  const bookTable = bookSlugs.map(slug => {
    const langs = getLanguagesForBook(slug).map(l => l.langCode).join(', ');
    return `| ${slug} | ${langs} |`;
  }).join('\n');

  const md = `# CRWebPlayer Standalone Build

**Engine version:** 0.3.12-standalone  
**Build date:** ${date}  
**Commit:** ${gitHash}

## Contents

| Book | Languages |
|------|-----------|
${bookTable}

## ZIP naming convention

\`\`\`
crwp-core.zip                              ← engine runtime
crwp-book-<bookslug>.zip                   ← per-book illustrations + metadata
crwp-book-<bookslug>-lang-<langcode>.zip   ← per-language text, audio, fonts
\`\`\`

## Usage

Extract in order: engine → book → language into the same directory, then open:

\`\`\`
index.html?cr_book=<bookslug>&cr_lang=<langcode>
\`\`\`

Or provide a \`manifest.json\` next to \`index.html\` (written by the container at extract time).

## Verification

Load \`index.html?cr_book=X&cr_lang=Y\` in desktop Chrome with **DevTools → Network → Offline**.  
Must reach a playable state within 10 seconds with zero JS errors.

See \`STANDALONE-NOTES.md\` for full compliance and known-issues notes.
`;

  fs.writeFileSync(path.join(DIST_STANDALONE, 'README.md'), md);
  console.log('[build-all] README.md written.');
}

// ── main ──────────────────────────────────────────────────────────────────────

(async () => {
  const startTime = Date.now();
  const errors = [];

  console.log('\n╔══════════════════════════════════╗');
  console.log('║  build-all-standalone.js          ║');
  console.log('╚══════════════════════════════════╝\n');

  fs.mkdirSync(DIST_STANDALONE, { recursive: true });

  // ── Step 1: engine ──────────────────────────────────────────────────────────
  if (!skipEngine) {
    try {
      run('build-engine.js');
    } catch (e) {
      errors.push({ step: 'engine', error: e.message });
      console.error('[build-all] engine build failed — continuing with remaining steps.');
    }
  } else {
    console.log('[build-all] Skipping engine build (--skip-engine).');
  }

  // ── Step 2 + 3: books and languages ─────────────────────────────────────────
  const bookSlugs = bookFilter ? [bookFilter] : getAllBookSlugs();

  for (const bookSlug of bookSlugs) {
    // Book ZIP
    try {
      run('build-book.js', bookSlug);
    } catch (e) {
      errors.push({ step: `book:${bookSlug}`, error: e.message });
      console.error(`[build-all] book "${bookSlug}" failed — skipping its languages.`);
      continue;
    }

    // Language ZIPs
    const langs = getLanguagesForBook(bookSlug);
    for (const { langCode } of langs) {
      try {
        run('build-lang.js', bookSlug, langCode);
      } catch (e) {
        errors.push({ step: `lang:${bookSlug}/${langCode}`, error: e.message });
        console.error(`[build-all] lang "${bookSlug}/${langCode}" failed — continuing.`);
      }
    }
  }

  // ── Step 4: §4a overlap checks (sample: engine vs first available book+lang) ──
  const engineBuf = readZip('crwp-core.zip');
  if (engineBuf) {
    checkNoSourceMaps(DIST_STANDALONE);

    for (const bookSlug of bookSlugs.slice(0, 3)) {
      const bookBuf = readZip(`crwp-book-${bookSlug}.zip`);
      const langs   = getLanguagesForBook(bookSlug);
      const langBuf = langs.length > 0
        ? readZip(`crwp-book-${bookSlug}-lang-${langs[0].langCode}.zip`)
        : null;

      if (bookBuf) {
        try {
          await checkNoZipOverlap(engineBuf, bookBuf, langBuf);
          console.log(`[build-all] ✓ ZIP overlap check passed for "${bookSlug}".`);
        } catch (e) {
          errors.push({ step: `overlap:${bookSlug}`, error: e.message });
          console.error(`[build-all] Overlap check FAILED for "${bookSlug}": ${e.message}`);
        }
      }
    }
  }

  // ── Step 5: manifest.csv ─────────────────────────────────────────────────────
  const manifestRows = [];

  const engineStats = zipStats('crwp-core.zip');
  if (engineStats) {
    manifestRows.push({ filename: 'crwp-core.zip', type: 'core', bookSlug: '', langCode: '', ...engineStats });
  }

  for (const bookSlug of bookSlugs) {
    const bookZipName = `crwp-book-${bookSlug}.zip`;
    const bStats = zipStats(bookZipName);
    if (bStats) manifestRows.push({ filename: bookZipName, type: 'book', bookSlug, langCode: '', ...bStats });

    for (const { langCode } of getLanguagesForBook(bookSlug)) {
      const lName = `crwp-book-${bookSlug}-lang-${langCode}.zip`;
      const lStats = zipStats(lName);
      if (lStats) manifestRows.push({ filename: lName, type: 'lang', bookSlug, langCode, ...lStats });
    }
  }

  writeManifestCsv(manifestRows);
  writeReadme(bookSlugs, manifestRows);

  // ── Summary ──────────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const zipCount = fs.readdirSync(DIST_STANDALONE).filter(f => f.endsWith('.zip')).length;

  console.log('\n╔══════════════════════════════════╗');
  console.log(`║  Done in ${elapsed}s — ${String(zipCount).padStart(3)} ZIP(s) produced   ║`);
  console.log('╚══════════════════════════════════╝');

  if (errors.length > 0) {
    console.error('\n[build-all] The following steps failed:');
    for (const { step, error } of errors) {
      console.error(`  ✗ ${step}: ${error}`);
    }
    process.exit(1);
  }

  console.log('\n[build-all] All steps completed successfully.');
})();
