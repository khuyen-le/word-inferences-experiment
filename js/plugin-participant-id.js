// Custom jsPsych v8 plugin: the first screen of the session, where the
// researcher types the participant's ID. The ID is added to every row of the
// data (participant_id) and used in the saved file's name.
// Allowed characters: letters, numbers, "-" and "_" (so it's safe in a filename).
class ParticipantIdPlugin {
  static info = {
    name: "wi-participant-id",
    parameters: {},
  };

  constructor(jsPsych) {
    this.jsPsych = jsPsych;
  }

  trial(display_element) {
    display_element.innerHTML =
      `<div class="wi-screen wi-id-screen">` +
      `<label for="wi-participant-id">Participant ID</label>` +
      `<input id="wi-participant-id" type="text" autocomplete="off" spellcheck="false" autofocus>` +
      `<div id="wi-id-error" class="wi-id-error"></div>` +
      `<button class="jspsych-btn" id="wi-id-start">Start</button>` +
      `</div>`;

    const input = document.getElementById("wi-participant-id");
    const error = document.getElementById("wi-id-error");
    input.focus();

    const submit = () => {
      const id = input.value.trim();
      if (!id) {
        error.textContent = "Please enter a participant ID.";
        return;
      }
      if (!/^[A-Za-z0-9_-]+$/.test(id)) {
        error.textContent = 'Use only letters, numbers, "-" or "_".';
        return;
      }
      this.jsPsych.data.addProperties({ participant_id: id });
      this.jsPsych.finishTrial({ entered_participant_id: id });
    };

    document.getElementById("wi-id-start").addEventListener("click", submit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
  }
}
