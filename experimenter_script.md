# Experimenter script

Nothing below is shown on screen. The researcher reads these lines aloud and
clicks **Continue** to move to the next screen. Characters' lines play as audio.

The wording here matches the `text` saved in the data (`line_text` column) and
is defined in `js/timeline.js`. If you change the wording, change it in both
places so the data stays in sync.

Placeholders:
- **[girls/boys]**: whether the two characters on screen are girls or boys
- **[a/an item]**: the item on screen, e.g. "a tree", "an okapi"

---

## 0. Before starting

Open the study, type the participant's ID on the first screen, and click
**Start**. Make sure the computer is online: at the end of the session the
data is uploaded automatically (DataPipe -> Zenodo). If the upload fails, the
screen says so and a copy of the data file is downloaded to the computer's
Downloads folder -- keep that file.

---

## 1. Welcome

> Hi! Today we're going to play a naming game and watch some friends play too. Let's get started!

---

## 2. Comprehension check (2 trials: tree, then ball)

**Intro (characters appear)**
- Trial 1 (tree): *These [girls/boys] are playing a naming game. Let's watch.*
- Trial 2 (ball): *Here are two more friends ([girls/boys]) playing the naming game.*

**Item reveal (item appears)**
1. *What's this? Let's ask them!*
2. Left character speaks (audio).
3. Response to the left character:
   - if they named it: *That's correct, this is [a/an item]!*
   - if they didn't know: *Okay!*
4. Right character speaks (audio).
5. Response to the right character (same as step 3).

**Two questions, in this order. The child clicks a character after each.**
- Trial 1 (tree):
  1. *Who knows that this is a tree?*
  2. *Who doesn't know that this is a tree?*
- Trial 2 (ball):
  1. *Who doesn't know that this is a ball?*
  2. *Who knows that this is a ball?*

**Feedback (trial 1 / tree only).** After the child clicks, give feedback, then click Continue:
- correct: *That's right!*
- incorrect: *Not quite -- let's remember that for next time!*

Trial 2 (ball) has no feedback; the screen advances as soon as the child clicks.

**After trial 2:**
- If both ball questions were answered correctly: *Great! Now let's watch some more friends play.*
- Otherwise the session ends: *Thank you so much for playing with us today!* (click **Finish**; the data is then uploaded)

---

## 3. Critical trials (4 trials)

The 4 trials come in two blocks: the 2 Difficulty-Contrast trials together and
the 2 Superordinate-Contrast trials together. Which block comes first is
random for each child. The script is the same for both.

**Intro (characters appear)**
- Trial 1: *These [girls/boys] are playing the naming game too.*
- Trials 2-4: *Here are two more friends ([girls/boys]) playing the naming game.*

**Demonstration: 4 items, each as follows**
1. *What's this? Let's ask our friends!*
2. Left character speaks (audio).
3. Response to the left character:
   - if they named it: *That's correct, this is [a/an item]!*
   - if they didn't know: *Okay!*
4. Right character speaks (audio).
5. Response to the right character (same as step 3).

**Break: a blank card appears where the item was.** Click Continue to start the test.

**Test: 4 items, each as follows. The child clicks a character. No feedback.**
> Who knows what this is called?

---

## 4. End

> Thank you so much for playing with us today!

Click **Finish**. The data uploads and the screen says "Data saved" (or, if
the upload failed, that a copy was downloaded instead).
