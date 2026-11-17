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

// ---- Hiding the mouse cursor ----
// 1. After CURSOR_HIDE_AFTER_MS without mouse movement the cursor disappears
//    (set to 0 to turn this off).
// 2. hideCursorNow() hides it right away -- called when the child clicks a
//    character (plugin-choice.js), so the cursor isn't left sitting on the
//    character they just picked, cueing them to pick it again.
// Either way it comes back once the mouse moves more than CURSOR_SHOW_DISTANCE_PX
// (so a tiny wobble during the click doesn't bring it straight back).
// Clicks still work while the cursor is hidden.
const CURSOR_HIDE_AFTER_MS = 2000;
const CURSOR_SHOW_DISTANCE_PX = 15;

let cursorTimer = null;
let cursorAnchor = null; // where the mouse was when the cursor was hidden
let lastMouse = null;

function hideCursorNow() {
  clearTimeout(cursorTimer);
  document.body.classList.add("wi-cursor-hidden");
  cursorAnchor = lastMouse;
}

document.addEventListener("mousemove", (e) => {
  lastMouse = { x: e.clientX, y: e.clientY };
  if (document.body.classList.contains("wi-cursor-hidden")) {
    if (cursorAnchor && Math.hypot(e.clientX - cursorAnchor.x, e.clientY - cursorAnchor.y) < CURSOR_SHOW_DISTANCE_PX) {
      return; // small wobble: stay hidden
    }
    document.body.classList.remove("wi-cursor-hidden");
    cursorAnchor = null;
  }
  clearTimeout(cursorTimer);
  if (CURSOR_HIDE_AFTER_MS > 0) cursorTimer = setTimeout(hideCursorNow, CURSOR_HIDE_AFTER_MS);
});

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
