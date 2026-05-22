'use strict';

/**
 * Content catalog: maps every BookContent/<DirName> to a stable (bookSlug, langCode) pair.
 *
 * Rules:
 *  - bookSlug: lowercase ASCII, dashes only, stable forever
 *  - langCode: must match Feed The Monster's existing on-device slugs so cached
 *    content survives across releases. Where the FTM spelling differs from the
 *    more standard linguistic form, the FTM spelling wins for back-compat.
 *
 * Canonical (linguistic) name  →  FTM slug used here:
 *   Cape Verdean Creole         →  caboverdecreole       (was 'cvkreole')
 *   Cape Verdean Portuguese     →  caboverdeportuguese   (was 'cvportuguese')
 *   isiZulu                     →  zulu                  (was 'isizulu')
 *   Luganda                     →  lugandan              (was 'luganda')
 *   Tigrinya                    →  tigragna              (was 'tigrinya')
 *
 * Flagged duplicates (two source dirs map to the same target) are noted inline.
 * The catalog is the single source of truth for the build scripts.
 */

const CATALOG = [
  // ── Bee and the Elephant ────────────────────────────────────────────────────
  { dir: 'BeeandElephantPashto',          bookSlug: 'the-bee-and-the-elephant', langCode: 'pashto' },
  { dir: 'TheBeeAndTheElephantEnLv4',     bookSlug: 'the-bee-and-the-elephant', langCode: 'english' },
  { dir: 'TheBeeAndTheElephantHindiLv4',  bookSlug: 'the-bee-and-the-elephant', langCode: 'hindi' },
  { dir: 'TheBeeAndTheElephantIsiZuluLv4',bookSlug: 'the-bee-and-the-elephant', langCode: 'zulu' },
  { dir: 'TheBeeAndTheElephantLugLv4',    bookSlug: 'the-bee-and-the-elephant', langCode: 'lugandan' },
  { dir: 'TheBeeAndTheElephantNepLv4',    bookSlug: 'the-bee-and-the-elephant', langCode: 'nepali' },
  { dir: 'TheBeeAndTheElephantUkrLv6',    bookSlug: 'the-bee-and-the-elephant', langCode: 'ukrainian' },
  { dir: 'TheBeeAndTheElephantWolofLv4',  bookSlug: 'the-bee-and-the-elephant', langCode: 'wolof' },

  // ── Chaku's Cycle ───────────────────────────────────────────────────────────
  { dir: 'ChakusCycleBangla',             bookSlug: 'chakus-cycle', langCode: 'bangla' },
  { dir: 'ChakusCycleCVCreole',           bookSlug: 'chakus-cycle', langCode: 'caboverdecreole' },
  { dir: 'ChakusCycleCVPortuguese',       bookSlug: 'chakus-cycle', langCode: 'caboverdeportuguese' },
  { dir: 'ChakusCycleFrench',             bookSlug: 'chakus-cycle', langCode: 'french' },
  { dir: 'ChakusCycleHausa',              bookSlug: 'chakus-cycle', langCode: 'hausa' },
  { dir: 'ChakusCycleHindi',              bookSlug: 'chakus-cycle', langCode: 'hindi' },
  { dir: 'ChakusCycleIsiZulu',            bookSlug: 'chakus-cycle', langCode: 'zulu' },
  { dir: 'ChakusCycleLuganda',            bookSlug: 'chakus-cycle', langCode: 'lugandan' },
  { dir: 'ChakusCycleMarathi',            bookSlug: 'chakus-cycle', langCode: 'marathi' },
  { dir: 'ChakusCycleNepali',             bookSlug: 'chakus-cycle', langCode: 'nepali' },
  { dir: 'ChakusCycleSwahili',            bookSlug: 'chakus-cycle', langCode: 'swahili' },
  { dir: 'ChakusCycleUkrainian',          bookSlug: 'chakus-cycle', langCode: 'ukrainian' },

  // ── Cicada's Song ───────────────────────────────────────────────────────────
  { dir: 'CicadasSongEnLv4',              bookSlug: 'cicadas-song', langCode: 'english' },
  { dir: 'CicadasSongUkrLv6',             bookSlug: 'cicadas-song', langCode: 'ukrainian' },

  // ── Colours (Level 4) ───────────────────────────────────────────────────────
  { dir: 'ColoursEnLv4',                  bookSlug: 'colours-level-4', langCode: 'english' },
  { dir: 'ColoursFrenchLv4',              bookSlug: 'colours-level-4', langCode: 'french' },
  { dir: 'ColoursHindiLv4',               bookSlug: 'colours-level-4', langCode: 'hindi' },
  { dir: 'ColoursIsiZuluLv4',             bookSlug: 'colours-level-4', langCode: 'zulu' },
  { dir: 'ColoursLugLv4',                 bookSlug: 'colours-level-4', langCode: 'lugandan' },
  { dir: 'ColoursNepLv4',                 bookSlug: 'colours-level-4', langCode: 'nepali' },
  { dir: 'ColoursPashto',                 bookSlug: 'colours-level-4', langCode: 'pashto' },
  { dir: 'ColoursUkrLv6',                 bookSlug: 'colours-level-4', langCode: 'ukrainian' },
  { dir: 'ColoursWolofLv4',               bookSlug: 'colours-level-4', langCode: 'wolof' },

  // ── Colours (Level 2) ───────────────────────────────────────────────────────
  { dir: 'ColoursLevel2En',               bookSlug: 'colours-level-2', langCode: 'english' },

  // ── Colours of Nature ───────────────────────────────────────────────────────
  { dir: 'ColoursOfNatureEnLv2',          bookSlug: 'colours-of-nature', langCode: 'english' },

  // ── Come Come ───────────────────────────────────────────────────────────────
  { dir: 'ComeComeAmharic',               bookSlug: 'come-come', langCode: 'amharic' },
  { dir: 'ComeComeOromo',                 bookSlug: 'come-come', langCode: 'oromo' },
  { dir: 'ComeComeSomali',                bookSlug: 'come-come', langCode: 'somali' },
  { dir: 'ComeComeTigirigna',             bookSlug: 'come-come', langCode: 'tigragna' },

  // ── Dad's Boots ─────────────────────────────────────────────────────────────
  { dir: 'DadsBootsFrench',               bookSlug: 'dads-boots', langCode: 'french' },
  { dir: 'DadsBootsHausa',                bookSlug: 'dads-boots', langCode: 'hausa' },
  { dir: 'DadsBootsHindi',                bookSlug: 'dads-boots', langCode: 'hindi' },
  { dir: 'DadsBootsIsiZulu',              bookSlug: 'dads-boots', langCode: 'zulu' },
  { dir: 'DadsBootsLuganda',              bookSlug: 'dads-boots', langCode: 'lugandan' },
  { dir: 'DadsBootsMarathi',              bookSlug: 'dads-boots', langCode: 'marathi' },
  { dir: 'DadsBootsNepali',               bookSlug: 'dads-boots', langCode: 'nepali' },
  { dir: 'DadsBootsSwahili',              bookSlug: 'dads-boots', langCode: 'swahili' },
  { dir: 'DadsBootsUkrainian',            bookSlug: 'dads-boots', langCode: 'ukrainian' },

  // ── Friends ─────────────────────────────────────────────────────────────────
  { dir: 'FriendsBanglaLv4',              bookSlug: 'friends', langCode: 'bangla' },
  { dir: 'FriendsCVPortugueseLv4',        bookSlug: 'friends', langCode: 'caboverdeportuguese' },
  { dir: 'FriendsEnLv2',                  bookSlug: 'friends', langCode: 'english' },
  { dir: 'FriendsFrench',                 bookSlug: 'friends', langCode: 'french' },
  { dir: 'FriendsHIndiLv4',               bookSlug: 'friends', langCode: 'hindi' },
  { dir: 'FriendsHausa',                  bookSlug: 'friends', langCode: 'hausa' },
  { dir: 'FriendsLugandaLv4',             bookSlug: 'friends', langCode: 'lugandan' },
  { dir: 'FriendsMarathiLv4',             bookSlug: 'friends', langCode: 'marathi' },
  { dir: 'FriendsNepaliLv4',              bookSlug: 'friends', langCode: 'nepali' },
  { dir: 'FriendsSwahiliLv4',             bookSlug: 'friends', langCode: 'swahili' },
  { dir: 'FriendsUkrainianLv4',           bookSlug: 'friends', langCode: 'ukrainian' },

  // ── Frog's Starry Wish ──────────────────────────────────────────────────────
  { dir: 'FrogsStarryWishFrench',         bookSlug: 'frogs-starry-wish', langCode: 'french' },
  { dir: 'FrogsStarryWishHausa',          bookSlug: 'frogs-starry-wish', langCode: 'hausa' },
  { dir: 'FrogsStarryWishHindi',          bookSlug: 'frogs-starry-wish', langCode: 'hindi' },
  { dir: 'FrogsStarryWishIsiZulu',        bookSlug: 'frogs-starry-wish', langCode: 'zulu' },
  { dir: 'FrogsStarryWishLuganda',        bookSlug: 'frogs-starry-wish', langCode: 'lugandan' },
  { dir: 'FrogsStarryWishMarathi',        bookSlug: 'frogs-starry-wish', langCode: 'marathi' },
  { dir: 'FrogsStarryWishNepali',         bookSlug: 'frogs-starry-wish', langCode: 'nepali' },
  { dir: 'FrogsStarryWishSwahili',        bookSlug: 'frogs-starry-wish', langCode: 'swahili' },
  { dir: 'FrogsStarryWishUkrainian',      bookSlug: 'frogs-starry-wish', langCode: 'ukrainian' },

  // ── Guess What I Am ─────────────────────────────────────────────────────────
  { dir: 'GuessWhatIAmAmharic',           bookSlug: 'guess-what-i-am', langCode: 'amharic' },
  { dir: 'GuessWhatIAmOromo',             bookSlug: 'guess-what-i-am', langCode: 'oromo' },
  { dir: 'GuessWhatIAmSomali',            bookSlug: 'guess-what-i-am', langCode: 'somali' },
  { dir: 'GuessWhatIAmTigirigna',         bookSlug: 'guess-what-i-am', langCode: 'tigragna' },

  // ── Hide and Seek ───────────────────────────────────────────────────────────
  // NOTE: HideAndSeekEnLv2 and HideAndSeekLevel4En are two different English levels.
  // They are treated as separate source dirs for the same book; the build script
  // will warn if two dirs resolve to the same (bookSlug, langCode) pair and pick the first.
  { dir: 'HideAndSeekEnLv2',              bookSlug: 'hide-and-seek', langCode: 'english' },
  { dir: 'HideAndSeekLevel4En',           bookSlug: 'hide-and-seek', langCode: 'english',   duplicate: true },
  { dir: 'HideAndSeekHindiLv4',           bookSlug: 'hide-and-seek', langCode: 'hindi' },
  { dir: 'HideAndSeekIsiZuluLv4',         bookSlug: 'hide-and-seek', langCode: 'zulu' },
  { dir: 'HideAndSeekLugLv4',             bookSlug: 'hide-and-seek', langCode: 'lugandan' },
  { dir: 'HideAndSeekNepLv4',             bookSlug: 'hide-and-seek', langCode: 'nepali' },
  { dir: 'HideAndSeekUkrLv6',             bookSlug: 'hide-and-seek', langCode: 'ukrainian' },
  { dir: 'HideAndSeekWolofLv4',           bookSlug: 'hide-and-seek', langCode: 'wolof' },

  // ── I Am Flying ─────────────────────────────────────────────────────────────
  { dir: 'IAmFlyingAmharic',              bookSlug: 'i-am-flying', langCode: 'amharic' },
  { dir: 'IAmFlyingOromo',               bookSlug: 'i-am-flying', langCode: 'oromo' },
  { dir: 'IAmFlyingSomali',               bookSlug: 'i-am-flying', langCode: 'somali' },
  { dir: 'IAmFlyingTigirigna',            bookSlug: 'i-am-flying', langCode: 'tigragna' },

  // ── I Am Not Afraid ─────────────────────────────────────────────────────────
  { dir: 'IAmNotAfraidEnLv4',             bookSlug: 'i-am-not-afraid', langCode: 'english' },

  // ── I Love ──────────────────────────────────────────────────────────────────
  { dir: 'ILoveAmharic',                  bookSlug: 'i-love', langCode: 'amharic' },
  { dir: 'ILoveOromo',                    bookSlug: 'i-love', langCode: 'oromo' },
  { dir: 'ILoveSomali',                   bookSlug: 'i-love', langCode: 'somali' },
  { dir: 'ILoveTigirigna',               bookSlug: 'i-love', langCode: 'tigragna' },

  // ── Let's Fly ───────────────────────────────────────────────────────────────
  { dir: 'LetsFlyLevel2En',               bookSlug: 'lets-fly', langCode: 'english' },
  { dir: 'LetsFlyHindiLv4',              bookSlug: 'lets-fly', langCode: 'hindi' },
  { dir: 'LetsFlyIsiZuluLv4',             bookSlug: 'lets-fly', langCode: 'zulu' },
  { dir: 'LetsFlyLugLv4',                bookSlug: 'lets-fly', langCode: 'lugandan' },
  { dir: 'LetsFlyNepLv4',               bookSlug: 'lets-fly', langCode: 'nepali' },
  { dir: 'LetsFlyPashto',                 bookSlug: 'lets-fly', langCode: 'pashto' },
  { dir: 'LetsFlyUkrLv6',                bookSlug: 'lets-fly', langCode: 'ukrainian' },
  { dir: 'LetsFlyWolofLv4',              bookSlug: 'lets-fly', langCode: 'wolof' },

  // ── My First Day at the Market ──────────────────────────────────────────────
  { dir: 'MyFirstDayAtTheMarketHindi',    bookSlug: 'my-first-day-at-the-market', langCode: 'hindi' },
  // NOTE: IsiZulu exists in two dirs with different casing — only the first is used.
  { dir: 'MyFirstDayAtTheMarketIsiZulu',  bookSlug: 'my-first-day-at-the-market', langCode: 'zulu' },
  { dir: 'MyFirstDayAtTheMarketIsizulu',  bookSlug: 'my-first-day-at-the-market', langCode: 'zulu',  duplicate: true },
  { dir: 'MyFirstDayAtTheMarketLuganda',  bookSlug: 'my-first-day-at-the-market', langCode: 'lugandan' },
  { dir: 'MyFirstDayAtTheMarketNepali',   bookSlug: 'my-first-day-at-the-market', langCode: 'nepali' },
  { dir: 'MyFirstDayAtTheMarketUkrainian',bookSlug: 'my-first-day-at-the-market', langCode: 'ukrainian' },

  // ── Playground ──────────────────────────────────────────────────────────────
  { dir: 'PlaygroundBangla',              bookSlug: 'playground', langCode: 'bangla' },
  { dir: 'PlaygroundCVPortuguese',        bookSlug: 'playground', langCode: 'caboverdeportuguese' },
  { dir: 'PlaygroundFrench',              bookSlug: 'playground', langCode: 'french' },
  { dir: 'PlaygroundHausa',               bookSlug: 'playground', langCode: 'hausa' },
  { dir: 'PlaygroundHindi',               bookSlug: 'playground', langCode: 'hindi' },
  { dir: 'PlaygroundIsiZulu',             bookSlug: 'playground', langCode: 'zulu' },
  { dir: 'PlaygroundLuganda',             bookSlug: 'playground', langCode: 'lugandan' },
  { dir: 'PlaygroundMarathi',             bookSlug: 'playground', langCode: 'marathi' },
  { dir: 'PlaygroundNepali',              bookSlug: 'playground', langCode: 'nepali' },
  { dir: 'PlaygroundSwahili',             bookSlug: 'playground', langCode: 'swahili' },
  { dir: 'PlaygroundUkrainian',           bookSlug: 'playground', langCode: 'ukrainian' },

  // ── Talking Bag ─────────────────────────────────────────────────────────────
  { dir: 'TalkingBagEn',                  bookSlug: 'talking-bag', langCode: 'english' },

  // ── Tall and Short ──────────────────────────────────────────────────────────
  { dir: 'TallAndShortBanglaLv4',         bookSlug: 'tall-and-short', langCode: 'bangla' },
  { dir: 'TallAndShortCVCreoleLv4',       bookSlug: 'tall-and-short', langCode: 'caboverdecreole' },
  { dir: 'TallAndShortCVPortugueseLv4',   bookSlug: 'tall-and-short', langCode: 'caboverdeportuguese' },
  { dir: 'TallAndShortEnLv4',             bookSlug: 'tall-and-short', langCode: 'english' },
  { dir: 'TallAndShortFrench',            bookSlug: 'tall-and-short', langCode: 'french' },
  { dir: 'TallAndShortHausaLv4',          bookSlug: 'tall-and-short', langCode: 'hausa' },
  { dir: 'TallAndShortHindiLv4',          bookSlug: 'tall-and-short', langCode: 'hindi' },
  { dir: 'TallAndShortIsiZuluLv4',        bookSlug: 'tall-and-short', langCode: 'zulu' },
  { dir: 'TallAndShortLugandaLv4',        bookSlug: 'tall-and-short', langCode: 'lugandan' },
  { dir: 'TallAndShortMarathiLv4',        bookSlug: 'tall-and-short', langCode: 'marathi' },
  { dir: 'TallAndShortNepaliLv4',         bookSlug: 'tall-and-short', langCode: 'nepali' },
  { dir: 'TallAndShortSwahiliLv4',        bookSlug: 'tall-and-short', langCode: 'swahili' },
  // NOTE: TallAndShortUk and TallAndShortUkrLv6 both map to Ukrainian; first wins.
  { dir: 'TallAndShortUk',               bookSlug: 'tall-and-short', langCode: 'ukrainian' },
  { dir: 'TallAndShortUkrLv6',           bookSlug: 'tall-and-short', langCode: 'ukrainian',  duplicate: true },
  { dir: 'TallandShortPashto',            bookSlug: 'tall-and-short', langCode: 'pashto' },

  // ── The Lion Runs and the Cow Walks ─────────────────────────────────────────
  { dir: 'TheLionRunsAndTheCowWalksBangla',        bookSlug: 'the-lion-runs-and-the-cow-walks', langCode: 'bangla' },
  { dir: 'TheLionRunsAndTheCowWalksCVPortuguese',  bookSlug: 'the-lion-runs-and-the-cow-walks', langCode: 'caboverdeportuguese' },
  { dir: 'TheLionRunsAndTheCowWalksFrench',        bookSlug: 'the-lion-runs-and-the-cow-walks', langCode: 'french' },
  { dir: 'TheLionRunsAndTheCowWalksHausa',         bookSlug: 'the-lion-runs-and-the-cow-walks', langCode: 'hausa' },
  { dir: 'TheLionRunsAndTheCowWalksHindi',         bookSlug: 'the-lion-runs-and-the-cow-walks', langCode: 'hindi' },
  { dir: 'TheLionRunsAndTheCowWalksIsiZulu',       bookSlug: 'the-lion-runs-and-the-cow-walks', langCode: 'zulu' },
  { dir: 'TheLionRunsAndTheCowWalksLuganda',       bookSlug: 'the-lion-runs-and-the-cow-walks', langCode: 'lugandan' },
  { dir: 'TheLionRunsAndTheCowWalksMarathi',       bookSlug: 'the-lion-runs-and-the-cow-walks', langCode: 'marathi' },
  { dir: 'TheLionRunsAndTheCowWalksNepali',        bookSlug: 'the-lion-runs-and-the-cow-walks', langCode: 'nepali' },
  { dir: 'TheLionRunsAndTheCowWalksSwahili',       bookSlug: 'the-lion-runs-and-the-cow-walks', langCode: 'swahili' },
  { dir: 'TheLionRunsAndTheCowWalksUkrainian',     bookSlug: 'the-lion-runs-and-the-cow-walks', langCode: 'ukrainian' },

  // ── The Lost Doll ───────────────────────────────────────────────────────────
  { dir: 'TheLostDollEnLv4',              bookSlug: 'the-lost-doll', langCode: 'english' },
  { dir: 'TheLostDollHindiLv4',           bookSlug: 'the-lost-doll', langCode: 'hindi' },
  { dir: 'TheLostDollIsiZuluLv4',         bookSlug: 'the-lost-doll', langCode: 'zulu' },
  { dir: 'TheLostDollLugLv4',             bookSlug: 'the-lost-doll', langCode: 'lugandan' },
  { dir: 'TheLostDollNepLv4',             bookSlug: 'the-lost-doll', langCode: 'nepali' },
  { dir: 'TheLostDollPashto',             bookSlug: 'the-lost-doll', langCode: 'pashto' },
  { dir: 'TheLostDollUkrLv4',             bookSlug: 'the-lost-doll', langCode: 'ukrainian' },
  { dir: 'TheLostDollWolofLv4',           bookSlug: 'the-lost-doll', langCode: 'wolof' },

  // ── The Umbrellas ───────────────────────────────────────────────────────────
  { dir: 'TheUmbrellasAmharic',           bookSlug: 'the-umbrellas', langCode: 'amharic' },
  { dir: 'TheUmbrellasOromo',             bookSlug: 'the-umbrellas', langCode: 'oromo' },
  { dir: 'TheUmbrellasSomali',            bookSlug: 'the-umbrellas', langCode: 'somali' },
  { dir: 'TheUmbrellasTigirigna',         bookSlug: 'the-umbrellas', langCode: 'tigragna' },

  // ── What Day Is It ──────────────────────────────────────────────────────────
  { dir: 'WhatDayIsItFrench',             bookSlug: 'what-day-is-it', langCode: 'french' },
  { dir: 'WhatDayIsItHindi',              bookSlug: 'what-day-is-it', langCode: 'hindi' },
  { dir: 'WhatDayIsItIsiZulu',            bookSlug: 'what-day-is-it', langCode: 'zulu' },
  { dir: 'WhatDayIsItLuganda',            bookSlug: 'what-day-is-it', langCode: 'lugandan' },
  { dir: 'WhatDayIsItMarathi',            bookSlug: 'what-day-is-it', langCode: 'marathi' },
  { dir: 'WhatDayIsItNepali',             bookSlug: 'what-day-is-it', langCode: 'nepali' },
  { dir: 'WhatDayIsItSwahili',            bookSlug: 'what-day-is-it', langCode: 'swahili' },
  { dir: 'WhatDayIsItUkrainian',          bookSlug: 'what-day-is-it', langCode: 'ukrainian' },

  // ── Who Can Help Me ─────────────────────────────────────────────────────────
  { dir: 'WhoCanHelpMeBangla',            bookSlug: 'who-can-help-me', langCode: 'bangla' },
  { dir: 'WhoCanHelpMeCVCreole',          bookSlug: 'who-can-help-me', langCode: 'caboverdecreole' },
  { dir: 'WhoCanHelpMeFrench',            bookSlug: 'who-can-help-me', langCode: 'french' },
  { dir: 'WhoCanHelpMeHausa',             bookSlug: 'who-can-help-me', langCode: 'hausa' },
  { dir: 'WhoCanHelpMeHindi',             bookSlug: 'who-can-help-me', langCode: 'hindi' },
  { dir: 'WhoCanHelpMeIsiZulu',           bookSlug: 'who-can-help-me', langCode: 'zulu' },
  { dir: 'WhoCanHelpMeLuganda',           bookSlug: 'who-can-help-me', langCode: 'lugandan' },
  { dir: 'WhoCanHelpMeMarathi',           bookSlug: 'who-can-help-me', langCode: 'marathi' },
  { dir: 'WhoCanHelpMeNepali',            bookSlug: 'who-can-help-me', langCode: 'nepali' },
  { dir: 'WhoCanHelpMeSwahili',           bookSlug: 'who-can-help-me', langCode: 'swahili' },
  { dir: 'WhoCanHelpMeUkrainian',         bookSlug: 'who-can-help-me', langCode: 'ukrainian' },
];

