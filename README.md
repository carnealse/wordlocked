# WORDLOCKED

Crack the daily combination lock. Three locks. Five guesses each.

## Architecture

Vanilla ES modules — no build step, no bundler, no framework. Deploys to Vercel as a static site.

```
wordlocked/
  index.html              # Semantic markup, zero inline styles
  style.css               # BEM, design tokens, mobile-first
  vercel.json             # Static routing + cache headers
  words/
    4-letters.json        # Word bank — {id, word, hint}[]
    5-letters.json
    6-letters.json
  tools/                  # Word bank build script and its inputs (not deployed)
  js/
    main.js               # Entry point — imports boot()
    config.js             # Puzzle shape: lock lengths, guesses per lock
    game.js               # Game loop, guess logic, level progression
    state.js              # Single source of truth, subscriber pattern
    ui.js                 # All DOM rendering, purely reads state
    dials.js              # Dial wheel generation, spin math
    seed.js               # Seeded RNG, day index, daily word selection
    storage.js            # Safe localStorage adapter
    stats.js              # Stats persistence and rendering
    share.js              # Spoiler-free share text + image card
    messages.js           # Content pools: fail, consolation, win messages
    achievements.js       # Achievement definitions, awarding, trophy case data
    theme.js              # Seasonal themes by puzzle date
  assets/themes/          # Seasonal theme artwork
```

## Design principles

- **State → UI**: `state.js` is the only truth. `ui.js` (and `stats.js` for its modal) render from it; game logic never draws.
- **One source for the puzzle shape**: lock count, word lengths, and guess limits all derive from `config.js`.
- **No shared mutable state outside state.js**: All mutations go through named mutators.
- **Zero inline styles**: JS only adds/removes CSS classes. Animations live entirely in CSS.
- **No dependencies**: Ships as-is to any static host.

## Deployment

Connect the repo to Vercel. Framework preset: **Other** (static). Deploys on every push to `prod`.

## Word banks

Each bank is `{"id": 1, "word": "WORD", "hint": "Part of speech"}[]`. Puzzle #N uses `id` N from each bank, wrapping to `id` 1 when a bank runs out.

The banks are generated, not hand-edited. `tools/build_word_banks.py` keeps only common American English words from `tools/source-words.txt`: in SCOWL's common-word lists, frequent in everyday text, not blocklisted (`tools/blocklist.txt`), and not a British spelling (`tools/non-us-spellings.txt`). It then tags parts of speech with WordNet and fixes the puzzle order by a stable hash so difficulty is mixed. Setup and rules are in the script's docstring.

Once the game is live, ids that have already been played must never change. After launch, append new words instead of rebuilding.

## Content

- **Messages** live in `js/messages.js`. Append `{ title, body: [] }` to a pool. Picks are seeded by puzzle number, so a reload never changes the message.
- **Achievements** live in `js/achievements.js`. Append `{ id, name, hint, body, reward, check }`. `check({ stats, today })` runs for every achievement not yet earned each time a finished day loads, and the popup shows only the first time it passes. `stats` holds lifetime totals (`played`, `wins`, `losses`, `streak`, `maxStreak`) and already includes today; `today` holds `status` (`'won'` or `'lost'`), `results` (one `{ solved, tries }` per lock), `puzzleNumber`, `date` (`'YYYY-MM-DD'`, Eastern time), and `shared` (true only when the checks re-run after the share sheet reports a completed share). Never rename an `id`, it is the storage key.
- **Seasonal themes** live in `js/theme.js`. Append `{ id, from, to }` with `'MM-DD'` dates (inclusive, Eastern time) and style it in `style.css` under `:root[data-theme="<id>"]`. Halloween runs October 1–31. Preview any theme with `?theme=<id>` and the default look with `?theme=none`.
