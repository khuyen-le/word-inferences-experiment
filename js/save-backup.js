// Runs when the session ends (main.js on_finish), right after the DataPipe
// upload trial (datapipe.js). If the upload succeeded, it just confirms on
// screen. If it failed, it downloads the CSV to this computer's Downloads
// folder as a backup, so the session's data is never lost.
function confirmOrBackupSave() {
  const last = jsPsych.data.get().last(1).values()[0] || {};
  const result = last.result;
  // Check the server's reply ourselves: on a network error the plugin can
  // report success even though nothing was uploaded.
  const uploaded =
    last.success === true && result && typeof result === "object" && !(result instanceof Error) && !result.error;

  const target = jsPsych.getDisplayElement();
  const show = (msg) => {
    target.innerHTML = `<div class="wi-screen"><p class="wi-save-status">${escapeHtml(msg)}</p></div>`;
  };

  if (uploaded) {
    show("Data saved. You can close this window.");
    return;
  }

  console.error("[save-backup] DataPipe upload failed:", result);
  const filename = window.__wiFilename || sessionFilename();
  jsPsych.data.get().localSave("csv", filename);
  show(
    `Could not upload the data. A copy (${filename}) was downloaded to this computer's Downloads folder -- ` +
      "please keep it and upload it later."
  );
}
