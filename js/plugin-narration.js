// Custom jsPsych v8 plugin: a single "beat" of the story -- an item image
// (optional), two characters (optional), a line of dialogue, and a
// researcher-clicked Continue button. Used for every Experimenter prompt and
// every character response in the comprehension-check and demo phases.
//
// Character lines are played from audio/ (see js/speakers.js) by
// ItemRevealPlugin via playLineAudio() below; Experimenter lines are text only.
class NarrationPlugin {
  static info = {
    name: "wi-narration",
    parameters: {
      line: { type: "OBJECT", default: null }, // { speaker: 'experimenter'|'character', text, side: 'left'|'right'|null, audioFile: string|null }
      itemImage: { type: "STRING", default: null },
      characters: { type: "OBJECT", default: null }, // { left, right }
      activeSide: { type: "STRING", default: null }, // 'left' | 'right' | 'both' | null
      recapItems: { type: "OBJECT", default: null }, // array of { image, leftKnows, rightKnows }
      progressLabel: { type: "STRING", default: null },
      buttonLabel: { type: "STRING", default: "Continue" },
    },
  };

  constructor(jsPsych) {
    this.jsPsych = jsPsych;
  }

  trial(display_element, trial) {
    const startTime = performance.now();
    const parts = [];

    if (trial.characters) {
      parts.push(renderSceneRow(trial.characters, trial.activeSide, false, trial.itemImage, trial.recapItems));
    } else if (trial.itemImage) {
      parts.push(`<img class="wi-item-image" src="${trial.itemImage}" alt="item to name">`);
    }
    parts.push(renderLineSlot(trial.line ? renderLine(trial.line) : ""));
    parts.push(renderButtonSlot(`<button class="jspsych-btn" id="wi-continue-btn">${escapeHtml(trial.buttonLabel)}</button>`));

    display_element.innerHTML = `<div class="wi-screen">${parts.join("\n")}</div>`;

    document.getElementById("wi-continue-btn").addEventListener("click", () => {
      const rt = performance.now() - startTime;
      this.jsPsych.finishTrial({
        rt,
        line_speaker: trial.line ? trial.line.speaker : null,
        line_text: trial.line ? trial.line.text : null,
      });
    });
  }
}

// ---- shared render helpers (used by plugin-choice.js and plugin-item-reveal.js too) ----

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

// ---- Character line audio ---------------------------------------------------
// Only one line plays at a time: starting a new line (or ending the trial)
// stops whatever is still playing. A null path (recording not available yet)
// just leaves the line as text.
let currentLineAudio = null;

function stopLineAudio() {
  if (currentLineAudio) {
    currentLineAudio.pause();
    currentLineAudio = null;
  }
}

// `onDone` (optional) runs once when the line has finished playing -- or right
// away if there's no recording or it can't be played, so the session never
// gets stuck waiting on audio.
function playLineAudio(src, onDone) {
  stopLineAudio();
  let called = false;
  const done = () => {
    if (called) return;
    called = true;
    if (onDone) onDone();
  };
  if (!src) return done();
  const audio = new Audio(src);
  currentLineAudio = audio;
  audio.addEventListener("ended", done, { once: true });
  audio.addEventListener("error", done, { once: true });
  audio.play().catch((err) => {
    console.warn(`[audio] Could not play ${src}:`, err);
    done();
  });
}

// No dialogue text is shown to participants:
//   - Experimenter lines are read aloud by the researcher from
//     experimenter_script.md (they're still saved in the data as line_text).
//   - Character lines are played as audio. Only if a character's recording is
//     missing (audioFile is null) is the line shown as text, as a fallback.
function renderLine(line) {
  if (line.speaker === "experimenter") return "";
  if (line.speaker === "character" && line.audioFile) return "";
  const cls = line.speaker === "experimenter" ? "experimenter" : "character";
  const label = line.speaker === "experimenter" ? "Experimenter" : "";
  return (
    `<p class="wi-line ${cls}">` +
    (label ? `<span class="wi-line-label">${label}</span>` : "") +
    `${escapeHtml(line.text)}</p>`
  );
}

function renderMark(known) {
  if (known === null || known === undefined) {
    return `<span class="wi-recap-mark pending" title="not yet answered"></span>`;
  }
  return `<span class="wi-recap-mark ${known ? "yes" : "no"}" title="${known ? "knew" : "did not know"} this">${known ? "✓" : "✕"}</span>`;
}

