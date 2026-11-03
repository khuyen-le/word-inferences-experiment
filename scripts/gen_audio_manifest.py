import os, re, json, sys
manifest, genders = {}, {}
for f in sorted(os.listdir("audio")):
    m = re.fullmatch(r"(Speaker\d+)_([bg])_(.+?)\s*\.mp3", f)
    if not m:
        continue
    speaker, g, line = m.groups()
    genders.setdefault(speaker, set()).add(g)
    manifest.setdefault(speaker, {})[line] = f
bad = {s: g for s, g in genders.items() if len(g) != 1}
if bad:
    sys.exit(f"Speakers with mixed b/g tags: {bad}")
print("// AUTO-GENERATED from the files in audio/ -- do not edit by hand.")
print("// Regenerate after adding/renaming recordings (see README).")
print("// AUDIO_SPEAKER_GENDER comes from the b/g tag in each filename (b = boy, g = girl).")
print("const AUDIO_SPEAKER_GENDER = " + json.dumps({s: ("boy" if g == {"b"} else "girl") for s, g in sorted(genders.items())}, indent=2) + ";")
print("const AUDIO_MANIFEST = " + json.dumps(manifest, indent=2, sort_keys=True) + ";")
