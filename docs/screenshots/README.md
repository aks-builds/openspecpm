# Screenshots

Source images for the README's `## In action` section.

## Conventions

- **Format:** PNG (use JPG only for wide photos, not for UI / terminal captures)
- **Width:** 1200–1400 px is the sweet spot — wider just gets downscaled by GitHub's renderer
- **Size:** keep under ~500 KB per image; compress with [tinypng.com](https://tinypng.com) if needed
- **Filename:** lowercase, kebab-case, named for the command or flow shown — e.g.
  - `init.png` — the interactive setup wizard
  - `propose.png` — authoring a proposal
  - `status.png` — tracking commands (status / next / blocked)
  - `sync.png` — the sync flow producing work items
  - `ship.png` — closing tasks + archiving a feature

## Adding a screenshot

1. Capture the PNG and save it here using one of the filenames above (or add a new one).
2. Open the top-level [`README.md`](../../README.md) and uncomment the matching `![…](docs/screenshots/…)` line in the **In action** section, or add a new one.
3. Commit both the image and the README change in the same PR so the badge and the picture land together.
