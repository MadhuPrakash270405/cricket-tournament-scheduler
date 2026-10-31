# Cricket Tournament Scheduler

A Vue 3 **CDN-only**, single-page, static cricket tournament scheduler. No build step or npm dependencies needed.

## Features

- Team registration, ratings and random icons
- CSV import/export for teams; template CSV download
- Snake-seeded, rating-based balanced pools
- Round-robin league fixtures per pool
- Scheduling by start time, match duration and available grounds
- Team preferences: 3 consecutive matches, early, late, final pool match, break between games
- Warnings for unmet preferences and midnight crossing
- CSV schedule export and ball count (2 per match)

## Run locally

Double-click `index.html` (requires internet for Vue CDN), or run:

```bash
python3 -m http.server 8000
```

Visit http://localhost:8000.

## Source layout

- `index.html` — Vue templates, page structure, and accessible controls.
- `styles.css` — design tokens, layouts, controls, and mobile styles.
- `app.js` — team state, pool balancing, scheduling, preference matching, and CSV handling. Sections are labeled in the source.
- `tests/app.test.cjs` — dependency-free regression checks.
- `teams-ranked.csv` — the supplied tournament roster, strongest first.

Keep the three web files together; opening or hosting `index.html` loads the other two using relative paths. No build step is required.

## Development checks

Run `node --test tests/app.test.cjs` from this folder. Tests cover balanced pools, unique fixtures and ground slots, CSV quotes, preference matching, rejected imports, and ranked roster order.

To format the source, run `npx prettier --write index.html styles.css app.js tests/app.test.cjs`.

## Publish with GitHub Pages

The live site is https://madhuprakash270405.github.io/cricket-tournament-scheduler/.
Publish `index.html`, `styles.css`, and `app.js` together in the repository root. Pages deploys from `main` at `/(root)`.

## Tournament ranking

Import `teams-ranked.csv` to use the 21-team list. ECC Kurallu is first and ICL OGs is last. Ratings run from 21 to 1 and encode order only; they are not measured performance scores. The generic 24-team demo remains the default when the app opens.

Clear matches from the original local CSV retain their preferences: Gujarat / Gujarat Titans, Drug runner / Drugrunners, Erie marvel / Erie Marvels, plus CSK, ASG, MCC, LCC, and Cardinals. MCC retains its required consecutive-match preference. Blank icons are assigned during import.

SW Eagles was not assumed to be SW Pocket Aces. The original “Kent” consecutive-match preference was not assigned to either Kent black squirrels or Kent cricket team without confirmation. Teams with no confirmed preference use `none`.

## Important limitations

- This is a static browser app, and does not persist inputs after a reload; export teams CSV for backup.
- For pools larger than four, the scheduler uses original round-robin ordering rather than exhaustive optimization.
- Preference optimization is per-pool, not a globally optimal multi-ground solver. Ground assignment is sequential by pool; conflicts from overlapping teams are avoided because each pool's fixtures occupy one ground sequentially.
- The "early" and "late" preference scoring is currently relative to the team's pool schedule. Morning cutoff is additionally flagged when the pool begins late.
- Knockout brackets and multi-day scheduling are future features.

## CSV time preferences

Use `after9` or `after10`, or the readable forms `after 9 am` and `after 10 am`. Letter case, spaces, and periods in these time preferences are ignored (for example, `After 9 A.M.`). Unsupported times still produce an import error.

## Preference matching

CSV imports match supported values, dropdown labels, and common phrases (such as `back to back`, `morning`, and `gap between matches`). Minor typos are matched only when one option is clearly closer. Explicit morning times between 8 and 11 are mapped to the nearest supported threshold (9 or 10 AM); ties choose 10 AM. Approximate mappings are marked for review and are rejected for hard constraints. Ambiguous text, conflicting requests, and unsupported times remain import errors. The import message lists mappings with the original text, row, and team.

## Highest and lowest seed separation

The highest-rated and lowest-rated teams must be in different pools. If snake seeding puts them together, the scheduler swaps the lowest seed with a team in another pool, selecting the swap with the smallest resulting rating spread. Pool sizes stay unchanged. Use at least two pools. Equal ratings are ordered by team ID, as with existing seeding. For the ranked roster, this separates ECC Kurallu and ICL OGs. Other recorded pool exclusions are still pending implementation.

## Poster views

Generate pools to see a live poster board with cream cards, club/team names, ratings, and colored pool accents. Generate a schedule to see live fixture cards grouped by pool, with start times, ground numbers, match numbers, and pool finish times. The schedule defaults to Poster cards; use the Table switch for the chronological table. Both layouts read the same generated data. These views are HTML/CSS, not image exports.
