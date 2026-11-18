// Per-participant design generation: topic pairing, condition assignment,
// item sampling, and speaker success patterns. Pure functions (take a
// `shuffle` function as a parameter) so this file can be unit-tested under
// plain node, outside the browser -- see js/randomize.test.js.

const COMPREHENSION_ITEMS = ["tree", "ball"]; // fixed order: tree (w/ feedback) then ball (exclusion trial)

// ---- Topic pairing -------------------------------------------------------

// Randomly partitions the enabled topics into 4 pairs (+ 1 excluded topic if 9 are enabled), subject
// to the constraint that "sea" and "animal" never end up paired together.
// A session uses 8 topics (4 trials x 2 topics). If more than 8 are enabled
// (see DISABLED_TOPICS in items.js), the extra one is left out at random and
// reported as excludedTopic; with exactly 8 enabled, excludedTopic is null.
const TOPICS_PER_SESSION = 8;

function generateTopicPairs(shuffle, maxAttempts = 200) {
  if (TOPIC_LABELS.length < TOPICS_PER_SESSION) {
    throw new Error(`generateTopicPairs: need ${TOPICS_PER_SESSION} enabled topics, have ${TOPIC_LABELS.length}`);
  }
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const shuffled = shuffle(TOPIC_LABELS.slice());
    const used = shuffled.slice(0, TOPICS_PER_SESSION);
    const excludedTopic = shuffled.length > TOPICS_PER_SESSION ? shuffled[TOPICS_PER_SESSION] : null;
    const pairs = [];
    for (let i = 0; i < used.length; i += 2) {
      pairs.push([used[i], used[i + 1]]);
    }
    const hasForbiddenPair = pairs.some(
      ([a, b]) => (a === "sea" && b === "animal") || (a === "animal" && b === "sea")
    );
    if (!hasForbiddenPair) {
      return { pairs, excludedTopic };
    }
  }
  throw new Error("generateTopicPairs: could not find a valid pairing (sea/animal constraint) after max attempts");
}

// Randomly assigns 2 of the 4 topic-pairs to Difficulty-Contrast and the
// other 2 to Superordinate-Contrast.
function assignConditions(pairs, shuffle) {
  const shuffledPairs = shuffle(pairs.slice());
  return shuffledPairs.map((topics, i) => ({
    topics,
    condition: i < 2 ? "difficulty-contrast" : "superordinate-contrast",
  }));
}

// ---- Item sampling ---------------------------------------------------

// From one topic's pool of 4 easy + 4 difficult words, samples 2 of each
// (without replacement) and splits them into a demo item and a test item.
// TODO: TEMPORARY -- `namersFor(difficulty)` returns the speaker IDs who will
// name that demo item out loud; the demo word is restricted to words all of
// them have a recording of (hasRecordings in speakers.js). Test items can be
// any other word. Once all recordings exist this restriction does nothing.
function sampleItemsForTopic(topicLabel, shuffle, namersFor = () => []) {
  const topic = TOPICS[topicLabel];
  const pickDemoAndTest = (words, difficulty) => {
    const shuffled = shuffle(words.slice());
    const namers = namersFor(difficulty);
    const demo = shuffled.find((w) => hasRecordings(namers, topicLabel, w));
    if (!demo) {
      throw new Error(`sampleItemsForTopic: no ${difficulty} ${topicLabel} word has recordings from ${namers.join(", ")}`);
    }
    const test = shuffled.find((w) => w !== demo);
    return [demo, test];
  };
  const [demoEasy, testEasy] = pickDemoAndTest(topic.easy, "easy");
  const [demoDifficult, testDifficult] = pickDemoAndTest(topic.difficult, "difficult");
  return {
    demo: { easy: demoEasy, difficult: demoDifficult },
    test: { easy: testEasy, difficult: testDifficult },
  };
}

// ---- Critical trial construction -----------------------------------------

// Which "role" names a demo item, given the condition:
// - difficulty-contrast: the primary side names all 4 items; the other side
//   names only the 2 easy items and fails both difficult items.
// - superordinate-contrast: both name the easy items; the primary side owns
//   topicA's difficult item (fails topicB's), the other side is the mirror.
function roleKnowledge(condition, topic, difficulty, topicA) {
  if (difficulty === "easy") return { primaryKnows: true, otherKnows: true };
  if (condition === "difficulty-contrast") return { primaryKnows: true, otherKnows: false };
  return topic === topicA
    ? { primaryKnows: true, otherKnows: false }
    : { primaryKnows: false, otherKnows: true };
}