/**
 * Return catalog entries for a given bookSlug (excluding duplicates).
 */
function getLanguagesForBook(bookSlug) {
  return CATALOG.filter(e => e.bookSlug === bookSlug && !e.duplicate);
}

/**
 * Return the unique set of book slugs.
 */
function getAllBookSlugs() {
  const seen = new Set();
  return CATALOG
    .filter(e => !e.duplicate)
    .map(e => e.bookSlug)
    .filter(slug => { if (seen.has(slug)) return false; seen.add(slug); return true; });
}

/**
 * Look up the source BookContent directory for a given (bookSlug, langCode).
 * Returns null if not found.
 */
function getSourceDir(bookSlug, langCode) {
  const entry = CATALOG.find(e => e.bookSlug === bookSlug && e.langCode === langCode && !e.duplicate);
  return entry ? entry.dir : null;
}

/**
 * Validate the catalog for (bookSlug, langCode) collisions and report them.
 */
function validateCatalog() {
  const seen = new Map();
  const warnings = [];
  for (const entry of CATALOG) {
    const key = `${entry.bookSlug}::${entry.langCode}`;
    if (seen.has(key) && !entry.duplicate) {
      warnings.push(`COLLISION: ${entry.dir} conflicts with ${seen.get(key)} for key ${key}`);
    } else if (!entry.duplicate) {
      seen.set(key, entry.dir);
    }
  }
  return warnings;
}

module.exports = { CATALOG, getLanguagesForBook, getAllBookSlugs, getSourceDir, validateCatalog };
