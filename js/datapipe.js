// Data saving: DataPipe (https://pipe.jspsych.org) -> Zenodo.
// At the end of the session, the full CSV is sent to DataPipe, which stores
// it in the Zenodo deposit connected to this DataPipe experiment. Uses the
// official jsPsych-contrib plugin (window.jsPsychPipe, loaded in index.html).
//
// For this to work, on pipe.jspsych.org this experiment must have:
//   - a Zenodo deposit connected as its storage, and
//   - data collection switched ON (DataPipe rejects data while it's off).
//
// Files are named <participant ID>_<date>-<time>.csv so re-running an ID never
// collides with an earlier file.
//
// If the upload fails (no internet, data collection off, etc.), save-backup.js
// downloads the CSV to the computer's Downloads folder instead, so no session
// is lost.
const DATAPIPE_EXPERIMENT_ID = "JSPAIYEpbzIh";

function sessionFilename() {
  const values = jsPsych.data.get().values();
  const id = (values[0] && values[0].participant_id) || "unknown";
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19); // YYYY-MM-DD-HH-MM-SS (UTC)
  return `${id}_${stamp}.csv`;
}

// The final "save to DataPipe" trial. It's the last entry in the timeline, so
// the CSV (built when this trial runs) includes every trial and every
// session-level property (participant ID, excluded, etc.).
function buildDataPipeSaveTrial() {
  return {
    type: jsPsychPipe,
    action: "save",
    experiment_id: DATAPIPE_EXPERIMENT_ID,
    filename: () => {
      window.__wiFilename = sessionFilename(); // reused by the backup download
      return window.__wiFilename;
    },
    data_string: () => jsPsych.data.get().csv(),
    wait_message: "<p>Saving data. Please do not close this page.</p>",
  };
}
