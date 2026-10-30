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

## Create local git repository

```bash
git init
git add .
git commit -m "Initial cricket tournament scheduler"
```

## Push to GitHub
Create an empty public GitHub repository named `cricket-tournament-scheduler`. Then:

```bash
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/cricket-tournament-scheduler.git
git push -u origin main
```

Go to **GitHub repository → Settings → Pages → Build and deployment**. Select **Deploy from a branch**, **main**, and **/(root)**, then Save.

Site URL: `https://YOUR_USERNAME.github.io/cricket-tournament-scheduler/`

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
