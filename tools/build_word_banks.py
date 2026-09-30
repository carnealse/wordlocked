#!/usr/bin/env python3
"""
Builds words/{4,5,6}-letters.json from tools/source-words.txt.

A word becomes an answer only if it is:
  1. in source-words.txt, all letters, 4 to 6 long
  2. in SCOWL, the standard spell-checker vocabulary of American English,
     lowercase only, so names and places are excluded: size 35 ("common")
     or size 50 if it is also frequent
  3. frequent enough in everyday text (wordfreq). Plurals and verb endings
     must clear a higher bar and come from a common base word; Latin-style
     plurals must be very frequent (MEDIA yes, FOCI no)
  4. not in tools/blocklist.txt, and not a non-US spelling
     (tools/non-us-spellings.txt, from VarCon) unless in US_ALSO_STANDARD
  5. taggable with a part of speech (WordNet, or MANUAL_HINTS below)

Survivors are ranked by everyday frequency (wordfreq) with base forms
preferred over plurals and verb endings, and the top TARGET per length are kept.

Puzzle order is a stable hash of each word, so difficulty is mixed from day
one and adding or removing a word does not reshuffle the rest. Words sharing
a root (BAKE / BAKED / BAKERS) are never scheduled on the same day.

Once the game is public, ids that have been played must never change.
Rebuilding reorders everything, so after launch only append new ids.

Setup (Debian/Ubuntu):
  sudo apt-get install wamerican wamerican-small
  pip install wordfreq nltk
  python3 -c "import nltk; nltk.download('wordnet')"
Run from the repo root:
  python3 tools/build_word_banks.py
"""

import hashlib
import json
import re
import sys
from pathlib import Path

from nltk.corpus import wordnet as wn
from wordfreq import zipf_frequency

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'tools' / 'source-words.txt'
BLOCKLIST = ROOT / 'tools' / 'blocklist.txt'
NON_US_SPELLINGS = ROOT / 'tools' / 'non-us-spellings.txt'
SCOWL_35 = Path('/usr/share/dict/american-english-small')
SCOWL_50 = Path('/usr/share/dict/american-english')
LENGTHS = (4, 5, 6)
TARGET = 4000
ORDER_SALT = 'wordlocked-v1'

# Zipf is log10(occurrences per billion words): 3 is once per million.
MIN_ZIPF_BASE = 2.3
MIN_ZIPF_SCOWL_50 = 3.0
MIN_ZIPF_INFLECTED = 2.8
MIN_ZIPF_LATIN_PLURAL = 3.5
LATIN_PLURAL_ENDINGS = ('a', 'i', 'ae')
# SCOWL lists XXII, CLXIV, etc. as words.
ROMAN_NUMERAL = re.compile(r'^m{0,4}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$')
# Plurals and verb endings rank as if this much rarer than they are.
INFLECTION_PENALTY = 0.5
# A second part of speech is shown only if it is at least this common.
SECOND_POS_SHARE = 0.4

# VarCon calls these variants, but US readers treat them as standard.
US_ALSO_STANDARD = {
    'amidst', 'donut', 'donuts', 'flyer', 'flyers', 'goodie', 'grey', 'hurray', 'smidge',
}

