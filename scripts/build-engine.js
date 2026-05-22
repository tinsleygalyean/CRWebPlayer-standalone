#!/usr/bin/env node
'use strict';

/**
 * scripts/build-engine.js
 *
 * Builds the CRWebPlayer engine bundle and packs it into crwp-core.zip.
 *
 * What goes in the engine ZIP:
 *   index.html              ← compiled by HtmlWebpackPlugin
 *   crwebplayer.js          ← webpack bundle (publicPath: './')
 *   assets/
 *     splide4.min.css        ← Splide stylesheet (bundled locally)
 *     splide4.min.js         ← Splide JS (bundled locally, if needed)
 *     fonts/                 ← engine-level fonts (e.g. Quicksand)
 *     images/                ← engine-level images (loading gif, bird icon)
 *
 * Does NOT include: any BookContent, per-language audio, per-book images.
 *
 * Usage:
 *   node scripts/build-engine.js
 *
 * Output:
 *   dist/standalone/crwp-core.zip
 */

const path    = require('path');
const fs      = require('fs');
const JSZip   = require('jszip');
const webpack = require('webpack');
const { runAllChecks } = require('./lib/build-checks');

const ROOT         = path.resolve(__dirname, '..');
const DIST_ENGINE  = path.join(ROOT, 'dist', 'standalone-engine');
const DIST_STANDALONE = path.join(ROOT, 'dist', 'standalone');
const OUT_ZIP      = path.join(DIST_STANDALONE, 'crwp-core.zip');

// Engine-level static assets (relative to ROOT) to include in the ZIP.
// These are files that ship with the engine, not with any specific book.
const ENGINE_STATIC_ASSETS = [
  // Splide (bundled locally — no CDN)
  { src: 'node_modules/@splidejs/splide/dist/css/splide-core.min.css', dest: 'assets/splide4.min.css' },
  { src: 'node_modules/@splidejs/splide/dist/js/splide.min.js',         dest: 'assets/splide4.min.js' },
  // Engine-level fonts
  { src: 'dist/fonts/Quicksand_Bold.otf',  dest: 'assets/fonts/Quicksand_Bold.otf',  optional: true },
  // Engine-level images
  { src: 'dist/images/loadingImg.gif',        dest: 'assets/images/loadingImg.gif',        optional: true },
  { src: 'dist/images/cropped-bird_red-2.webp', dest: 'assets/images/cropped-bird_red-2.webp', optional: true },
  // Rive fallback WASM — §2h (include if present)
  { src: 'dist/rive/rive_fallback.wasm', dest: 'assets/rive/rive_fallback.wasm', optional: true },
  { src: 'dist/rive/rive.wasm',          dest: 'assets/rive/rive.wasm',          optional: true },
];

// ── Step 1: webpack build ─────────────────────────────────────────────────────

async function runWebpack() {
  const config = require('../webpack.standalone.config.js');
  return new Promise((resolve, reject) => {
    webpack(config, (err, stats) => {
      if (err) return reject(err);
      const info = stats.toJson();
      if (stats.hasErrors()) {
        return reject(new Error('Webpack build errors:\n' + info.errors.map(e => e.message).join('\n')));
      }
      if (stats.hasWarnings()) {
        info.warnings.forEach(w => console.warn('[webpack]', w.message));
      }
      console.log('[build-engine] Webpack build complete.');
      console.log(stats.toString({ colors: true, assets: true, modules: false, chunks: false }));
      resolve(stats);
    });
  });
}

// ── Step 2: verify publicPath ─────────────────────────────────────────────────

function verifyPublicPath() {
  const jsFile = path.join(DIST_ENGINE, 'crwebplayer.js');
  if (!fs.existsSync(jsFile)) {
    throw new Error('crwebplayer.js not found after webpack build. Check webpack.standalone.config.js.');
  }
  const content = fs.readFileSync(jsFile, 'utf8');
  // webpack 5 writes the public path in the runtime chunk
  if (!content.includes('./')) {
    console.warn('[build-engine] WARNING: "./" not found in crwebplayer.js — ' +
      'verify that output.publicPath is "./" in webpack.standalone.config.js');
  } else {
    console.log('[build-engine] ✓ publicPath appears to be "./"');
  }
}

// ── Step 3: create ZIP ────────────────────────────────────────────────────────

async function createEngineZip() {
  const zip = new JSZip();

  // Built index.html and crwebplayer.js from webpack
  const engineFiles = fs.readdirSync(DIST_ENGINE);
  for (const filename of engineFiles) {
    // §4a — skip any .map files
    if (filename.endsWith('.map')) {
      console.warn(`[build-engine] Skipping source map: ${filename}`);
      continue;
    }
    const filePath = path.join(DIST_ENGINE, filename);
    if (fs.statSync(filePath).isFile()) {
      zip.file(filename, fs.readFileSync(filePath));
    }
  }

  // Engine-level static assets
  for (const asset of ENGINE_STATIC_ASSETS) {
    const srcPath = path.join(ROOT, asset.src);
    if (!fs.existsSync(srcPath)) {
      if (asset.optional) {
        console.warn(`[build-engine] Optional asset not found, skipping: ${asset.src}`);
        continue;
      }
      throw new Error(`Required engine asset not found: ${asset.src}`);
    }
    zip.file(asset.dest, fs.readFileSync(srcPath));
  }

  // §2h — validate Rive fallback if Rive is used
  const riveMain     = path.join(ROOT, 'dist', 'rive', 'rive.wasm');
  const riveFallback = path.join(ROOT, 'dist', 'rive', 'rive_fallback.wasm');
  if (fs.existsSync(riveMain) && !fs.existsSync(riveFallback)) {
    throw new Error(
      '§4a FAIL (§2h): rive.wasm found but rive_fallback.wasm is missing from dist/rive/. ' +
      'Bundle rive_fallback.wasm and call RuntimeLoader.setWasmUrl on file:// — see spec §2h.'
    );
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.mkdirSync(DIST_STANDALONE, { recursive: true });
  fs.writeFileSync(OUT_ZIP, zipBuffer);

  console.log(`[build-engine] ✓ crwp-core.zip written (${(zipBuffer.length / 1024).toFixed(1)} KB)`);
  return zipBuffer;
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  try {
    console.log('\n═══ build-engine.js ═══\n');

    await runWebpack();
    verifyPublicPath();
    const zipBuffer = await createEngineZip();

    await runAllChecks(DIST_STANDALONE, zipBuffer);

    console.log('[build-engine] Done.\n');
  } catch (err) {
    console.error('\n[build-engine] FAILED:', err.message);
    process.exit(1);
  }
})();
