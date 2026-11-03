# Word Inferences jsPsych experiment

Implements the design in `materials/design.pptx` and `materials/word_list.docx`
as a jsPsych 8 experiment.

## Running it

Any static file server works (the app is plain HTML/JS/CSS, no build step):

```
cd experiment
python3 serve.py
# open http://127.0.0.1:8000/
```

`serve.py` is a plain local server that tells the browser not to cache
files, so edits always show up on reload. Any static web host works too (the
study needs to be online somewhere, e.g. GitHub Pages, for others to run it
from a link). Data is uploaded to DataPipe -> Zenodo at the end of each
session (see "Data saving" below).

The first screen asks for the participant ID. Nothing else on screen is
meant for the researcher: the experimenter's lines are in
`experimenter_script.md`.

## Testing the randomization logic

The design-generation logic (`js/randomize.js`) is pure and unit-tested under
plain Node, independent of the browser:

```
node js/randomize.test.js
```

## Architecture

- `js/items.js` -- the 9-topic, 4-easy/4-difficult word pool (sea creatures
  currently switched off via `DISABLED_TOPICS`, leaving 8) (from
  `word_list.docx`), plus `itemImagePath()` and the practice-trial image map.
- `js/image-manifest.generated.js` -- auto-generated mapping from item slug
  (`"animal_tiger"`) to actual filename in `images/` (extensions vary: jpg,
  png, webp, avif). Regenerate if `images/` changes:
  ```
  python3 -c "
  import os, json
  files = sorted(f for f in os.listdir('images') if not f.startswith('.'))
  manifest = {os.path.splitext(f)[0]: f for f in files}
  print('const IMAGE_MANIFEST = ' + json.dumps(manifest, indent=2, sort_keys=True) + ';')
  " > js/image-manifest.generated.js
  ```
- `js/speakers.js` -- **TEMPORARY** voice setup: only 5 of the planned 12
  speakers are recorded (boys: Speaker1, Speaker3; girls: Speaker2, Speaker4,
  Speaker5), so each character pair gets 2 different same-gender speakers at
  random per session. Replace with a fixed 1:1 character -> speaker map once
  all 12 are recorded (see the TODO at the top of the file). The b/g tag in
  each audio filename is checked against these lists on load.
- `js/audio-manifest.generated.js` -- auto-generated from `audio/`
  (`SpeakerN_[b|g]_<line>.mp3`). Regenerate after adding/renaming recordings:
  ```
  python3 scripts/gen_audio_manifest.py > js/audio-manifest.generated.js
  ```
  A missing recording isn't fatal: that line is shown as text only, with a
  console warning.
- `js/characters.js` -- character art pools and `buildCharacterAssignment()`:
  both the critical trials (2 girl trials + 2 boy trials) and the
  comprehension check (1 girl trial + 1 boy trial) are gender-mixed, order
  randomized and independent of DC/SC condition, with no character repeated
  anywhere in a session.
- `js/randomize.js` -- per-participant design generation: topic pairing
  (random, sea+animal excluded from being paired together), Difficulty-Contrast
  vs. Superordinate-Contrast assignment, item sampling, and demo-phase success
  patterns. See `generateParticipantDesign()`.
- `js/plugin-narration.js` -- a researcher-paced "Continue" beat (used for
  simple one-line screens: intros, the post-comprehension branch message,
  etc.), plus shared render helpers (`renderLine`, `renderCharacterRow`,
  `renderRecapStrip`/`renderRecapCellsHtml`) reused by the other two plugins.
- `js/plugin-choice.js` -- a child-clicks-a-character forced-choice screen
  (with optional feedback), used for the comprehension sub-questions and the
  critical-trial test phase.
- `js/plugin-item-reveal.js` -- reveals one item (a demo item, or a
  comprehension item) across internal researcher-paced beats (prompt -> left
  line -> left ack -> right line -> right ack) *within a single jsPsych
  trial*, so the recap strip and the big center item image stay the same DOM
  nodes throughout -- required for the FLIP-style fly animation: as each
  character's line appears, that item's checkmark/cross lands in the recap
  strip immediately (not both sides at once, not deferred to the next item),
  animating from the center image's position/size into its strip slot. Falls
  back to an instant reveal under `prefers-reduced-motion`.
- `js/timeline.js` -- assembles the full timeline from a generated design.
- `js/datapipe.js` -- DataPipe (-> Zenodo) data submission config and the
  final "save" trial builder. See "Data saving" below.
- `js/main.js` -- entry point: generates the design, preloads images, runs.
  Also sets `window.__wiDesign` to the generated design for easy inspection
  from the browser console during QA.

## Data saving (DataPipe -> Zenodo)

Data submission uses [DataPipe](https://pipe.jspsych.org) (via the official
`@jspsych-contrib/plugin-pipe`, loaded in `index.html`), which routes
directly to the Zenodo deposit connected to DataPipe experiment
`JSPAIYEpbzIh` (set in `js/datapipe.js`), with no backend server of our own.

- The upload is the last trial of the session (`buildDataPipeSaveTrial()` in
  `main.js`'s timeline), so the CSV includes every trial.
- Files are named `<participant ID>_<date>-<time>.csv` (time in UTC); the
  participant ID is what the researcher typed on the first screen, and it's
  also in the `participant_id` column of every row.
- On pipe.jspsych.org, the experiment must have its Zenodo deposit connected
  **and data collection switched on**, or uploads are rejected.
- If the upload fails for any reason (no internet, data collection off,
  ...), `js/save-backup.js` downloads the CSV to the computer's Downloads
  folder instead and says so on screen, so no session is lost.

## Known gaps / TODOs (flagged inline in code too)

- **Audio (temporary setup)**: only 5 of the planned 12 speakers are
  recorded, and a few recordings are missing -- see the TODOs in
  `js/speakers.js` and `sampleItemsForTopic()` in `js/randomize.js`.
- **Comprehension-check pass/fail rule**: implemented as -- trial 2 ("ball")
  counts as failed (session ends early, critical trials skipped) if the child
  answers *either* the "who knows" or "who doesn't know" sub-question
  incorrectly. Confirm this matches the intended exclusion criterion.
- **Parental survey** (the "possible exploratory" item in the design deck)
  is not implemented.
- **Topic pairing randomization**: currently a uniform random pairing of the
  enabled topics (currently 8, with sea switched off), independently re-rolled per participant, with
  no further counterbalancing constraint (e.g. no Latin-square balancing of
  which topics get excluded or which pairs become DC vs. SC across the
  sample). Flagged as "fully random, v1" in the original design discussion --
  revisit if the study needs guaranteed balance across participants rather
  than balance-in-expectation.
