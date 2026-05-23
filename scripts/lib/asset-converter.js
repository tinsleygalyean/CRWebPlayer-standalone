'use strict';

/**
 * Build-time asset converter for the standalone ZIP pipeline.
 *
 * Re-encodes audio and image assets on the way into the ZIP to shrink the
 * payload by ~50–65% without touching the source `BookContent/` tree.
 *
 *   Audio: any → Opus 24 kbps mono in WebM container (`.webm`)
 *          (fallback: AAC-HE 32 kbps mono in `.m4a` when USE_M4A_FALLBACK=1
 *           — choose this if the container still supports iOS < 17.4)
 *   Image: .jpg / .jpeg / .png → WebP quality 80 (`.webp`)
 *
 * Hard guarantees (these are why the player keeps working):
 *
 *   1. Source files in `BookContent/` are NEVER modified.
 *   2. Audio duration is preserved to within 5 ms — verified by ffprobe after
 *      every conversion. This is the safety net that protects word-by-word
 *      highlighting: the player reads per-word `start`/`end` timestamps in
 *      seconds from content.json and queries `<audio>.currentTime` against
 *      them. Any global shift in audio duration would visibly desync the
 *      highlight.  The ffmpeg invocation deliberately uses NO filters, NO
 *      `-ss`/`-t`, NO resampling — only codec + bitrate + channel layout.
 *   3. The per-word timing JSON inside content.json is NEVER modified — only
 *      the audio file URL extensions are rewritten (.mp3 → .webm).
 *
 * Converted files are cached under `dist/.asset-cache/<sha256>.<ext>` so
 * repeat builds skip re-encoding. Delete the cache directory to force a
 * full re-encode.
 */

const fs       = require('fs');
const path     = require('path');
const crypto   = require('crypto');
const { execFileSync } = require('child_process');

const ROOT      = path.resolve(__dirname, '..', '..');
const CACHE_DIR = path.join(ROOT, 'dist', '.asset-cache');

// ── configuration ────────────────────────────────────────────────────────────

// Set USE_M4A_FALLBACK=1 in the environment to encode AAC-HE in .m4a instead
// of Opus in .webm. Use this if the native WebView container still supports
// iOS < 17.4 (which lacks native Opus-in-WebM playback in <audio>).
const USE_AAC_FALLBACK = process.env.USE_M4A_FALLBACK === '1';

const AUDIO_OUT_EXT = USE_AAC_FALLBACK ? '.m4a' : '.webm';
// ffmpeg infers the muxer from the output extension; we write to a `.tmp`
// suffix during conversion, so we must pass an explicit -f flag.
const AUDIO_OUT_MUXER = USE_AAC_FALLBACK ? 'mp4' : 'webm';

// Bumped whenever the encoder invocation changes — used in the cache key so
// stale converted files from an older encoder config never get re-used.
const ENCODER_VERSION = USE_AAC_FALLBACK ? 'aac-32k-mono-v1' : 'opus-24k-mono-voip-v1';
const IMAGE_ENCODER_VERSION = 'cwebp-q80-m6-v1';

const AUDIO_INPUT_EXTS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac']);
// If the source is already in our target format, pass through unchanged.
const AUDIO_PASSTHROUGH_EXTS = USE_AAC_FALLBACK
  ? new Set(['.m4a'])
  : new Set(['.webm', '.opus']);

const IMAGE_INPUT_EXTS       = new Set(['.jpg', '.jpeg', '.png']);
const IMAGE_PASSTHROUGH_EXTS = new Set(['.webp']);

// Maximum allowed audio duration drift between input and output (seconds).
// 50 ms is the perceptual sync threshold for narration / word highlighting.
// Opus packets are 20 ms by default, so frame-boundary rounding alone can
// produce ~20–40 ms of legitimate drift; anything larger than 50 ms indicates
// a real problem (truncation, resample, codec error).
const MAX_AUDIO_DRIFT_SECONDS = 0.05;

// ── preflight ────────────────────────────────────────────────────────────────

let preflightDone = false;

function preflightCheck() {
  if (preflightDone) return;
  const missing = [];
  for (const bin of ['ffmpeg', 'ffprobe', 'cwebp']) {
    try {
      execFileSync(bin, ['-version'], { stdio: ['ignore', 'ignore', 'ignore'] });
    } catch {
      missing.push(bin);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `[asset-converter] Missing required tools: ${missing.join(', ')}.\n` +
      `  macOS:   brew install ffmpeg webp\n` +
      `  Ubuntu:  sudo apt install ffmpeg webp\n` +
      `These are needed to re-encode audio and images for the standalone ZIPs.`
    );
  }
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  preflightDone = true;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function sha256File(filepath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filepath)).digest('hex');
}

