# WORDLOCKED

Crack the daily combination lock. Three words. Five guesses.

## How it works

Three sequential combination locks: 4-letter, 5-letter, 6-letter. Spin the dials to spell your guess. All players worldwide get the same three words every day, seeded by UTC date.

## File structure

```
index.html          # Game layout, modals, controls
style.css           # Dark metallic design, mobile-first
game.js             # Core game engine, state, events
stats.js            # Stats tracking via localStorage
share.js            # Spoiler-free share card
words/
  4-letters.json    # 4-letter word bank
  5-letters.json    # 5-letter word bank
  6-letters.json    # 6-letter word bank
vercel.json         # Static site routing
```

## Deployment

Static site — no build step. Connect repo to Vercel, deploys automatically. Zero configuration required.

## Word banks

Each word bank is a JSON array of `{"word": "WORD", "hint": "Part of speech"}`. Replace with full word lists before launch.
