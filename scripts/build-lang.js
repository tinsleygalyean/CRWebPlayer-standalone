#!/usr/bin/env node
'use strict';

/**
 * scripts/build-lang.js <bookSlug> <langCode>
 *
 * Packs language-specific assets into crwp-book-<bookSlug>-lang-<langCode>.zip.
 *
 * "Language-level" content (§3a):
 *   books/<bookSlug>/lang/<langCode>/text.json   ← renamed content.json
 *   books/<bookSlug>/lang/<langCode>/audios/      ← narration audio
 *   books/<bookSlug>/lang/<langCode>/fonts/       ← per-language fonts (if any)
 *   books/<bookSlug>/lang/<langCode>/lang.json    ← language metadata for container
 *
 * Hard constraint (§3b): nothing in this ZIP may overwrite a file from the
 * engine ZIP or the book ZIP.  The overlap check in build-checks.js validates
 * this when build-all-standalone.js runs.
 *
 * Usage:
 *   node scripts/build-lang.js the-lion-runs-and-the-cow-walks swahili
 *
 * Output:
 *   dist/standalone/crwp-book-<bookSlug>-lang-<langCode>.zip
 */

const path   = require('path');
const fs     = require('fs');
const JSZip  = require('jszip');
const crypto = require('crypto');
const { getSourceDir } = require('./lib/content-catalog');

const ROOT            = path.resolve(__dirname, '..');
const BOOK_CONTENT    = path.join(ROOT, 'BookContent');
const DIST_STANDALONE = path.join(ROOT, 'dist', 'standalone');

const bookSlug = process.argv[2];
const langCode = process.argv[3];

if (!bookSlug || !langCode) {
  console.error('Usage: node scripts/build-lang.js <bookSlug> <langCode>');
  process.exit(1);
}

// ── helpers ───────────────────────────────────────────────────────────────────