// Per the design deck (materials/design.pptx): each item gets its own clone
// of the picture dropped in front of EACH character as that character
// answers, with that character's own checkmark/cross right next to their
// clone -- not one shared mark floating above a head, and not one combined
// strip shared between both sides. So each side keeps its own independent
// row of clones, positioned directly above/in front of that character.
//
// `totalSlots` (defaults to items.length, i.e. no placeholders) reserves
// that many grid cells up front: real items fill the first slots, the rest
// render as invisible placeholders of the same size -- so the grid's
// footprint is constant across a trial (e.g. always the full 2x2 for a
// 4-item demo phase) and the character below never gets pushed down as
// items are revealed one by one. plugin-item-reveal.js morphs each
// placeholder into a real cell in place as that item lands, rather than
// appending a new cell.
// Every screen reserves the full 2x2 grid (RECAP_SLOTS cells) above each
// character -- practice trials, intro screens and test screens included -- so
// the grid and the characters sit in exactly the same place on every screen.
const RECAP_SLOTS = 4;

// ---- Fixed screen layout ----------------------------------------------------
// Every screen with characters is laid out the same way, top to bottom:
//   scene row (grids + characters + item) -> line slot -> button slot.
// The line and button slots always take up the same space (the button slot
// holds an invisible placeholder button on screens without one), so nothing
// shifts vertically between screen types (e.g. demonstration -> test).
function renderLineSlot(innerHtml) {
  return `<div class="wi-line-slot" id="wi-line-slot">${innerHtml}</div>`;
}
function renderButtonSlot(buttonHtml) {
  const inner = buttonHtml || `<button class="jspsych-btn wi-btn-placeholder" tabindex="-1" aria-hidden="true">Continue</button>`;
  return `<div class="wi-button-slot" id="wi-button-slot">${inner}</div>`;
}

function renderSideRecapCellsHtml(items, side, totalSlots) {
  const total = Math.max(totalSlots || 0, items.length, RECAP_SLOTS);
  const cells = [];
  for (let i = 0; i < total; i++) {
    if (i < items.length) {
      const it = items[i];
      const known = side === "left" ? it.leftKnows : it.rightKnows;
      cells.push(
        `<div class="wi-recap-item">` +
          `<img class="wi-recap-thumb" src="${it.image}" alt="">` +
          `<div class="wi-recap-marks">${renderMark(known)}</div>` +
          `</div>`
      );
    } else {
      cells.push(
        `<div class="wi-recap-item wi-recap-placeholder">` +
          `<div class="wi-recap-thumb"></div>` +
          `<div class="wi-recap-marks"><span class="wi-recap-mark"></span></div>` +
          `</div>`
      );
    }
  }
  return cells.join("");
}

// Renders the full scene: [left character, with its own clones above it] --
// (optional) item image -- [right character, with its own clones above it].
// `itemImage`, when given, sits centered between the two characters (the
// item currently being asked about). `recapItems` (an array of
// { image, leftKnows, rightKnows }, or omitted entirely for a plain
// characters-only screen) seeds each side's clone row with already-settled
// items; plugin-item-reveal.js fills in placeholder cells in these same
// elements live as each side answers. `totalSlots` -- see
// renderSideRecapCellsHtml.
function renderSceneRow(characters, activeSide, clickable, itemImage, recapItems, totalSlots) {
  const sideActive = (side) => activeSide === "both" || activeSide === side;
  const column = (side) => {
    const charClass = `wi-character${sideActive(side) ? " active" : ""}${clickable ? " clickable" : ""}`;
    const attrs = `id="wi-char-${side}"` + (clickable ? ` tabindex="0" role="button" data-side="${side}"` : "");
    // Always rendered (empty placeholders on screens with no items yet), so the
    // grid space above each character is identical on every screen.
    const recapHtml = `<div class="wi-recap-strip" id="wi-recap-${side}">${renderSideRecapCellsHtml(recapItems || [], side, totalSlots)}</div>`;
    return (
      `<div class="wi-side-column">` +
      recapHtml +
      `<div class="${charClass}" ${attrs}><img src="${characters[side]}" alt="${side} character"></div>` +
      `</div>`
    );
  };
  const centerImg = itemImage
    ? `<img class="wi-item-image" id="wi-main-item" src="${itemImage}" alt="item to name">`
    : "";
  return `<div class="wi-characters-row">${column("left")}${centerImg}${column("right")}</div>`;
}
