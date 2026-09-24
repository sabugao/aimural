# Mural - daily ai journal

The day's AI news, pasted on a wall as front pages. By @danmagatti.

- Every day at 07:00 (São Paulo) the `Daily edition` workflow runs `build.py`. It reads public RSS feeds, keeps AI stories from the last 30 hours, picks 12 (international first, up to 4 Brazilian), saves `data/days/YYYY-MM-DD.json` and publishes the site on GitHub Pages.
- Run it now: Actions -> Daily edition -> Run workflow.
- No keys, no secrets, no dependencies. Each page shows only the headline, a one-line summary and the outlet, and links to the original story.
- Tuning: `MURAL_STORIES` (per day) and `MURAL_MAX_PT` (Brazilian slots) at the top of `build.py`; sources in `FEEDS`.
