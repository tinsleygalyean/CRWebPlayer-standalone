#!/usr/bin/env node
'use strict';

/**
 * scripts/build-book.js <bookSlug>
 *
 * Packs book-level assets (illustrations, book.json) into crwp-book-<bookSlug>.zip.
 *
 * "Book-level" means: content that is the SAME across all language adaptations
 * of this book.  Typically this is the illustrations directory, which is shared
 * by every language version stored at BookContent/<Dir>/content/images/.
 *
 * The script:
 *   1. Looks up all source directories for <bookSlug> in the content catalog.
 *   2. Copies the images/ directory from the first (canonical) language variant.
 *      If images differ across languages the script warns but still uses the first.
 *   3. Generates a book.json with metadata collected from the catalog.
 *   4. Packs everything into dist/standalone/crwp-book-<bookSlug>.zip.
 *
 * Usage:
 *   node scripts/build-book.js the-lion-runs-and-the-cow-walks
 *
 * Output:
 *   dist/standalone/crwp-book-<bookSlug>.zip
 */

const path   = require('path');
const fs     = require('fs');
const JSZip  = require('jszip');
const crypto = require('crypto');
const { getLanguagesForBook, getSourceDir } = require('./lib/content-catalog');

const ROOT            = path.resolve(__dirname, '..');
const BOOK_CONTENT    = path.join(ROOT, 'BookContent');
const DIST_STANDALONE = path.join(ROOT, 'dist', 'standalone');

const bookSlug = process.argv[2];
if (!bookSlug) {
  console.error('Usage: node scripts/build-book.js <bookSlug>');
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

// ── main ──────────────────────────────────────────────────────────────────────

(async () => {
  try {
    console.log(`\n═══ build-book.js: ${bookSlug} ═══\n`);

    const langs = getLanguagesForBook(bookSlug);
    if (langs.length === 0) {
      throw new Error(`No entries found in content catalog for bookSlug="${bookSlug}". ` +
        'Check scripts/lib/content-catalog.js.');
    }

    console.log(`[build-book] Found ${langs.length} language(s) for "${bookSlug}".`);

    // Use the first language variant as the canonical source for shared images.
    const canonical = langs[0];
    const canonicalSrcDir = path.join(BOOK_CONTENT, canonical.dir, 'content');

    if (!fs.existsSync(canonicalSrcDir)) {
      throw new Error(
        `Source directory not found: ${canonicalSrcDir}\n` +
        `Make sure BookContent/${canonical.dir}/content/ exists and is checked out.`
      );
    }

    const zip = new JSZip();
    const bookBase = `books/${bookSlug}`;

    // ── images (shared across all languages) ──────────────────────────────────
    const imagesDir = path.join(canonicalSrcDir, 'images');
    const imageCount = addDirToZip(zip, imagesDir, `${bookBase}/images`);
    console.log(`[build-book] Added ${imageCount} image file(s) from ${canonical.dir}/content/images/`);

    // Warn if images differ across language variants (heuristic: compare file counts)
    for (const lang of langs.slice(1)) {
      const otherImagesDir = path.join(BOOK_CONTENT, lang.dir, 'content', 'images');
      if (fs.existsSync(otherImagesDir)) {
        const otherCount = fs.readdirSync(otherImagesDir).length;
        const canonCount = fs.existsSync(imagesDir) ? fs.readdirSync(imagesDir).length : 0;
        if (otherCount !== canonCount) {
          console.warn(
            `[build-book] WARNING: image count differs between ${canonical.dir} (${canonCount}) ` +
            `and ${lang.dir} (${otherCount}). Using ${canonical.dir} as canonical.`
          );
        }
      }
    }

    // ── book-specific Rive files (if any) ─────────────────────────────────────
    const riveDir = path.join(canonicalSrcDir, 'rive');
    const riveCount = addDirToZip(zip, riveDir, `${bookBase}/rive`);
    if (riveCount > 0) console.log(`[build-book] Added ${riveCount} Rive file(s).`);

    // ── book.json ─────────────────────────────────────────────────────────────
    // Parse the canonical content.json to extract page count and title hints.
    let pageCount = 0;
    const contentJsonPath = path.join(canonicalSrcDir, 'content.json');
    if (fs.existsSync(contentJsonPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(contentJsonPath, 'utf8'));
        const slides = raw?.presentation?.slides;
        if (Array.isArray(slides)) pageCount = slides.length;
      } catch { /* best-effort */ }
    }

    // Collect language display names (best-effort from catalog)
    const titleByLang = {};
    for (const lang of langs) {
      // We don't have localised titles in the catalog — leave as empty strings for
      // the container team to fill in.  The engine version and langCode are enough
      // for the container's build-manifest.js to discover titles from other sources.
      titleByLang[lang.langCode] = '';
    }

    const bookJson = {
      bookSlug,
      engine: 'crwp',
      engineVersion: '0.3.12',
      titleByLang,
      coverImage: `books/${bookSlug}/images/cover.jpg`,
      recommendedAgeRange: [4, 8],
      pageCount,
      languagesAvailable: langs.map(l => l.langCode),
    };

    zip.file(`${bookBase}/book.json`, JSON.stringify(bookJson, null, 2));
    console.log(`[build-book] Generated book.json (${pageCount} pages, ${langs.length} languages).`);

    // ── write ZIP ─────────────────────────────────────────────────────────────
    const zipFileName = `crwp-book-${bookSlug}.zip`;
    const zipFilePath = path.join(DIST_STANDALONE, zipFileName);
    fs.mkdirSync(DIST_STANDALONE, { recursive: true });

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    fs.writeFileSync(zipFilePath, zipBuffer);

    const sha256 = crypto.createHash('sha256').update(zipBuffer).digest('hex');
    console.log(`[build-book] ✓ ${zipFileName} written (${(zipBuffer.length / 1024).toFixed(1)} KB, sha256=${sha256.slice(0,16)}…)\n`);

  } catch (err) {
    console.error('\n[build-book] FAILED:', err.message);
    process.exit(1);
  }
})();
