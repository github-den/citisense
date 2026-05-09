# CitiSense Emotion Detection Plan
## citizen-web Applied Version

## Goal
Apply the shared 4-mood system in `citizen-web` so the web citizen experience uses the same reaction-first logic from single feedback up to city mood.

Allowed moods:

- `Grateful`
- `Satisfied`
- `Sad`
- `Angry`

No other mood labels should remain in this app.

---

## Current Code Anchors

### Already aligned
- Reactions are already limited to the 4 moods in [FeedCard.jsx](./src/components/FeedCard/FeedCard.jsx)
- Mood label guard already exists in [shared.jsx](./src/components/RightAside/shared.jsx)
- City mood RPC hook already exists in [useCityMood.js](./src/core/hooks/useCityMood.js)

### Still needs replacement
- Heuristic filtered mood logic still exists in [LGUPageUtils.js](./src/views/LGUPage/LGUPageUtils.js)
- City Mood card consumes `useCityMood()` in [FeedAside.jsx](./src/components/RightAside/FeedAside.jsx)

---

## What citizen-web should do

## 1. Feedback reaction source
Use the 4 reactions in `FeedCard.jsx` as the official mood input per feedback.

Each feedback should ultimately expose:

- `reaction_total`
- `breakdown`
- `final_mood`
- `mood_confidence`
- `mood_source`

## 2. Single feedback behavior
For each feedback card or detail view:

- if strong reaction mood exists, use it
- if not, allow fallback prediction internally
- if not enough signal, show `No mood data yet`

## 3. City mood card
For the `City Mood` card in `FeedAside.jsx`:

- keep reading from `get_city_mood`
- ensure returned mood is only one of the 4 allowed labels
- keep fallback state when no data is available
- display breakdown only if the backend provides it

## 4. LGU / city performance views
In `LGUPageUtils.js`, replace the current complaint / suggestion / compliment heuristic with:

- reaction-based city mood when viewing broad city performance
- reaction-based filtered mood when the current post set has enough reaction summary data

Do not derive mood from:

- complaint count only
- resolved count only
- compliment count only

Those are service metrics, not mood truth.

---

## citizen-web Implementation Steps

## Phase 1. Standardize outputs
- create or confirm one shared 4-mood constant
- remove any labels like `No signal`, `Positive`, `Mixed`, or similar where they act as real mood outputs
- keep `No mood data yet` only as an empty state

## Phase 2. Wire feedback mood summaries
- expose reaction breakdown from backend to feed records
- attach `final_mood` and `mood_confidence` per feedback where available

## Phase 3. Replace heuristic mood logic
- refactor `deriveFilteredMood()` in `LGUPageUtils.js`
- make it consume actual mood summaries instead of post type weighting

## Phase 4. UI validation
- feedback cards
- city mood card
- LGU performance widgets
- any export or search surface that may later show mood

---

## Testing Checklist

- reacting to a feedback updates mood counts correctly
- switching reactions updates counts instead of duplicating them
- city mood card still works for 7-day RPC output
- `LGUPageUtils` no longer infers mood from complaint / compliment heuristics
- no citizen-web screen outputs a fifth mood label

---

## Model Use in citizen-web

The model is not the main public truth here.

Use it only when:

- a feedback has no reactions yet
- confidence from reactions is too weak
- the app needs internal fallback labeling

Public rule:

- real reactions always override predicted mood
