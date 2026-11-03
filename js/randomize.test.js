// Node-only test harness for randomize.js. Run with: node js/randomize.test.js
// Loads the browser-style (global `const`, no modules) source files into a
// shared vm context, since they're normally loaded via <script> tags.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const context = { console, module: { exports: {} } };
vm.createContext(context);

function load(file) {
  const code = fs.readFileSync(path.join(__dirname, file), "utf8");
  vm.runInContext(code, context, { filename: file });
}

load("image-manifest.generated.js");
load("items.js");
load("characters.js");
load("audio-manifest.generated.js");
load("speakers.js");
load("randomize.js");

const {
  generateTopicPairs,
  sampleItemsForTopic,
  buildCriticalTrial,
  generateParticipantDesign,
} = context.module.exports;
// Top-level `const` bindings from vm.runInContext aren't own-properties of
// the context object, so fetch them by evaluating a reference expression.
const TOPIC_LABELS = vm.runInContext("TOPIC_LABELS", context);
const TOPICS = vm.runInContext("TOPICS", context);

// Simple seeded-ish shuffle (Fisher-Yates using Math.random -- fine for tests;
// we run many iterations to probabilistically cover edge cases).
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  }
}
function assertEqual(a, b, msg) {
  assert(JSON.stringify(a) === JSON.stringify(b), `${msg} (got ${JSON.stringify(a)}, expected ${JSON.stringify(b)})`);
}

const N = 2000;

// ---- generateTopicPairs ----
for (let i = 0; i < N; i++) {
  const { pairs, excludedTopic } = generateTopicPairs(shuffle);
  assertEqual(pairs.length, 4, "generateTopicPairs: 4 pairs");
  const allUsed = pairs.flat();
  assertEqual(allUsed.length, 8, "generateTopicPairs: 8 topics used");
  assertEqual(new Set(allUsed).size, 8, "generateTopicPairs: no topic reused across pairs");
  assert(!allUsed.includes(excludedTopic), "generateTopicPairs: excluded topic not reused");
  assertEqual(new Set(allUsed).size, 8, "generateTopicPairs: 8 distinct topics used");
  assertEqual(allUsed.length + (excludedTopic ? 1 : 0), TOPIC_LABELS.length, "generateTopicPairs: all enabled topics accounted for");
  assert(!allUsed.includes("sea"), "generateTopicPairs: disabled topic (sea) never used");
  const hasForbidden = pairs.some(([a, b]) => (a === "sea" && b === "animal") || (a === "animal" && b === "sea"));
  assert(!hasForbidden, "generateTopicPairs: sea/animal never paired");
}

// ---- sampleItemsForTopic ----
for (const label of TOPIC_LABELS) {
  for (let i = 0; i < 50; i++) {
    const sampled = sampleItemsForTopic(label, shuffle);
    const topic = TOPICS[label];
    assert(topic.easy.includes(sampled.demo.easy), `sampleItemsForTopic(${label}): demo.easy from pool`);
    assert(topic.easy.includes(sampled.test.easy), `sampleItemsForTopic(${label}): test.easy from pool`);
    assert(sampled.demo.easy !== sampled.test.easy, `sampleItemsForTopic(${label}): demo/test easy distinct`);
    assert(topic.difficult.includes(sampled.demo.difficult), `sampleItemsForTopic(${label}): demo.difficult from pool`);
    assert(topic.difficult.includes(sampled.test.difficult), `sampleItemsForTopic(${label}): test.difficult from pool`);
    assert(sampled.demo.difficult !== sampled.test.difficult, `sampleItemsForTopic(${label}): demo/test difficult distinct`);
  }
}

// ---- buildCriticalTrial: difficulty-contrast pattern ----
for (let i = 0; i < N; i++) {
  const topics = shuffle(TOPIC_LABELS)[0] === TOPIC_LABELS[0] ? ["animal", "vehicle"] : ["kitchen", "clothes"];
  const trial = buildCriticalTrial({ topics, condition: "difficulty-contrast" }, { gender: "boy", pair: ["L.png", "R.png"] }, shuffle);
  assertEqual(trial.demoItems.length, 4, "DC: 4 demo items");
  assertEqual(trial.testItems.length, 4, "DC: 4 test items");
  const easyItems = trial.demoItems.filter((it) => it.difficulty === "easy");
  const difficultItems = trial.demoItems.filter((it) => it.difficulty === "difficult");
  assertEqual(easyItems.length, 2, "DC: 2 easy demo items");
  assertEqual(difficultItems.length, 2, "DC: 2 difficult demo items");
  // Exactly one side knows everything; the other knows only the easy items.
  const leftKnowsAll = trial.demoItems.every((it) => it.leftKnows);
  const rightKnowsAll = trial.demoItems.every((it) => it.rightKnows);
  assert(leftKnowsAll || rightKnowsAll, "DC: one side knows all 4 demo items");
  assert(!(leftKnowsAll && rightKnowsAll), "DC: not both sides know everything");
  const weakSide = leftKnowsAll ? "rightKnows" : "leftKnows";
  for (const it of trial.demoItems) {
    assertEqual(it[weakSide], it.difficulty === "easy", "DC: weak side only knows easy items");
  }
}

