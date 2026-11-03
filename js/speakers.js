// Voices for the characters' lines.
//
// TODO: TEMPORARY SPEAKER SETUP -- CHANGE WHEN ALL RECORDINGS EXIST.
// The plan is 12 speakers, one per character (6 boys, 6 girls). Right now we
// only have recordings from 5 speakers in audio/:
//   boys:  Speaker1, Speaker3
//   girls: Speaker2, Speaker4, Speaker5
// So for now, voices are assigned per session instead of per character:
// each character pair gets 2 DIFFERENT speakers of the matching gender, picked
// at random from the lists below. Voices are therefore reused across trials
// (e.g. every boy pair uses Speaker1 + Speaker3).
// Once all 12 speakers are recorded:
//   1. Add the files to audio/ and regenerate js/audio-manifest.generated.js.
//   2. Replace assignVoices() below with a fixed 1:1 map from each character
//      image to its own speaker (e.g. "characters/boy1.png": "Speaker1"), so
//      every character always has the same, unique voice.
const BOY_SPEAKERS = ["Speaker1", "Speaker3"];
const GIRL_SPEAKERS = ["Speaker2", "Speaker4", "Speaker5"];

// Line keys shared by all speakers (besides the "<topic>_<word>" item lines).
const DONT_KNOW_LINE = "I_dont_know_what_this_is";

// Checks that every listed speaker has recordings and that the b/g tag in its
// filenames matches the gender list it's in. Throws on mismatch so a wrong
// voice/gender pairing can never reach a participant.
function checkSpeakerGenders() {
  const check = (list, gender) =>
    list.forEach((s) => {
      if (!AUDIO_SPEAKER_GENDER[s]) throw new Error(`speakers.js: no recordings found for ${s}`);
      if (AUDIO_SPEAKER_GENDER[s] !== gender) {
        throw new Error(`speakers.js: ${s} is listed as a ${gender} but its files are tagged ${AUDIO_SPEAKER_GENDER[s]}`);
      }
    });
  check(BOY_SPEAKERS, "boy");
  check(GIRL_SPEAKERS, "girl");
}
checkSpeakerGenders();

// Given the session's character pairs (each { gender, pair: [a, b] }), returns
// a map from character image path -> speaker ID. Both characters in a pair
// always get different speakers of their own gender.
function assignVoices(pairs, shuffle) {
  const voiceByCharacter = {};
  pairs.forEach(({ gender, pair }) => {
    const pool = gender === "girl" ? GIRL_SPEAKERS : BOY_SPEAKERS;
    if (pool.length < 2) throw new Error(`assignVoices: need at least 2 ${gender} speakers`);
    const [s1, s2] = shuffle(pool.slice());
    voiceByCharacter[pair[0]] = s1;
    voiceByCharacter[pair[1]] = s2;
  });
  return voiceByCharacter;
}

// TODO: TEMPORARY FIX FOR MISSING RECORDINGS -- remove once every speaker has
// recorded every word. A word that ANY speaker in BOY_SPEAKERS/GIRL_SPEAKERS
// is missing a recording for is never used as a demo item (the only items the
// characters say out loud), so a missing recording is never needed. Such words
// can still appear as test items, which have no character audio. Currently
// this affects (see audio/): kitchen_sieve (Speaker3), vehicle_bicycle and
// kitchen_knife (Speaker4), animal_monkey (Speaker5).
// Once nothing is missing, this returns true for every word and has no effect.
function hasAllRecordings(topic, word) {
  const key = `${topic}_${word}`;
  return BOY_SPEAKERS.concat(GIRL_SPEAKERS).every((s) => AUDIO_MANIFEST[s] && AUDIO_MANIFEST[s][key]);
}

// Path to a speaker's recording of `lineKey` (e.g. "animal_tiger",
// "test_tree", DONT_KNOW_LINE), or null if that recording doesn't exist yet --
// in which case the line is just shown as text, with a console warning.
function speakerAudioPath(speaker, lineKey) {
  const file = speaker && AUDIO_MANIFEST[speaker] && AUDIO_MANIFEST[speaker][lineKey];
  if (!file) {
    console.warn(`[speakers.js] No recording of "${lineKey}" for ${speaker} -- showing text only`);
    return null;
  }
  return `audio/${file}`;
}