// Builds the demo + test item lists for one critical trial, including which
// side (left/right character) succeeds on each demo item.
// `primarySide` ('left' | 'right') fixes which side plays the "primary" role
// (in Difficulty-Contrast: the speaker who knows MORE, i.e. names the difficult
// items too). If omitted, it's random.
// `voiceByCharacter` (character image -> speaker ID) is used to pick demo
// words the naming speaker has recorded; if omitted, no restriction.
function buildCriticalTrial(topicsAndCondition, characterAssignment, shuffle, primarySide, voiceByCharacter = {}) {
  const { topics, condition } = topicsAndCondition;
  const { gender, pair } = characterAssignment;
  const [topicA, topicB] = topics;

  // Randomize which concrete character image sits on the left vs. right.
  const [leftChar, rightChar] = shuffle(pair.slice());

  // Which side plays which role: given (counterbalanced by the caller), or random.
  const leftIsPrimary = primarySide ? primarySide === "left" : shuffle([true, false])[0];

  const knowsFor = (topic, difficulty) => {
    const { primaryKnows, otherKnows } = roleKnowledge(condition, topic, difficulty, topicA);
    return {
      leftKnows: leftIsPrimary ? primaryKnows : otherKnows,
      rightKnows: leftIsPrimary ? otherKnows : primaryKnows,
    };
  };

  // Speakers who will say each demo item out loud (for the recording check).
  const namersFor = (topic) => (difficulty) => {
    const { leftKnows, rightKnows } = knowsFor(topic, difficulty);
    return [leftKnows && voiceByCharacter[leftChar], rightKnows && voiceByCharacter[rightChar]].filter(Boolean);
  };
  const sampledA = sampleItemsForTopic(topicA, shuffle, namersFor(topicA));
  const sampledB = sampleItemsForTopic(topicB, shuffle, namersFor(topicB));

  const demoItems = shuffle(
    [
      { topic: topicA, difficulty: "easy", word: sampledA.demo.easy },
      { topic: topicA, difficulty: "difficult", word: sampledA.demo.difficult },
      { topic: topicB, difficulty: "easy", word: sampledB.demo.easy },
      { topic: topicB, difficulty: "difficult", word: sampledB.demo.difficult },
    ].map((item) => ({ ...item, ...knowsFor(item.topic, item.difficulty) }))
  );

  const testItems = shuffle([
    { topic: topicA, difficulty: "easy", word: sampledA.test.easy },
    { topic: topicA, difficulty: "difficult", word: sampledA.test.difficult },
    { topic: topicB, difficulty: "easy", word: sampledB.test.easy },
    { topic: topicB, difficulty: "difficult", word: sampledB.test.difficult },
  ]);

  return {
    condition,
    topics,
    gender,
    characters: { left: leftChar, right: rightChar },
    demoItems,
    testItems,
  };
}

// ---- Comprehension check construction -------------------------------------

// Counterbalanced: the character who knows the item is on the left in one of
// the two trials and on the right in the other (which trial gets which is random).
function buildComprehensionTrials(comprehensionPairs, shuffle) {
  const knowSides = shuffle(["left", "right"]);
  return COMPREHENSION_ITEMS.map((item, i) => {
    const { gender, pair } = comprehensionPairs[i];
    const [leftChar, rightChar] = shuffle(pair.slice());
    const knowSide = knowSides[i];
    return {
      item,
      gender, // 'girl' | 'boy' -- which pair plays this comprehension trial
      withFeedback: i === 0, // first trial (tree) gives feedback; second (ball) is the exclusion trial
      characters: { left: leftChar, right: rightChar },
      knowSide,
    };
  });
}

// ---- Top-level design generation -----------------------------------------

function generateParticipantDesign(shuffle) {
  const { pairs, excludedTopic } = generateTopicPairs(shuffle);
  const trialConditions = assignConditions(pairs, shuffle);

  const { criticalPairs, comprehensionPairs } = buildCharacterAssignment(shuffle);

  // Character image path -> speaker ID (see speakers.js; temporary 5-speaker setup).
  const voiceByCharacter = assignVoices(criticalPairs.concat(comprehensionPairs), shuffle);

  // Counterbalanced: across the 2 Difficulty-Contrast trials, the speaker who
  // knows more is on the left once and on the right once (order random).
  // Superordinate-Contrast trials keep a random side.
  const dcPrimarySides = shuffle(["left", "right"]);
  let dcIndex = 0;
  const builtTrials = trialConditions.map((tc, i) => {
    const primarySide = tc.condition === "difficulty-contrast" ? dcPrimarySides[dcIndex++] : undefined;
    return buildCriticalTrial(tc, criticalPairs[i], shuffle, primarySide, voiceByCharacter);
  });

  // Blocked by condition: both Difficulty-Contrast trials together and both
  // Superordinate-Contrast trials together. Block order is random, and so is
  // trial order within each block.
  const blockOrder = shuffle(["difficulty-contrast", "superordinate-contrast"]);
  const criticalTrials = blockOrder.flatMap((condition) =>
    shuffle(builtTrials.filter((t) => t.condition === condition))
  );

  const comprehensionTrials = buildComprehensionTrials(comprehensionPairs, shuffle);

  return { excludedTopic, comprehensionTrials, criticalTrials, voiceByCharacter, blockOrder };
}

// Node (test) / browser (app) interop.
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    generateTopicPairs,
    assignConditions,
    sampleItemsForTopic,
    buildCriticalTrial,
    buildComprehensionTrials,
    generateParticipantDesign,
  };
}
