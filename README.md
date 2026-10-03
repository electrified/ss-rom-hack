# Sensible Soccer Mega Drive ROM Editor

A browser based editor for team data in Sensible Soccer Mega Drive ROMs. It
supports the International and Original/European editions and processes ROMs
locally in the browser.

## Features

- Edit national, club, and custom teams.
- Change team, country, coach, and player names; formations; skills; flags; player
  positions, roles, shirt numbers, head types, and star-player flags.
- Edit kit colours and styles.
- Import and export canonical team JSON.
- Validate edits against the ROM's team counts and available capacity before
  downloading the modified ROM.

## Run the editor

Install the frontend dependencies and start the local server:

```sh
cd frontend
npm ci
npm run dev
```

Open the URL printed by Vite, then choose **Open ROM file**. After editing,
download the modified ROM or export the team data as JSON. ROM files and edits
stay in the browser.

## JSON format

Each team requires `team`, `country`, `coach`, `tactic`, `skill`, `flag`, both
complete kits, and exactly 16 players. Every player requires `name`, `number`,
`position`, `role`, and `head`. Text uses uppercase characters from the supported
charset. Team, coach, and player names are limited to 25 characters; countries
are limited to 19. ROM capacity can impose a tighter overall limit.

Enums must use the canonical string names. See [teams.schema.json](teams.schema.json)
for the complete JSON contract and [rom-structure.md](rom-structure.md) for the
binary layout.

## Checks

Use Node.js 26, or Node 22.22.2+ / 24.15.0+ in those release lines:

```sh
cd frontend
npm ci
npm run check
npm run test:e2e
npm audit
```

Browser tests require Chromium. Install it with `npx playwright install chromium`,
or set `CHROMIUM_PATH` to an existing Chromium executable. Regenerate the schema
after changing the domain constants with `npm run schema:generate` from
`frontend`; `npm run check` detects stale generated schema output.
