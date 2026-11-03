// Item pool, from wordlist_aoa.csv (project root).
// Each topic has exactly 4 easy-acquired and 4 difficult-acquired words
// (AoA norms, Kuperman et al. 2012). A single critical trial only draws
// 2 of each per topic (1 for demo, 1 for test) -- sampled randomly per
// participant from this pool (see randomize.js).
//
// `label` matches the `[label]_[item]` image naming convention in images/.
const TOPICS = {
  animal: {
    displayName: "animals",
    easy: ["tiger", "horse", "monkey", "zebra"],
    difficult: ["wombat", "lemur", "okapi", "tapir"],
  },
  vehicle: {
    displayName: "vehicles",
    easy: ["bicycle", "ship", "train", "plane"],
    difficult: ["blimp", "gondola", "chariot", "tram"],
  },
  kitchen: {
    displayName: "kitchen items",
    easy: ["bowl", "glass", "pan", "knife"],
    difficult: ["sieve", "cauldron", "ladle", "colander"],
  },
  clothes: {
    displayName: "clothes",
    easy: ["tie", "dress", "glove", "jacket"],
    difficult: ["beanie", "visor", "tuxedo", "poncho"],
  },
  furniture: {
    displayName: "furniture",
    easy: ["chair", "table", "lamp", "bed"],
    difficult: ["vanity", "ottoman", "hammock", "wardrobe"],
  },
  instrument: {
    displayName: "musical instruments",
    easy: ["drum", "piano", "guitar", "whistle"],
    difficult: ["bassoon", "marimba", "lute", "lyre"],
  },
  tool: {
    displayName: "tools",
    easy: ["hammer", "nail", "ladder", "saw"],
    difficult: ["chisel", "clamp", "crowbar", "funnel"],
  },
  vegetable: {
    displayName: "fruits & vegetables",
    easy: ["pear", "carrot", "pumpkin", "strawberry"],
    difficult: ["papaya", "okra", "artichoke", "guava"],
  },
  sea: {
    displayName: "sea creatures",
    easy: ["turtle", "goldfish", "snail", "shark"],
    difficult: ["anemone", "manatee", "narwhal", "mussel"],
  },
};

// TODO: TEMPORARY -- sea creatures are switched off for now. With sea off,
// there are exactly the 8 topics a session needs, so every child sees all 8.
// To bring a topic back, remove it from this list (nothing else changes).
const DISABLED_TOPICS = ["sea"];

const TOPIC_LABELS = Object.keys(TOPICS).filter((t) => !DISABLED_TOPICS.includes(t));

// Practice-trial images for the comprehension check (NOT part of the topic
// item pool -- these are separate, fixed practice stimuli from
// materials/design.pptx). "ball" has no real image anywhere in the
// materials yet, so it's a clearly-labeled placeholder; swap the file in
// images/ and this map once real art exists.
const COMPREHENSION_IMAGES = {
  tree: "images/comprehension_tree.png",
  ball: "images/comprehension_ball.png",
};

function itemImagePath(label, item) {
  const slug = `${label}_${item}`;
  const filename = IMAGE_MANIFEST[slug];
  if (!filename) {
    console.warn(`[items.js] No image found for slug "${slug}" -- check images/ and image-manifest.generated.js`);
    return `images/MISSING_${slug}.png`;
  }
  return `images/${filename}`;
}
