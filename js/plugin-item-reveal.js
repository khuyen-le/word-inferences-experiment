// Custom jsPsych v8 plugin: reveals one item (comprehension item, or one
// demo item within a critical trial) across 5 researcher-paced beats:
//   prompt -> left character's line -> experimenter ack -> right character's
//   line -> experimenter ack
// Per the design deck (materials/design.pptx), each item gets its own clone
// of the picture dropped in front of EACH character as that character
// answers, with that character's own checkmark/cross right next to their
// clone. So there are two independent fly animations per item: the center
// image clones into the LEFT character's row when their line appears, and
// separately clones into the RIGHT character's row when theirs appears --
// never a single mark shared between both sides. Previously-completed items
// (`recapSoFar`) are rendered fully-formed, already in place, on both sides.
//
// All item imagery (the big center image and every clone thumbnail) shares
// the same display treatment (object-fit: contain in a fixed square box),
// so the fly animation is a clean scale+translate between two same-shaped
// boxes, never a crop/distortion jump.
class ItemRevealPlugin {
  static info = {
    name: "wi-item-reveal",
    parameters: {
      itemImage: { type: "STRING", default: null },
      characters: { type: "OBJECT", default: null }, // { left, right }
      leftKnows: { type: "BOOL", default: true },
      rightKnows: { type: "BOOL", default: true },
      promptLine: { type: "OBJECT", default: { speaker: "experimenter", text: "What's this? Let's ask our friends!" } },
      leftLine: { type: "OBJECT", default: null }, // { text, audioFile }
      leftAck: { type: "OBJECT", default: null }, // { text }
      rightLine: { type: "OBJECT", default: null }, // { text, audioFile }
      rightAck: { type: "OBJECT", default: null }, // { text }
      recapSoFar: { type: "OBJECT", default: [] }, // array of { image, leftKnows, rightKnows }, already complete
      totalItemsInTrial: { type: "INT", default: 4 }, // reserves this many grid slots up front (see renderSideRecapCellsHtml)
      progressLabel: { type: "STRING", default: null },
      voices: { type: "OBJECT", default: null }, // { left, right } speaker IDs, logged in the data
    },
  };

  constructor(jsPsych) {
    this.jsPsych = jsPsych;
  }

