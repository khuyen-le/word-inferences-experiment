// Character art pools.
//
// Both the comprehension check (2 trials) AND the critical trials (4 trials)
// are gender-mixed: 1 girl trial + 1 boy trial for comprehension, 2 girl
// trials + 2 boy trials for critical, each trial getting its own new,
// never-repeated pair. Totals needed per session:
//   - girls: 2 (comprehension) + 4 (critical, 2 trials x 2) = 6
//   - boys:  2 (comprehension) + 4 (critical, 2 trials x 2) = 6
// All 12 characters (girl1-6, boy1-6) have real art in characters/.
// Each character's voice is assigned in speakers.js.

const GIRL_POOL = [
  "characters/girl1.png",
  "characters/girl2.png",
  "characters/girl3.png",
  "characters/girl4.png",
  "characters/girl5.png",
  "characters/girl6.png",
];

const BOY_POOL = [
  "characters/boy1.png",
  "characters/boy2.png",
  "characters/boy3.png",
  "characters/boy4.png",
  "characters/boy5.png",
  "characters/boy6.png",
];

// Shuffles `pool` (using the given `shuffle` function), then slices it into
// consecutive pairs: [[a,b], [c,d], ...]. Throws if `pool.length` isn't
// even, since every character must be used in exactly one pair with none
// left over and none repeated.
function makeNonRepeatingPairs(pool, shuffle) {
  if (pool.length % 2 !== 0) {
    throw new Error(`makeNonRepeatingPairs: pool size (${pool.length}) must be even`);
  }
  const shuffled = shuffle(pool.slice());
  const pairs = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    pairs.push([shuffled[i], shuffled[i + 1]]);
  }
  return pairs;
}

// Builds the full session's character assignment. Each gender's 6-character
// pool splits into exactly 3 non-repeating pairs: 2 go to critical trials,
// 1 goes to the comprehension check -- so every character in the pool is
// used exactly once, nothing left over.
//   - criticalPairs: 4 entries (2 girl + 2 boy, shuffled together), each
//     { gender, pair: [left, right] }, aligned 1:1 with the 4 critical
//     trials (by index) before that list is itself shuffled for order.
//   - comprehensionPairs: 2 entries (1 girl + 1 boy), shuffled order,
//     aligned 1:1 with the 2 comprehension trials (tree, then ball).
function buildCharacterAssignment(shuffle) {
  const girlPairs = makeNonRepeatingPairs(GIRL_POOL, shuffle); // 3 pairs
  const boyPairs = makeNonRepeatingPairs(BOY_POOL, shuffle); // 3 pairs

  const criticalPairs = shuffle([
    { gender: "girl", pair: girlPairs[0] },
    { gender: "girl", pair: girlPairs[1] },
    { gender: "boy", pair: boyPairs[0] },
    { gender: "boy", pair: boyPairs[1] },
  ]);

  const comprehensionPairs = shuffle([
    { gender: "girl", pair: girlPairs[2] },
    { gender: "boy", pair: boyPairs[2] },
  ]);

  return { criticalPairs, comprehensionPairs };
}
