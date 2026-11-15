# Zaman Repair Rally 🏁

A calm car-racing quiz game that teaches smartphone technology, made for **Zaman Smartphone Repair Academy, Valanchery**.
It's free to host and run: GitHub Pages for the site and the free Firebase Spark plan (Realtime Database) for the rooms and chat.

**Live:** https://zamanenterprises555-sketch.github.io/zaman-repair-rally/

## Game rules
- Multiplayer room with a 6-character code. **2 to 11 racers**; anyone else joins as a spectator. Auto-rejoin when you reopen the app, plus a personal rejoin link.
- **Solo mode** has every rule, with 0 to 10 computer cars (up to 11 cars in total). Use it for testing alone.
- A race is **3 laps × 10 checkpoints = 30 questions**. Everyone gets the same question at the same time.
- **Questions and options are shuffled for every race and rematch.** The host's phone makes the order once and stores it in the room, so every phone sees the same question at the same checkpoint. There are no repeats within a race. The correct answer moves with its option. `questions.js` itself is never changed.
- A faster correct answer moves the car further: up to 25 % of the time limit gives +5 steps, 50 % gives +4, 75 % gives +3, and up to 100 % gives +2. The time limits are the same as the cricket quiz (OPTIONAL 10 s, ONE WORD 1 min, MIN 3 SENTENCES 3 min, MIN 5 SENTENCES 5 min, PICTURE 5 min). One lap is 50 steps and the finish is at 150.
- A wrong answer or a time-out is a **breakdown**: the car goes to the **pit stop**. Next round it gets a repair question, taken from the other question set. A correct repair puts the car back in the race, and the car does not move that round.
- **Battery (fuel):** starts at 100 %. Driving costs 4 % and a correct answer gives +6 %. A correct battery, charging or power question gives a further +14 %. A wrong answer costs 15 %. Below 20 % the car is slower by 1 step. A pit repair charges the battery to 60 %.
- **Nitro:** 3 correct answers in a row give a boost of +3 steps, with flames. It uses 12 % battery and needs at least 15 %.
- At the end there's a podium for 1st, 2nd and 3rd, a full result table, a review of wrong answers with the correct answers, and an academy button.
- **Reading time:** every question (including pit-stop questions) first shows a calm «വായിക്കൂ… 3» for 3 seconds. Answers are disabled during that time, and the answer timer and steps count only from after it. In multiplayer this is synced through the start time stored in the room.
- **Calm screen (v2):** no 3D and no motion animations. While a question is on screen, only the question is shown. At the result moment you see:
  - a speedometer: needle high for a fast correct answer, 0 for wrong or time-out;
  - a simple race bar with one thin lane per racer and a static car icon (cars move with one quick 0.25 s slide, only after the result);
  - a compact leaderboard with ▲/▼ position change;
  - «ലാപ്പ് x/3 · ചെക്ക്പോയിന്റ് y/10».
- **Engine sounds** (🔊 toggle, saved) are made in code with the Web Audio API, so there are no sound files: a "vroom" for a correct answer, a "tuk tuk" sputter for a breakdown, a nitro whoosh, and a click for a pit repair. They play only at the result moment, never during a question.
- Questions are read aloud in Malayalam (🗣️ toggle) if the phone has a Malayalam voice.
- Free text chat (no mic). It is **locked while a question is live**, both in the app and in the Firebase rules.

## Files
| File | What |
|---|---|
| `questions.js` | Exactly the same file as Zaman Cricket Quiz (not edited) |
| `engine.js` | Pure race rules, used by both Solo and multiplayer (Firebase transactions) |
| `app.js` | UI (race bar, leaderboard, speedometer), rooms, chat, speech, Web Audio engine sounds, solo computer cars |
| `database.rules.json` | Merged Firebase rules: cricket `rooms`/`chat` unchanged, plus `rallyRooms`/`rallyChat` |
| `sw.js`, `manifest.json` | PWA (network-first, works offline after the first visit) |
| `tests/` | `engine.test.js` (node), plus `solo.e2e.js`, `multi.e2e.js` and `eleven.e2e.js` (Playwright, 390×844) |

## Firebase
Data lives under `rallyRooms/{CODE}` and `rallyChat/{CODE}`, separate from the cricket quiz's `rooms/` and `chat/`.
The rules allow no listing, single-room reads, at most 11 racers, chat locked during a question, and deleting rooms only after 24 h. The app removes rooms older than 24 h automatically.
**Multiplayer needs these rules published** (Firebase console → Realtime Database → Rules → paste `database.rules.json` → Publish). Solo works without them.