  trial(display_element, trial) {
    const startTime = performance.now();
    const steps = ["prompt", "left-line", "left-ack", "right-line", "right-ack"];
    let stepIndex = 0;

    display_element.innerHTML =
      `<div class="wi-screen">` +
      `<div id="wi-characters-slot"></div>` +
      renderLineSlot("") +
      renderButtonSlot(`<button class="jspsych-btn" id="wi-continue-btn">Continue</button>`) +
      `</div>`;

    // Characters + item image + each side's clone grid render ONCE, with
    // `totalItemsInTrial` grid slots reserved up front (real cells for
    // recapSoFar, invisible placeholders for the rest) -- so the grid's
    // footprint is constant for the whole trial and the character below
    // never gets pushed down as items land. Later steps only toggle classes
    // and morph a placeholder into a real cell in place, never append.
    const charSlot = document.getElementById("wi-characters-slot");
    charSlot.innerHTML = renderSceneRow(
      trial.characters,
      null,
      false,
      trial.itemImage,
      trial.recapSoFar,
      trial.totalItemsInTrial
    );
    const lineSlot = document.getElementById("wi-line-slot");
    const leftStrip = document.getElementById("wi-recap-left");
    const rightStrip = document.getElementById("wi-recap-right");

    function setActiveSide(side) {
      document.getElementById("wi-char-left").classList.toggle("active", side === "both" || side === "left");
      document.getElementById("wi-char-right").classList.toggle("active", side === "both" || side === "right");
    }
    function setLine(line) {
      lineSlot.innerHTML = renderLine(line);
    }

    // Morphs `side`'s next placeholder cell into a real one (same cell, same
    // grid position -- no new cell is appended, so nothing reflows), fills
    // in that side's mark -- fully known immediately, no "pending" state
    // needed since each side only ever shows its own answer -- and flies the
    // center image into the now-visible thumbnail.
    function cloneItemToSide(side, knows) {
      const strip = side === "left" ? leftStrip : rightStrip;
      const cell = strip.querySelector(".wi-recap-placeholder");
      if (!cell) return; // totalItemsInTrial was set too low for this trial's item count
      cell.classList.remove("wi-recap-placeholder");

      const img = document.createElement("img");
      img.className = "wi-recap-thumb";
      img.src = trial.itemImage;
      img.style.opacity = "0";
      img.alt = "";
      cell.querySelector(".wi-recap-thumb").replaceWith(img);
      cell.querySelector(".wi-recap-marks").innerHTML = renderMark(knows);

      const mainImg = document.getElementById("wi-main-item");
      flyImageToStrip(mainImg, img);
    }

    function render(step) {
      if (step === "prompt") {
        setActiveSide(null);
        setLine(trial.promptLine);
      } else if (step === "left-line") {
        setActiveSide("left");
        setLine({ speaker: "character", side: "left", text: trial.leftLine.text, audioFile: trial.leftLine.audioFile });
        playLineAudio(trial.leftLine.audioFile);
      } else if (step === "left-ack") {
        // The fly animation runs after the character has spoken, not at the
        // same moment their line appears -- it accompanies the
        // Experimenter's acknowledgement, not the line itself.
        setActiveSide("left");
        setLine({ speaker: "experimenter", text: trial.leftAck.text });
        cloneItemToSide("left", trial.leftKnows);
      } else if (step === "right-line") {
        setActiveSide("right");
        setLine({ speaker: "character", side: "right", text: trial.rightLine.text, audioFile: trial.rightLine.audioFile });
        playLineAudio(trial.rightLine.audioFile);
      } else if (step === "right-ack") {
        setActiveSide("right");
        setLine({ speaker: "experimenter", text: trial.rightAck.text });
        cloneItemToSide("right", trial.rightKnows);
      }
    }

    render(steps[stepIndex]);

    document.getElementById("wi-continue-btn").addEventListener(
      "click",
      function onClick() {
        stepIndex++;
        if (stepIndex >= steps.length) {
          document.getElementById("wi-continue-btn").removeEventListener("click", onClick);
          const rt = performance.now() - startTime;
          stopLineAudio();
          this.finishTrial({
            rt,
            left_speaker: trial.voices ? trial.voices.left : null,
            right_speaker: trial.voices ? trial.voices.right : null,
            left_audio: trial.leftLine.audioFile || null,
            right_audio: trial.rightLine.audioFile || null,
          });
        } else {
          render(steps[stepIndex]);
        }
      }.bind(this)
    );
  }

  finishTrial(data) {
    this.jsPsych.finishTrial(data);
  }
}

// FLIP-style fly animation: clones `sourceEl`, positions the clone exactly
// over it, then animates (transform: translate + scale) to land exactly
// over `targetEl`. Both elements use the same object-fit: contain box
// treatment, so the motion reads as "the same picture" shrinking into place
// -- never a crop/distortion jump. Skips the animation (shows instantly)
// when the OS requests reduced motion.
function flyImageToStrip(sourceEl, targetEl) {
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const startRect = sourceEl.getBoundingClientRect();
  const endRect = targetEl.getBoundingClientRect();

  if (reduceMotion || startRect.width === 0 || endRect.width === 0) {
    targetEl.style.opacity = "1";
    return;
  }

  const clone = sourceEl.cloneNode(true);
  clone.removeAttribute("id");
  clone.classList.add("wi-fly-clone"); // tagged so a stray clone can be swept up if a new trial starts mid-flight
  Object.assign(clone.style, {
    position: "fixed",
    left: `${startRect.left}px`,
    top: `${startRect.top}px`,
    width: `${startRect.width}px`,
    height: `${startRect.height}px`,
    margin: "0",
    zIndex: "1000",
    pointerEvents: "none",
    transition: "none",
    transformOrigin: "top left",
  });
  document.body.appendChild(clone);
  void clone.offsetWidth; // force reflow before transitioning

  const dx = endRect.left - startRect.left;
  const dy = endRect.top - startRect.top;
  const sx = endRect.width / startRect.width;
  const sy = endRect.height / startRect.height;

  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    targetEl.style.opacity = "1";
    clone.remove();
  };

  clone.style.transition = "transform 550ms ease, opacity 550ms ease";
  clone.addEventListener("transitionend", settle, { once: true });
  requestAnimationFrame(() => {
    clone.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
  });
  // Safety net in case transitionend never fires for some reason.
  setTimeout(settle, 900);
}