# Common words WordNet has no entry for: function words and newer vocabulary.
MANUAL_HINTS = {
    'about': 'Preposition / Adverb', 'above': 'Preposition', 'after': 'Preposition',
    'again': 'Adverb', 'ahoy': 'Interjection',
    'albeit': 'Conjunction', 'along': 'Preposition', 'amid': 'Preposition',
    'amidst': 'Preposition', 'among': 'Preposition', 'anyone': 'Pronoun',
    'around': 'Preposition', 'artsy': 'Adjective', 'before': 'Preposition',
    'behind': 'Preposition', 'below': 'Preposition', 'beside': 'Preposition',
    'bicep': 'Noun', 'biker': 'Noun', 'byline': 'Noun', 'cabbie': 'Noun',
    'cannot': 'Verb', 'clingy': 'Adjective', 'could': 'Verb', 'during': 'Preposition',
    'else': 'Adverb', 'feta': 'Noun', 'fest': 'Noun', 'flyby': 'Noun',
    'from': 'Preposition', 'giggly': 'Adjective', 'glitzy': 'Adjective',
    'golly': 'Interjection', 'goodie': 'Noun', 'gosh': 'Interjection',
    'hers': 'Pronoun', 'hoodie': 'Noun', 'hurray': 'Interjection',
    'hyper': 'Adjective', 'intel': 'Noun', 'into': 'Preposition',
    'itself': 'Pronoun', 'kiddo': 'Noun', 'legit': 'Adjective', 'login': 'Noun',
    'manga': 'Noun', 'myself': 'Pronoun', 'onto': 'Preposition', 'oops': 'Interjection',
    'others': 'Pronoun', 'ouch': 'Interjection', 'ought': 'Verb', 'ours': 'Pronoun',
    'pointy': 'Adjective', 'preppy': 'Adjective', 'promo': 'Noun',
    'punchy': 'Adjective', 'redraw': 'Verb', 'rehire': 'Verb', 'resend': 'Verb',
    'retype': 'Verb', 'rewind': 'Verb', 'shall': 'Verb', 'should': 'Verb',
    'since': 'Conjunction / Preposition', 'slinky': 'Adjective', 'snippy': 'Adjective',
    'sweaty': 'Adjective', 'than': 'Conjunction', 'that': 'Pronoun / Conjunction',
    'their': 'Pronoun', 'theirs': 'Pronoun', 'them': 'Pronoun', 'these': 'Pronoun',
    'they': 'Pronoun', 'this': 'Pronoun', 'those': 'Pronoun', 'tingly': 'Adjective',
    'toasty': 'Adjective', 'toward': 'Preposition', 'unless': 'Conjunction',
    'until': 'Preposition / Conjunction', 'upon': 'Preposition', 'versus': 'Preposition',
    'what': 'Pronoun', 'when': 'Adverb / Conjunction', 'where': 'Adverb',
    'which': 'Pronoun', 'whoa': 'Interjection', 'whom': 'Pronoun', 'whose': 'Pronoun',
    'with': 'Preposition', 'within': 'Preposition', 'would': 'Verb',
    'yippee': 'Interjection', 'your': 'Pronoun', 'yours': 'Pronoun', 'yuck': 'Interjection',
    # WordNet files these under other parts of speech.
    'ahem': 'Interjection', 'alas': 'Interjection', 'aloha': 'Interjection',
    'bingo': 'Interjection / Noun', 'bravo': 'Interjection / Noun', 'cheers': 'Interjection',
    'hello': 'Interjection', 'hooray': 'Interjection', 'howdy': 'Interjection',
    'hurrah': 'Interjection', 'okay': 'Adjective / Interjection', 'shoo': 'Interjection / Verb',
    'yahoo': 'Interjection', 'yeah': 'Interjection',
}

POS_ORDER = ('n', 'v', 'a', 'r')


def read_words(path):
    with open(path, encoding='utf-8', errors='ignore') as f:
        return {line.strip() for line in f}


def read_list(path):
    """First token of each non-comment line."""
    return {line.split()[0] for line in read_words(path) if line and not line.startswith('#')}


def lemmas_for(base, pos):
    """WordNet lemmas spelled exactly `base` in lowercase (proper nouns excluded)."""
    return [l for s in wn.synsets(base, pos) for l in s.lemmas() if l.name() == base]


def form_label(word, base, pos):
    if pos == 'n':
        return 'Noun' if word == base else 'Plural noun'
    if pos == 'v':
        if word == base or word.endswith('s'):
            return 'Verb'
        return 'Verb (-ing form)' if word.endswith('ing') else 'Verb (past tense)'
    if pos == 'a':
        if word == base:
            return 'Adjective'
        return 'Adjective (superlative)' if word.endswith('est') else 'Adjective (comparative)'
    return 'Adverb'


def pos_family(label):
    """'Plural noun' and 'Noun' are one family, so a hint never pairs them."""
    return label.split(' (')[0].split()[-1].lower()


def analyse(word):
    """
    Returns (hint, is_base_form, roots) or None if the word has no usable sense.
    Each part of speech is weighted by how often its senses occur in the
    sense-tagged SemCor corpus, plus a little per sense so untagged words count.
    """
    if word in MANUAL_HINTS:
        return MANUAL_HINTS[word], True, {word}

    weights, roots, base_form = {}, set(), False
    for pos in POS_ORDER:
        # All candidate bases, not just morphy's first (COMICS -> COMIC, not COMIC_STRIP).
        for base in sorted(set(wn._morphy(word, pos))):
            lemmas = lemmas_for(base, pos)
            if not lemmas:
                continue
            label = form_label(word, base, pos)
            weights[label] = weights.get(label, 0) + sum(l.count() for l in lemmas) + 0.5 * len(lemmas)
            roots.add(base)
            base_form |= base == word

    if not weights:
        return None
    ranked = sorted(weights.items(), key=lambda kv: (-kv[1], kv[0]))
    (top, top_weight), labels = ranked[0], [ranked[0][0]]
    runner_up = next(((l, w) for l, w in ranked[1:] if pos_family(l) != pos_family(top)), None)
    if runner_up and runner_up[1] >= SECOND_POS_SHARE * top_weight:
        labels.append(runner_up[0])
    return ' / '.join(labels), base_form, roots