// ---- buildCriticalTrial: superordinate-contrast pattern ----
for (let i = 0; i < N; i++) {
  const topics = ["furniture", "instrument"];
  const trial = buildCriticalTrial({ topics, condition: "superordinate-contrast" }, { gender: "boy", pair: ["L.png", "R.png"] }, shuffle);
  // Both sides know both easy items.
  for (const it of trial.demoItems.filter((x) => x.difficulty === "easy")) {
    assert(it.leftKnows && it.rightKnows, "SC: both sides know easy items");
  }
  const difficultItems = trial.demoItems.filter((it) => it.difficulty === "difficult");
  assertEqual(difficultItems.length, 2, "SC: 2 difficult demo items");
  // For difficult items: exactly one side knows topics[0]'s difficult item,
  // the other side knows topics[1]'s difficult item, and nobody knows both
  // or neither.
  const d0 = difficultItems.find((it) => it.topic === topics[0]);
  const d1 = difficultItems.find((it) => it.topic === topics[1]);
  assert(d0 && d1, "SC: one difficult item per topic");
  assert(d0.leftKnows !== d1.leftKnows, "SC: left knows exactly one of the two difficult topics");
  assert(d0.rightKnows !== d1.rightKnows, "SC: right knows exactly one of the two difficult topics");
  assert(d0.leftKnows !== d0.rightKnows, "SC: the two sides split on topic 0's difficult item");
  assert(d1.leftKnows !== d1.rightKnows, "SC: the two sides split on topic 1's difficult item");
}

