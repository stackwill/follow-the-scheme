# Crop Preview Tool

Local-only visual review for imported paper crops.

The tool reads the local SQLite import data, renders question groups in a standalone page that mirrors the app's question layout, then captures screenshots with Chromium. It is intended to be run before creating a data release so crop spillover, missing figures, bad continuation crops, and polluted selection options are visible before production deploys.

## Run

```bash
bun run crop:preview -- --subject Chemistry
```

Useful filters:

```bash
bun run crop:preview -- --adapter aqa-combined-science-chemistry-paper-1-higher
bun run crop:preview -- --adapter aqa-combined-science-chemistry-paper-2-higher --year 2024
```

Output goes to `data/crop-previews/<timestamp>/`:

- `index.html`: review dashboard.
- `pages/*.html`: one static page per question group.
- `screenshots/*.png`: one rendered screenshot per question group.
- `manifest.json`: machine-readable run metadata.

This folder is data output, not source code. It should not be committed.
