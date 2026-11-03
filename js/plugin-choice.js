// Custom jsPsych v8 plugin: the child responds by clicking one of the two
// on-screen characters. Used for:
//   - comprehension-check sub-questions ("who knows/doesn't know this?")
//   - critical-trial test phase ("who knows what this is called?")
//
// If `feedback.enabled` is set (comprehension trial 1 only), clicking shows a
// Continue button so the researcher can give feedback aloud first; otherwise
// the trial finishes as soon as the child clicks.
class ChoicePlugin {
  static info = {
    name: "wi-choice",
    parameters: {
      promptLine: { type: "OBJECT", default: null }, // { speaker: 'experimenter', text }
      itemImage: { type: "STRING", default: null },
      characters: { type: "OBJECT", default: null }, // { left, right }
      recapItems: { type: "OBJECT", default: null },
      progressLabel: { type: "STRING", default: null },
      feedback: { type: "OBJECT", default: null }, // { enabled: true, correctSide: 'left'|'right' }
      // Arbitrary extra fields the caller wants echoed back into trial data
      // (e.g. topic/difficulty/condition/role-per-side), so analysis scripts
      // don't have to re-derive them from the design object.
      meta: { type: "OBJECT", default: {} },
    },
  };

  constructor(jsPsych) {
    this.jsPsych = jsPsych;
  }

  trial(display_element, trial) {
    const startTime = performance.now();

    const parts = [];
    // Same layout as the other screens (see renderLineSlot/renderButtonSlot):
    // the button slot holds an invisible placeholder until feedback needs it.
    parts.push(renderSceneRow(trial.characters, "both", true, trial.itemImage, trial.recapItems || []));
    parts.push(renderLineSlot(trial.promptLine ? renderLine(trial.promptLine) : ""));
    parts.push(renderButtonSlot(null));

    display_element.innerHTML = `<div class="wi-screen">${parts.join("\n")}</div>`;

    let answered = false;
    const choiceRt = { value: null };

    const finish = (side) => {
      const rt = performance.now() - startTime;
      this.jsPsych.finishTrial({
        rt,
        chosen_side: side,
        choice_rt: choiceRt.value,
        ...trial.meta,
      });
    };

    const onPick = (side) => {
      if (answered) return;
      answered = true;
      choiceRt.value = performance.now() - startTime;

      document.getElementById("wi-char-left").classList.toggle("active", side === "left");
      document.getElementById("wi-char-right").classList.toggle("active", side === "right");
      document.querySelectorAll(".wi-character.clickable").forEach((el) => {
        el.classList.remove("clickable");
        el.removeAttribute("tabindex");
      });

      if (trial.feedback && trial.feedback.enabled) {
        // The researcher gives the feedback aloud (see experimenter_script.md);
        // nothing is shown on screen, just a Continue button to move on after.
        const slot = document.getElementById("wi-button-slot");
        slot.innerHTML = `<button class="jspsych-btn" id="wi-continue-btn">Continue</button>`;
        document.getElementById("wi-continue-btn").addEventListener("click", () => finish(side));
      } else {
        finish(side);
      }
    };

    const leftEl = document.getElementById("wi-char-left");
    const rightEl = document.getElementById("wi-char-right");
    leftEl.addEventListener("click", () => onPick("left"));
    rightEl.addEventListener("click", () => onPick("right"));
    [leftEl, rightEl].forEach((el, i) => {
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPick(i === 0 ? "left" : "right");
        }
      });
    });
  }
}
