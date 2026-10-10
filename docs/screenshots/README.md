# Editor screenshots

Run the ROM backed Playwright tests to regenerate these screenshots:

```sh
cd frontend
npm run build
CHROMIUM_PATH=/bin/chromium npm run test:e2e -- --grep 'stock ROM documentation'
```

The tests load `ssint_orig.md` from the project root, edit a copy in the browser,
and save the images here. They also verify JSON export and import, validation,
ROM download, and reopening the edited ROM. The source ROM is never changed.
The [game kit editor capture](game-kit-editor.png) comes from MAME and was used
to verify the RGB values documented in `rom-structure.md`.

To capture each of the ten in-game shirt colours, run this from the project root
with MAME and `xvfb-run` installed:

```sh
./scripts/capture-kit-colours.sh
```

The script opens `ssint_orig.md` in MAME, enters Custom Teams > Edit Teams,
highlights the second kit's shirt, and holds B while cycling through the
colours. It writes the images to [game-kit-colours](game-kit-colours). Pass an
output directory as the first argument to save them elsewhere.

| Image | Shows |
|-------|-------|
| [01-open-rom.png](01-open-rom.png) | ROM file chooser |
| [02-team-browser.png](02-team-browser.png) | Team categories and list |
| [03-team-info.png](03-team-info.png) | Team details and formation |
| [04-colour-options.png](04-colour-options.png) | Available kit colours |
| [04-kits.png](04-kits.png) | Both edited kits |
| [05-players.png](05-players.png) | Player table |
| [06-advanced-roles.png](06-advanced-roles.png) | Stored role controls |
| [07-validation.png](07-validation.png) | Invalid position feedback |
| [08-imported-team.png](08-imported-team.png) | Imported JSON result |
| [09-download-rom.png](09-download-rom.png) | ROM download controls |
| [10-mobile-editor.png](10-mobile-editor.png) | Editor at mobile width |
