// Entry point: generate one participant's randomized design, build the
// jsPsych timeline from it, preload images, and run.
//
// Data saving: the last trial uploads the CSV to DataPipe -> Zenodo
// (js/datapipe.js). on_finish then confirms on screen, or downloads the CSV
// as a backup if the upload failed (js/save-backup.js).

const jsPsych = initJsPsych({
  on_trial_start: () => {
    // Defensive cleanup: the fly-to-strip animation in plugin-item-reveal.js
    // clones the center item image onto document.body (outside jsPsych's
    // managed display element, since the animation needs viewport-fixed
    // positioning) and removes it itself when the transition finishes. If a
    // trial is advanced faster than that transition completes, sweep up any
    // leftover clone here so it never bleeds into the next screen.
    document.querySelectorAll(".wi-fly-clone").forEach((el) => el.remove());
  },
  on_finish: () => confirmOrBackupSave(),
});

function collectAllImagePaths(design) {
  const images = new Set();
  Object.values(COMPREHENSION_IMAGES).forEach((p) => images.add(p));
  design.comprehensionTrials.forEach((c) => {
    images.add(c.characters.left);
    images.add(c.characters.right);
  });
  design.criticalTrials.forEach((t) => {
    images.add(t.characters.left);
    images.add(t.characters.right);
    t.demoItems.forEach((it) => images.add(itemImagePath(it.topic, it.word)));
    t.testItems.forEach((it) => images.add(itemImagePath(it.topic, it.word)));
  });
  return Array.from(images);
}

// Every recording this participant's session can play (both characters'
// lines for every demo/comprehension item, plus each speaker's "don't know").
function collectAllAudioPaths(design) {
  const audio = new Set();
  const add = (speaker, key) => {
    const file = AUDIO_MANIFEST[speaker] && AUDIO_MANIFEST[speaker][key];
    if (file) audio.add(`audio/${file}`);
  };
  const addForPair = (characters, keys) => {
    [characters.left, characters.right].forEach((c) => {
      const speaker = design.voiceByCharacter[c];
      keys.concat([DONT_KNOW_LINE]).forEach((k) => add(speaker, k));
    });
  };
  design.comprehensionTrials.forEach((c) => addForPair(c.characters, [`test_${c.item}`]));
  design.criticalTrials.forEach((t) =>
    addForPair(t.characters, t.demoItems.map((it) => `${it.topic}_${it.word}`))
  );
  return Array.from(audio);
}

function run() {

  const design = generateParticipantDesign(jsPsych.randomization.shuffle);
  console.log("Participant design:", design);
  window.__wiDesign = design; // dev/debug convenience, inspect via console
  jsPsych.data.addProperties({ excluded_topic: design.excludedTopic, block_order: design.blockOrder.join(" > ") });

  const experimentTimeline = buildExperimentTimeline(design);
  const preloadImages = collectAllImagePaths(design);
  const preloadAudio = collectAllAudioPaths(design);
  jsPsych.data.addProperties({ voice_by_character: JSON.stringify(design.voiceByCharacter) });

  const fullTimeline = [
    // Researcher types the participant ID first (sets participant_id on all data).
    { type: ParticipantIdPlugin },
    {
      type: jsPsychPreload,
      images: preloadImages,
      audio: preloadAudio,
      message: "Loading...",
      continue_after_error: true, // placeholder art / MISSING_ images shouldn't block the whole study
    },
    ...experimentTimeline,
    // Last entry so the uploaded CSV includes every trial run above, plus the
    // excluded/exclusion_reason properties set at the end of the timeline.
    buildDataPipeSaveTrial(),
  ];

  jsPsych.run(fullTimeline);
}

run();
