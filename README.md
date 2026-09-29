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
    4-letters.json        # Word bank — {word, hint}[]
    5-letters.json
    6-letters.json
  js/
    main.js               # Entry point — imports boot()
    game.js               # Game loop, guess logic, level progression
    state.js              # Single source of truth, subscriber pattern
    ui.js                 # All DOM rendering, purely reads state
    dials.js              # Dial wheel generation, spin math
    seed.js               # Seeded RNG, day index, daily word selection
    storage.js            # Safe localStorage adapter
    stats.js              # Stats persistence and rendering
    share.js              # Spoiler-free share text + image card
```

## Design principles

- **State → UI**: `state.js` is the only truth. `ui.js` reads it; nothing else touches the DOM.
- **No shared mutable state outside state.js**: All mutations go through named mutators.
- **Zero inline styles**: JS only adds/removes CSS classes. Animations live entirely in CSS.
- **No dependencies**: Ships as-is to any static host.

## Deployment

Connect the repo to Vercel. Framework preset: **Other** (static). Deploys on every push to `prod`.

## Word banks

Each bank is `{"word": "WORD", "hint": "Part of speech"}[]`. Replace with full curated lists before launch.
