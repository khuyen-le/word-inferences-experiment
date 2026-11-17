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

// ---- Spacebar advance ----
// true: the researcher presses the SPACEBAR to move on (the Continue / Start /
// Finish button is hidden, but its space on screen is kept so nothing moves).
// false: the researcher clicks the button instead.
// Either way, the same rules apply: e.g. it doesn't work while a character's
// audio is still playing.
const ADVANCE_WITH_SPACEBAR = true;

if (ADVANCE_WITH_SPACEBAR) {
  document.body.classList.add("wi-space-mode");
  document.addEventListener("keydown", (e) => {
    if (e.code !== "Space" && e.key !== " ") return;
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return; // typing the participant ID
    e.preventDefault(); // no page scroll / no pressing whatever button has focus
    if (e.repeat) return; // holding the key down only advances once
    const btn = document.getElementById("wi-continue-btn");
    if (btn && !btn.disabled) btn.click();
  });
}

// ---- Hide the mouse cursor when it isn't moving ----
// After CURSOR_HIDE_AFTER_MS without mouse movement the cursor disappears; it
// comes back as soon as the mouse moves. Clicks still work while it's hidden.
// Set to 0 to always show the cursor.
const CURSOR_HIDE_AFTER_MS = 2000;

if (CURSOR_HIDE_AFTER_MS > 0) {
  let cursorTimer = null;
  const showCursorThenHideLater = () => {
    document.body.classList.remove("wi-cursor-hidden");
    clearTimeout(cursorTimer);
    cursorTimer = setTimeout(() => document.body.classList.add("wi-cursor-hidden"), CURSOR_HIDE_AFTER_MS);
  };
  document.addEventListener("mousemove", showCursorThenHideLater);
  showCursorThenHideLater();
}

function collectAllImagePaths(design) {
  const images = new Set();
  Object.values(COMPREHENSION_IMAGES).forEach((p) => images.add(p));
  images.add(BLANK_IMAGE);
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
    // First screen: audio check + switch the browser to full screen.
    {
      type: jsPsychFullscreen,
      fullscreen_mode: true,
      message: "<p>Please check that audio is turned on, and click the below button to enter full screen</p>",
      button_label: "Enter full screen",
    },
    // Load every image and recording first, so the study is ready by the
    // time the researcher has typed the ID.
    {
      type: jsPsychPreload,
      images: preloadImages,
      audio: preloadAudio,
      message: "Loading...",
      continue_after_error: true, // placeholder art / MISSING_ images shouldn't block the whole study
    },
    // Researcher types the participant ID. It's added to every row
    // (participant_id) and used in the saved file's name, so any character
    // other than letters, numbers, "-" or "_" is replaced with "_".
    {
      type: jsPsychSurveyText,
      questions: [{ prompt: "Participant ID", name: "participant_id", required: true }],
      button_label: "Start",
      on_finish: (data) => {
        const id = String(data.response.participant_id).trim().replace(/[^A-Za-z0-9_-]/g, "_");
        jsPsych.data.addProperties({ participant_id: id });
      },
    },
    ...experimentTimeline,
    // Last entry so the uploaded CSV includes every trial run above, plus the
    // excluded/exclusion_reason properties set at the end of the timeline.
    buildDataPipeSaveTrial(),
  ];

  jsPsych.run(fullTimeline);
}

run();