def stable_order(word):
    return hashlib.sha256(f'{ORDER_SALT}:{word}'.encode()).hexdigest()


def shares_root(a, b):
    ra, rb = a['roots'] | {a['word']}, b['roots'] | {b['word']}
    return bool(ra & rb) or any(x.startswith(y) or y.startswith(x) for x in ra for y in rb)


def separate_roots(banks):
    """Swap entries forward until no day has two answers from the same root."""
    days = min(len(b) for b in banks)
    for later in range(1, len(banks)):
        bank = banks[later]
        for day in range(days):
            if not any(shares_root(bank[day], banks[k][day]) for k in range(later)):
                continue
            for other in range(day + 1, len(bank)):
                fits_here = not any(shares_root(bank[other], banks[k][day]) for k in range(later))
                fits_there = other >= days or not any(
                    shares_root(bank[day], banks[k][other]) for k in range(later))
                if fits_here and fits_there:
                    bank[day], bank[other] = bank[other], bank[day]
                    break
            else:
                sys.exit(f'Could not separate roots on day {day + 1}')


def validate(banks, blocked):
    for length, bank in zip(LENGTHS, banks):
        words = [e['word'] for e in bank]
        assert len(set(words)) == len(words), f'{length}: duplicate words'
        for e in bank:
            w = e['word']
            assert len(w) == length and w.isascii() and w.isalpha() and w.islower(), w
            assert w not in blocked and not ROMAN_NUMERAL.match(w), w
            assert e['hint'], w
    days = min(len(b) for b in banks)
    for day in range(days):
        trio = [b[day] for b in banks]
        assert not any(shares_root(a, b) for i, a in enumerate(trio) for b in trio[i + 1:]), trio


def read_scowl(path):
    return {w for w in read_words(path) if w.isascii() and w.isalpha() and w.islower()}


def is_common(word, zipf, base_form, roots, scowl_35):
    if word not in scowl_35 and zipf < MIN_ZIPF_SCOWL_50:
        return False
    if base_form:
        return zipf >= MIN_ZIPF_BASE
    if zipf < MIN_ZIPF_INFLECTED or not roots & scowl_35:
        return False
    return not word.endswith(LATIN_PLURAL_ENDINGS) or zipf >= MIN_ZIPF_LATIN_PLURAL


def build():
    source = {w.lower() for w in read_words(SOURCE) if w.isascii() and w.isalpha()}
    scowl_35, scowl_50 = read_scowl(SCOWL_35), read_scowl(SCOWL_50)
    blocked = read_list(BLOCKLIST) | (read_list(NON_US_SPELLINGS) - US_ALSO_STANDARD)

    banks, report = [], []
    for length in LENGTHS:
        entries = []
        for word in sorted(source & scowl_50):
            if len(word) != length or word in blocked or ROMAN_NUMERAL.match(word):
                continue
            zipf = zipf_frequency(word, 'en')
            if zipf < MIN_ZIPF_BASE:
                continue
            analysis = analyse(word)
            if not analysis:
                continue
            hint, base_form, roots = analysis
            if not is_common(word, zipf, base_form, roots, scowl_35):
                continue
            score = zipf - (0 if base_form else INFLECTION_PENALTY)
            entries.append({'word': word, 'hint': hint, 'roots': roots, 'score': score})

        entries.sort(key=lambda e: -e['score'])
        kept = entries[:TARGET]
        kept.sort(key=lambda e: stable_order(e['word']))
        banks.append(kept)
        report.append((length, len(entries), len(kept)))

    separate_roots(banks)
    validate(banks, blocked)

    for length, bank in zip(LENGTHS, banks):
        lines = [
            f'  {json.dumps({"id": i, "word": e["word"].upper(), "hint": e["hint"]})}'
            for i, e in enumerate(bank, start=1)
        ]
        (ROOT / 'words' / f'{length}-letters.json').write_text('[\n' + ',\n'.join(lines) + '\n]\n')

    for length, eligible, kept in report:
        note = '' if kept == TARGET else f'  (only {eligible} eligible)'
        print(f'{length} letters: {kept} words{note}')


if __name__ == '__main__':
    build()