// ---- full design generation ----
for (let i = 0; i < 500; i++) {
  const design = generateParticipantDesign(shuffle);
  assertEqual(design.criticalTrials.length, 4, "design: 4 critical trials");
  assertEqual(design.comprehensionTrials.length, 2, "design: 2 comprehension trials");
  assertEqual(design.comprehensionTrials[0].item, "tree", "design: comprehension trial 1 is tree");
  assertEqual(design.comprehensionTrials[0].withFeedback, true, "design: comprehension trial 1 has feedback");
  assertEqual(design.comprehensionTrials[1].item, "ball", "design: comprehension trial 2 is ball");
  assertEqual(design.comprehensionTrials[1].withFeedback, false, "design: comprehension trial 2 has no feedback");

  const nDC = design.criticalTrials.filter((t) => t.condition === "difficulty-contrast").length;
  const nSC = design.criticalTrials.filter((t) => t.condition === "superordinate-contrast").length;
  assertEqual(nDC, 2, "design: 2 difficulty-contrast trials");
  assertEqual(nSC, 2, "design: 2 superordinate-contrast trials");

  // No topic used in more than one critical trial.
  const allTopicsUsed = design.criticalTrials.flatMap((t) => t.topics);
  assertEqual(new Set(allTopicsUsed).size, 8, "design: 8 distinct topics across all critical trials");
  assert(!allTopicsUsed.includes(design.excludedTopic), "design: excluded topic unused in critical trials");

  // No character reused across critical trials.
  const allCriticalChars = design.criticalTrials.flatMap((t) => [t.characters.left, t.characters.right]);
  assertEqual(new Set(allCriticalChars).size, 8, "design: 8 distinct characters across critical trials");

  // Critical trials are 2 girl trials + 2 boy trials, and each trial's
  // characters actually match its gender tag.
  const criticalGenders = design.criticalTrials.map((t) => t.gender).sort();
  assertEqual(criticalGenders, ["boy", "boy", "girl", "girl"], "design: critical trials are 2 girl + 2 boy");
  design.criticalTrials.forEach((t) => {
    const prefix = t.gender === "girl" ? "characters/girl" : "characters/boy";
    assert(t.characters.left.startsWith(prefix), `design: critical ${t.gender} trial left char matches gender`);
    assert(t.characters.right.startsWith(prefix), `design: critical ${t.gender} trial right char matches gender`);
  });

  // No character reused across comprehension trials.
  const allComprehensionChars = design.comprehensionTrials.flatMap((t) => [t.characters.left, t.characters.right]);
  assertEqual(new Set(allComprehensionChars).size, 4, "design: 4 distinct characters across comprehension trials");

  // Comprehension is one girl pair + one boy pair (one gender per trial, no duplicate genders).
  const genders = design.comprehensionTrials.map((t) => t.gender).sort();
  assertEqual(genders, ["boy", "girl"], "design: comprehension trials are one boy pair + one girl pair");
  design.comprehensionTrials.forEach((t) => {
    const prefix = t.gender === "girl" ? "characters/girl" : "characters/boy";
    assert(t.characters.left.startsWith(prefix), `design: comprehension ${t.gender} trial left char matches gender`);
    assert(t.characters.right.startsWith(prefix), `design: comprehension ${t.gender} trial right char matches gender`);
  });

  // Comprehension and critical-trial character pools never overlap. Totals:
  // 6 distinct girls used (4 critical + 2 comprehension) and 6 distinct boys
  // used (4 critical + 2 comprehension) -- the full pool of each gender,
  // nothing left over, nothing repeated.
  const overlap = allCriticalChars.filter((c) => allComprehensionChars.includes(c));
  assertEqual(overlap.length, 0, "design: comprehension and critical character pools disjoint");
  const allGirlCharsUsed = allCriticalChars.concat(allComprehensionChars).filter((c) => c.includes("girl"));
  const allBoyCharsUsed = allCriticalChars.concat(allComprehensionChars).filter((c) => c.includes("boy"));
  assertEqual(new Set(allGirlCharsUsed).size, 6, "design: 6 distinct girl characters used (4 critical + 2 comprehension)");
  assertEqual(new Set(allBoyCharsUsed).size, 6, "design: 6 distinct boy characters used (4 critical + 2 comprehension)");

  // Voices: every character has a speaker whose recordings are tagged with the
  // character's gender (b = boy, g = girl), and the two characters in a pair
  // never share a voice.
  const AUDIO_SPEAKER_GENDER = vm.runInContext("AUDIO_SPEAKER_GENDER", context);
  design.criticalTrials.concat(design.comprehensionTrials).forEach((t) => {
    const left = design.voiceByCharacter[t.characters.left];
    const right = design.voiceByCharacter[t.characters.right];
    assert(left && right, "voices: both characters have a speaker");
    assertEqual(AUDIO_SPEAKER_GENDER[left], t.gender, `voices: left speaker gender matches ${t.gender} character`);
    assertEqual(AUDIO_SPEAKER_GENDER[right], t.gender, `voices: right speaker gender matches ${t.gender} character`);
    assert(left !== right, "voices: characters in a pair have different speakers");
  });

  // Blocks: trials 1-2 share a condition, trials 3-4 share the other one,
  // matching blockOrder.
  const conds = design.criticalTrials.map((t) => t.condition);
  assertEqual(conds, [design.blockOrder[0], design.blockOrder[0], design.blockOrder[1], design.blockOrder[1]],
    "blocks: critical trials are grouped by condition in blockOrder");
  assert(design.blockOrder[0] !== design.blockOrder[1], "blocks: two different conditions");

  // Counterbalancing: comprehension "knower" is left once and right once.
  assertEqual(design.comprehensionTrials.map((c) => c.knowSide).sort(), ["left", "right"],
    "counterbalance: comprehension knower on left once and right once");
  // Difficulty-Contrast: the speaker who knows more (names every demo item) is left once and right once.
  const dcMoreSides = design.criticalTrials
    .filter((t) => t.condition === "difficulty-contrast")
    .map((t) => (t.demoItems.every((d) => d.leftKnows) ? "left" : "right"))
    .sort();
  assertEqual(dcMoreSides, ["left", "right"], "counterbalance: DC more-knowledgeable speaker on left once and right once");

  // Every line a character says has a recording from that character's speaker.
  const AUDIO_MANIFEST = vm.runInContext("AUDIO_MANIFEST", context);
  design.criticalTrials.forEach((t) => {
    t.demoItems.forEach((it) => {
      [t.characters.left, t.characters.right].forEach((c) => {
        const s = design.voiceByCharacter[c];
        assert(AUDIO_MANIFEST[s][`${it.topic}_${it.word}`], `audio: ${s} has a recording of demo item ${it.topic}_${it.word}`);
      });
    });
  });
}

if (failures === 0) {
  console.log(`All tests passed (${N} iterations for core checks, 500 for full design).`);
  process.exit(0);
} else {
  console.error(`${failures} assertion(s) failed.`);
  process.exit(1);
}
