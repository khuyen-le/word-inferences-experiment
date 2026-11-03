// Builds the full jsPsych timeline (a flat array of trial objects) from a
// design object produced by generateParticipantDesign() in randomize.js.

function articleFor(word) {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// One "demo item" = a single ItemRevealPlugin trial, which internally steps
// through prompt -> left line -> left ack -> right line -> right ack, and
// animates this item's mark into the recap strip as each side responds.
// `recapSoFar` is the list of already-completed items in this trial (shown
// fully-formed, no animation); the function returns that list with this
// item appended, for the caller to pass into the next item's call.
function buildDemoItemTrial(item, characters, recapSoFar, progressLabel, voices, extraData) {
  const itemImage = itemImagePath(item.topic, item.word);
  const article = articleFor(item.word);

  const lineFor = (knows, side) => ({
    text: knows ? `This is ${article} ${item.word}.` : "I don't know what this is called.",
    audioFile: speakerAudioPath(voices[side], knows ? `${item.topic}_${item.word}` : DONT_KNOW_LINE),
  });
  const ackFor = (knows) => ({
    text: knows ? `That's correct, this is ${article} ${item.word}!` : "Okay!",
  });

  const trial = {
    type: ItemRevealPlugin,
    progressLabel,
    itemImage,
    characters,
    leftKnows: item.leftKnows,
    rightKnows: item.rightKnows,
    promptLine: { speaker: "experimenter", text: "What's this? Let's ask our friends!" },
    leftLine: lineFor(item.leftKnows, "left"),
    leftAck: ackFor(item.leftKnows),
    rightLine: lineFor(item.rightKnows, "right"),
    rightAck: ackFor(item.rightKnows),
    recapSoFar,
    totalItemsInTrial: 4,
    voices,
    // Saved on this trial's data row: which item was demonstrated and what
    // each character answered ("knows" = named it, "doesnt_know" = said
    // "I don't know what this is called.").
    data: {
      ...extraData,
      topic: item.topic,
      difficulty: item.difficulty,
      word: item.word,
      left_knows: item.leftKnows,
      right_knows: item.rightKnows,
      left_answer: item.leftKnows ? "knows" : "doesnt_know",
      right_answer: item.rightKnows ? "knows" : "doesnt_know",
    },
  };

  const newRecap = recapSoFar.concat([{ image: itemImage, leftKnows: item.leftKnows, rightKnows: item.rightKnows }]);
  return { trial, newRecap };
}

// Speaker IDs for the two characters on screen (see speakers.js).
function voicesFor(characters, voiceByCharacter) {
  return { left: voiceByCharacter[characters.left], right: voiceByCharacter[characters.right] };
}

function buildComprehensionTrialTimeline(comp, trialIndex, voiceByCharacter) {
  const timeline = [];
  const { characters, item, knowSide, withFeedback, gender } = comp;
  const voices = voicesFor(characters, voiceByCharacter);
  const itemImage = COMPREHENSION_IMAGES[item];
  const article = articleFor(item);
  const progressLabel = `Comprehension check ${trialIndex + 1} of 2`;
  const peopleWord = gender === "girl" ? "girls" : "boys";

  const introText =
    trialIndex === 0
      ? `These ${peopleWord} are playing a naming game. Let's watch.`
      : `Here are two more friends (${peopleWord}) playing the naming game.`;
  timeline.push({
    type: NarrationPlugin,
    progressLabel,
    characters,
    activeSide: "both",
    line: { speaker: "experimenter", text: introText },
  });

  const leftKnows = knowSide === "left";
  const rightKnows = knowSide === "right";
  const lineFor = (knows, side) => ({
    text: knows ? `This is ${article} ${item}.` : "I don't know what this is called.",
    audioFile: speakerAudioPath(voices[side], knows ? `test_${item}` : DONT_KNOW_LINE),
  });
  const ackFor = (knows) => ({
    text: knows ? `That's correct, this is ${article} ${item}!` : "Okay!",
  });

  timeline.push({
    type: ItemRevealPlugin,
    progressLabel,
    itemImage,
    characters,
    leftKnows,
    rightKnows,
    promptLine: { speaker: "experimenter", text: "What's this? Let's ask them!" },
    leftLine: lineFor(leftKnows, "left"),
    leftAck: ackFor(leftKnows),
    rightLine: lineFor(rightKnows, "right"),
    rightAck: ackFor(rightKnows),
    recapSoFar: [],
    totalItemsInTrial: 1,
    voices,
  });

  const recapItems = [{ image: itemImage, leftKnows, rightKnows }];
  const dontKnowSide = knowSide === "left" ? "right" : "left";

  // Two sub-questions in a fixed order: trial 1 (tree) asks "who knows" then
  // "who doesn't know"; trial 2 (ball) asks them the other way around. Trial 1
  // gets feedback, trial 2 doesn't (but is still scored for exclusion).
  const knowsQ = { text: `Who knows that this is ${article} ${item}?`, correctSide: knowSide, key: "knows" };
  const doesntKnowQ = { text: `Who doesn't know that this is ${article} ${item}?`, correctSide: dontKnowSide, key: "doesnt_know" };
  const subQuestions = trialIndex === 0 ? [knowsQ, doesntKnowQ] : [doesntKnowQ, knowsQ];

  for (const q of subQuestions) {
    timeline.push({
      type: ChoicePlugin,
      progressLabel,
      itemImage,
      characters,
      recapItems,
      promptLine: { speaker: "experimenter", text: q.text },
      feedback: withFeedback ? { enabled: true, correctSide: q.correctSide } : { enabled: false },
      meta: {
        phase: "comprehension",
        comprehension_item: item,
        comprehension_question: q.key,
        correct_side: q.correctSide,
        left_speaker: voices.left,
        right_speaker: voices.right,
      },
      on_finish: (data) => {
        data.correct = data.chosen_side === q.correctSide;
      },
    });
  }

  return timeline;
}

function rolesForCriticalTrial(trial) {
  // Describes, in plain terms, "who" each side is -- for convenient logging
  // on every test-phase response, without re-deriving it from demoItems.
  if (trial.condition === "difficulty-contrast") {
    const leftIsPrimary = trial.demoItems.every((d) => d.leftKnows);
    return {
      left: leftIsPrimary ? "knows_all_demoed_items" : "knows_only_easy_demoed_items",
      right: leftIsPrimary ? "knows_only_easy_demoed_items" : "knows_all_demoed_items",
    };
  }
  const [topicA, topicB] = trial.topics;
  const leftKnowsTopicADifficult = trial.demoItems.find((d) => d.topic === topicA && d.difficulty === "difficult").leftKnows;
  return {
    left: leftKnowsTopicADifficult ? `knows_${topicA}_difficult` : `knows_${topicB}_difficult`,
    right: leftKnowsTopicADifficult ? `knows_${topicB}_difficult` : `knows_${topicA}_difficult`,
  };
}

function buildCriticalTrialTimeline(trial, trialIndex, voiceByCharacter) {
  const timeline = [];
  const { characters, condition, topics, gender } = trial;
  const voices = voicesFor(characters, voiceByCharacter);
  const trialNumber = trialIndex + 1; // saved as critical_trial_index (1-4)
  const progressLabel = `Critical trial ${trialNumber} of 4 (${condition})`;
  const peopleWord = gender === "girl" ? "girls" : "boys";

  const introText =
    trialIndex === 0
      ? `These ${peopleWord} are playing the naming game too.`
      : `Here are two more friends (${peopleWord}) playing the naming game.`;
  timeline.push({
    type: NarrationPlugin,
    progressLabel,
    characters,
    activeSide: "both",
    line: { speaker: "experimenter", text: introText },
  });

  // ---- Demonstration phase ----
  let recap = [];
  trial.demoItems.forEach((item, i) => {
    const { trial: itemTrial, newRecap } = buildDemoItemTrial(
      item,
      characters,
      recap,
      `${progressLabel} - demo item ${i + 1} of 4`,
      voices,
      { phase: "demo", condition, topics, critical_trial_index: trialNumber, demo_item_index: i + 1 }
    );
    timeline.push(itemTrial);
    recap = newRecap;
  });

  // ---- Break between demonstration and test ----
  // Same scene (characters + their answer grids), with a blank card where
  // the item was. The researcher clicks Continue to start the test phase.
  timeline.push({
    type: NarrationPlugin,
    progressLabel,
    characters,
    itemImage: BLANK_IMAGE,
    recapItems: recap,
    line: null,
    data: { phase: "demo_to_test", condition, topics, critical_trial_index: trialNumber },
  });

  // ---- Test phase ----
  const roles = rolesForCriticalTrial(trial);
  trial.testItems.forEach((item, i) => {
    const itemImage = itemImagePath(item.topic, item.word);
    timeline.push({
      type: ChoicePlugin,
      progressLabel: `${progressLabel} - test item ${i + 1} of 4`,
      itemImage,
      characters,
      recapItems: recap,
      promptLine: { speaker: "experimenter", text: "Who knows what this is called?" },
      feedback: { enabled: false },
      meta: {
        phase: "test",
        condition,
        topics,
        topic: item.topic,
        difficulty: item.difficulty,
        word: item.word,
        left_role: roles.left,
        right_role: roles.right,
        left_speaker: voices.left,
        right_speaker: voices.right,
        critical_trial_index: trialNumber,
        test_item_index: i + 1,
      },
    });
  });

  return timeline;
}

function buildExperimentTimeline(design) {
  const timeline = [];

  timeline.push({
    type: NarrationPlugin,
    line: {
      speaker: "experimenter",
      text: "Hi! Today we're going to play a naming game and watch some friends play too. Let's get started!",
    },
    buttonLabel: "Start",
  });

  // ---- Comprehension check (with exclusion gate after trial 2) ----
  let excluded = false;
  let exclusionReason = null;

  design.comprehensionTrials.forEach((comp, i) => {
    const compTimeline = buildComprehensionTrialTimeline(comp, i, design.voiceByCharacter);
    timeline.push(...compTimeline);

    if (i === 1) {
      // After the second (no-feedback) comprehension trial, check both
      // sub-question responses and gate the rest of the experiment.
      timeline.push({
        type: NarrationPlugin,
        line: { speaker: "experimenter", text: "..." }, // placeholder beat replaced in on_start below
        on_start: function (trial) {
          const compData = jsPsych.data.get().filter({ phase: "comprehension", comprehension_item: comp.item });
          const allCorrect = compData.values().every((d) => d.correct === true);
          excluded = !allCorrect;
          if (excluded) {
            exclusionReason = "failed_comprehension_check_trial_2";
            // This is the last screen for an excluded child.
            jsPsych.data.addProperties({ excluded: true, exclusion_reason: exclusionReason });
            trial.line = {
              speaker: "experimenter",
              text: "Thank you so much for playing with us today!",
            };
            trial.buttonLabel = "Finish";
          } else {
            trial.line = { speaker: "experimenter", text: "Great! Now let's watch some more friends play." };
          }
        },
      });
    }
  });

  // ---- Critical trials (skipped entirely if excluded) ----
  const criticalTimeline = [];
  design.criticalTrials.forEach((trial, i) => {
    criticalTimeline.push(...buildCriticalTrialTimeline(trial, i, design.voiceByCharacter));
  });
  timeline.push({
    timeline: criticalTimeline,
    conditional_function: () => !excluded,
  });

  // Wrapped in a timeline node: in jsPsych 8, conditional_function on a bare
  // trial doesn't skip it, so an excluded child would otherwise see this
  // screen too (and be recorded as excluded = false).
  timeline.push({
    conditional_function: () => !excluded,
    timeline: [{
      type: NarrationPlugin,
      line: { speaker: "experimenter", text: "Thank you so much for playing with us today!" },
      buttonLabel: "Finish",
      on_start: () => {
        jsPsych.data.addProperties({ excluded: false, exclusion_reason: null });
      },
    }],
  });

  return timeline;
}