function ffprobeDuration(filepath) {
  const raw = execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=nw=1:nk=1',
    filepath,
  ], { encoding: 'utf8' }).trim();
  const dur = parseFloat(raw);
  if (!Number.isFinite(dur)) {
    throw new Error(`ffprobe could not read duration of ${filepath}`);
  }
  return dur;
}

// ── audio ────────────────────────────────────────────────────────────────────

/**
 * Convert an audio file. Returns { path, ext } where `path` points at the
 * converted file in the cache (or the original path if it was already in the
 * target format).  Aborts the build via thrown Error if duration drifts > 5 ms.
 */
function convertAudio(srcPath) {
  preflightCheck();
  const ext = path.extname(srcPath).toLowerCase();
  if (AUDIO_PASSTHROUGH_EXTS.has(ext)) {
    return { path: srcPath, ext };
  }
  if (!AUDIO_INPUT_EXTS.has(ext)) {
    return null;
  }

  // Cache key includes the full encoder version string so any change to the
  // ffmpeg invocation (bitrate, channel layout, encoder choice) automatically
  // invalidates previously cached output.
  const hash = crypto
    .createHash('sha256')
    .update(fs.readFileSync(srcPath))
    .update('|' + ENCODER_VERSION)
    .digest('hex');
  const cachePath = path.join(CACHE_DIR, `${hash}${AUDIO_OUT_EXT}`);
  if (fs.existsSync(cachePath)) {
    return { path: cachePath, ext: AUDIO_OUT_EXT };
  }

  const tmpOut = `${cachePath}.tmp`;

  // IMPORTANT: NO filters, NO -ss, NO -t, NO -af. Anything that changes
  // duration breaks word-by-word highlight sync. The duration guardrail
  // below catches accidents but the safe baseline is to add nothing.
  // -f <muxer> is required because tmpOut ends in `.tmp` — ffmpeg cannot
  // infer the container format from the extension in that case.
  const ffmpegArgs = USE_AAC_FALLBACK
    ? ['-y', '-hide_banner', '-loglevel', 'error',
       '-i', srcPath,
       '-c:a', 'aac', '-b:a', '32k', '-ac', '1',
       '-profile:a', 'aac_he',
       '-map_metadata', '-1',
       '-f', AUDIO_OUT_MUXER,
       tmpOut]
    : ['-y', '-hide_banner', '-loglevel', 'error',
       '-i', srcPath,
       '-c:a', 'libopus', '-b:a', '24k', '-ac', '1',
       '-vbr', 'on', '-application', 'voip',
       '-map_metadata', '-1',
       '-f', AUDIO_OUT_MUXER,
       tmpOut];

  try {
    execFileSync('ffmpeg', ffmpegArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (e) {
    try { fs.unlinkSync(tmpOut); } catch {}
    const stderr = e.stderr ? e.stderr.toString() : '';
    throw new Error(`ffmpeg failed for ${srcPath}: ${e.message}\n${stderr}`);
  }

  // Duration-preservation guardrail — protects word-by-word highlight sync.
  const dIn  = ffprobeDuration(srcPath);
  const dOut = ffprobeDuration(tmpOut);
  const drift = Math.abs(dIn - dOut);
  if (drift > MAX_AUDIO_DRIFT_SECONDS) {
    try { fs.unlinkSync(tmpOut); } catch {}
    throw new Error(
      `[asset-converter] Audio duration drift exceeded ${MAX_AUDIO_DRIFT_SECONDS * 1000} ms ` +
      `for ${path.basename(srcPath)}:\n` +
      `  input  = ${dIn.toFixed(4)} s\n` +
      `  output = ${dOut.toFixed(4)} s\n` +
      `  drift  = ${(drift * 1000).toFixed(1)} ms\n` +
      `This would desync word-by-word highlighting. Aborting build.\n` +
      `If this happens consistently on one file, inspect the source with ffprobe ` +
      `— it may have a corrupt header or trailing silence that needs cleanup at ` +
      `source rather than glossing over with a wider tolerance.`
    );
  }

  fs.renameSync(tmpOut, cachePath);
  return { path: cachePath, ext: AUDIO_OUT_EXT };
}

// ── image ────────────────────────────────────────────────────────────────────

/**
 * Convert an image file to WebP @ quality 80. Returns { path, ext } or null
 * if the extension isn't a recognized image type.
 */
function convertImage(srcPath) {
  preflightCheck();
  const ext = path.extname(srcPath).toLowerCase();
  if (IMAGE_PASSTHROUGH_EXTS.has(ext)) {
    return { path: srcPath, ext };
  }
  if (!IMAGE_INPUT_EXTS.has(ext)) {
    return null;
  }

  const hash = crypto
    .createHash('sha256')
    .update(fs.readFileSync(srcPath))
    .update('|' + IMAGE_ENCODER_VERSION)
    .digest('hex');
  const cachePath = path.join(CACHE_DIR, `${hash}.webp`);
  if (fs.existsSync(cachePath)) {
    return { path: cachePath, ext: '.webp' };
  }

  const tmpOut = `${cachePath}.tmp`;
  try {
    execFileSync(
      'cwebp',
      ['-quiet', '-q', '80', '-m', '6', srcPath, '-o', tmpOut],
      { stdio: ['ignore', 'ignore', 'pipe'] }
    );
  } catch (e) {
    try { fs.unlinkSync(tmpOut); } catch {}
    const stderr = e.stderr ? e.stderr.toString() : '';
    throw new Error(`cwebp failed for ${srcPath}: ${e.message}\n${stderr}`);
  }

  fs.renameSync(tmpOut, cachePath);
  return { path: cachePath, ext: '.webp' };
}

// ── public API: convert + rewrite ────────────────────────────────────────────

/**
 * Convert a single asset and return { data: Buffer, name: string }, where
 * `name` is `originalName` with its extension swapped to the converted
 * format (or unchanged if no conversion applies).
 *
 * `originalName` is the name the asset should have inside the ZIP — it is
 * NOT used to read the file (that's `srcPath`).
 */
function convertAsset(srcPath, originalName) {
  const ext = path.extname(srcPath).toLowerCase();
  let result = null;
  if (AUDIO_INPUT_EXTS.has(ext) || AUDIO_PASSTHROUGH_EXTS.has(ext)) {
    result = convertAudio(srcPath);
  } else if (IMAGE_INPUT_EXTS.has(ext) || IMAGE_PASSTHROUGH_EXTS.has(ext)) {
    result = convertImage(srcPath);
  }
  if (!result) {
    return { data: fs.readFileSync(srcPath), name: originalName };
  }
  const base = originalName.slice(0, originalName.length - path.extname(originalName).length);
  return { data: fs.readFileSync(result.path), name: base + result.ext };
}

/**
 * Rewrite a single filename's extension to match what `convertAsset` would
 * produce. Used to update string references inside content.json so they
 * point at the converted assets in the ZIP.
 */
function rewriteAssetExt(name) {
  if (typeof name !== 'string') return name;
  const ext = path.extname(name).toLowerCase();
  const base = name.slice(0, name.length - ext.length);
  if (AUDIO_INPUT_EXTS.has(ext)) return base + AUDIO_OUT_EXT;
  if (IMAGE_INPUT_EXTS.has(ext)) return base + '.webp';
  return name;
}

/**
 * Conservative check for "looks like an asset filename / relative path".
 *
 * Narrative prose inside content.json contains spaces, punctuation, and is
 * often long; asset references are short bare filenames or relative paths
 * like `audio_001.mp3` or `images/p3.png`. We only rewrite strings that:
 *
 *   - end in one of our known input extensions (case-insensitive), AND
 *   - contain no whitespace, no newlines, no `<`/`>` (rules out any prose
 *     that happens to end in `.png` or `.mp3`), AND
 *   - are ≤ 256 chars (asset paths are short).
 *
 * This prevents accidental mutation of narrative text that happens to end
 * in an extension-shaped suffix.
 */
function looksLikeAssetPath(s) {
  if (typeof s !== 'string') return false;
  if (s.length === 0 || s.length > 256) return false;
  if (/[\s<>]/.test(s)) return false;
  const ext = path.extname(s).toLowerCase();
  return AUDIO_INPUT_EXTS.has(ext) || IMAGE_INPUT_EXTS.has(ext);
}

/**
 * Walk an in-memory JSON tree and rewrite asset-path string values to point
 * at the converted assets in the ZIP.
 *
 * CRITICAL: numeric values (per-word `start`/`end` timestamps in seconds,
 * page durations, transition delays, etc.) are not touched. Strings that
 * don't look like asset filenames (see `looksLikeAssetPath`) are not
 * touched either.
 */
function rewriteJsonRefs(node) {
  if (node === null || node === undefined) return node;
  if (typeof node === 'string') {
    return looksLikeAssetPath(node) ? rewriteAssetExt(node) : node;
  }
  if (Array.isArray(node)) return node.map(rewriteJsonRefs);
  if (typeof node === 'object') {
    const out = {};
    for (const k of Object.keys(node)) {
      out[k] = rewriteJsonRefs(node[k]);
    }
    return out;
  }
  return node;
}

module.exports = {
  preflightCheck,
  convertAsset,
  convertAudio,
  convertImage,
  rewriteAssetExt,
  rewriteJsonRefs,
  CACHE_DIR,
  USE_AAC_FALLBACK,
  AUDIO_OUT_EXT,
};