function addDirToZip(zip, srcDir, zipPath) {
  if (!fs.existsSync(srcDir)) return 0;
  let count = 0;
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcFull = path.join(srcDir, entry.name);
    const destPath = zipPath ? `${zipPath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      count += addDirToZip(zip, srcFull, destPath);
    } else {
      zip.file(destPath, fs.readFileSync(srcFull));
      count++;
    }
  }
  return count;
}

/**
 * Language display names (best-effort — extend as needed).
 *
 * Keys here are FTM slugs (Feed The Monster's on-device language codes), kept
 * for back-compat with installed devices. The `en` / `native` display strings
 * still use the linguistically correct names (e.g. slug `zulu` → display `isiZulu`).
 */
const LANG_DISPLAY_NAMES = {
  english:              { en: 'English',           native: 'English' },
  hindi:                { en: 'Hindi',              native: 'हिन्दी' },
  swahili:              { en: 'Swahili',            native: 'Kiswahili' },
  french:               { en: 'French',             native: 'Français' },
  lugandan:             { en: 'Luganda',            native: 'Luganda' },
  nepali:               { en: 'Nepali',             native: 'नेपाली' },
  ukrainian:            { en: 'Ukrainian',          native: 'Українська' },
  zulu:                 { en: 'isiZulu',            native: 'isiZulu' },
  bangla:               { en: 'Bangla',             native: 'বাংলা' },
  marathi:              { en: 'Marathi',            native: 'मराठी' },
  hausa:                { en: 'Hausa',              native: 'Hausa' },
  wolof:                { en: 'Wolof',              native: 'Wolof' },
  pashto:               { en: 'Pashto',             native: 'پښتو' },
  amharic:              { en: 'Amharic',            native: 'አማርኛ' },
  oromo:                { en: 'Oromo',              native: 'Afaan Oromoo' },
  somali:               { en: 'Somali',             native: 'Soomaali' },
  tigragna:             { en: 'Tigrinya',           native: 'ትግርኛ' },
  caboverdeportuguese:  { en: 'Cape Verdean Portuguese', native: 'Português Cabo-verdiano' },
  caboverdecreole:      { en: 'Cape Verdean Creole',     native: 'Kriolu Kabuverdianu' },
};

// ── main ──────────────────────────────────────────────────────────────────────

(async () => {
  try {
    console.log(`\n═══ build-lang.js: ${bookSlug} / ${langCode} ═══\n`);

    const sourceDir = getSourceDir(bookSlug, langCode);
    if (!sourceDir) {
      throw new Error(
        `No source directory found in content catalog for bookSlug="${bookSlug}" langCode="${langCode}".\n` +
        'Check scripts/lib/content-catalog.js.'
      );
    }

    const contentDir = path.join(BOOK_CONTENT, sourceDir, 'content');
    if (!fs.existsSync(contentDir)) {
      throw new Error(
        `Source content directory not found: ${contentDir}\n` +
        `Make sure BookContent/${sourceDir}/content/ exists and is checked out.`
      );
    }

    const zip = new JSZip();
    const langBase = `books/${bookSlug}/lang/${langCode}`;

    // ── text.json (renamed from content.json) ─────────────────────────────────
    const contentJsonSrc = path.join(contentDir, 'content.json');
    if (!fs.existsSync(contentJsonSrc)) {
      throw new Error(`content.json not found at ${contentJsonSrc}`);
    }
    const contentJson = fs.readFileSync(contentJsonSrc);
    zip.file(`${langBase}/text.json`, contentJson);
    console.log(`[build-lang] Added text.json from ${sourceDir}/content/content.json`);

    // ── audios/ ───────────────────────────────────────────────────────────────
    const audiosDir = path.join(contentDir, 'audios');
    const audioCount = addDirToZip(zip, audiosDir, `${langBase}/audios`);
    console.log(`[build-lang] Added ${audioCount} audio file(s).`);

    // ── per-language fonts (optional) ─────────────────────────────────────────
    const fontsDir = path.join(contentDir, 'fonts');
    const fontCount = addDirToZip(zip, fontsDir, `${langBase}/fonts`);
    if (fontCount > 0) console.log(`[build-lang] Added ${fontCount} font file(s).`);

    // ── lang.json ─────────────────────────────────────────────────────────────
    // Estimate audio duration by summing file sizes (rough proxy).
    let audioDurationSeconds = 0;
    if (fs.existsSync(audiosDir)) {
      const audioFiles = fs.readdirSync(audiosDir).filter(f => /\.(mp3|wav|ogg|m4a)$/i.test(f));
      // Rough estimate: average 128 kbps MP3 → 16 KB/s
      const totalBytes = audioFiles.reduce((sum, f) => {
        try { return sum + fs.statSync(path.join(audiosDir, f)).size; } catch { return sum; }
      }, 0);
      audioDurationSeconds = Math.round(totalBytes / 16_000);
    }

    const displayNames = LANG_DISPLAY_NAMES[langCode] || { en: langCode, native: langCode };
    const langJson = {
      bookSlug,
      langCode,
      langDisplayName:       displayNames.en,
      langDisplayNameNative: displayNames.native,
      narratorName:          '',
      audioDurationSeconds,
    };
    zip.file(`${langBase}/lang.json`, JSON.stringify(langJson, null, 2));
    console.log(`[build-lang] Generated lang.json.`);

    // ── write ZIP ─────────────────────────────────────────────────────────────
    const zipFileName = `crwp-book-${bookSlug}-lang-${langCode}.zip`;
    const zipFilePath = path.join(DIST_STANDALONE, zipFileName);
    fs.mkdirSync(DIST_STANDALONE, { recursive: true });

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    fs.writeFileSync(zipFilePath, zipBuffer);

    const sha256 = crypto.createHash('sha256').update(zipBuffer).digest('hex');
    console.log(`[build-lang] ✓ ${zipFileName} written (${(zipBuffer.length / 1024).toFixed(1)} KB, sha256=${sha256.slice(0,16)}…)\n`);

  } catch (err) {
    console.error('\n[build-lang] FAILED:', err.message);
    process.exit(1);
  }
})();
