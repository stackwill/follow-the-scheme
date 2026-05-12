# Manual Crop Review

Local-only review site for comparing imported crops against the original rendered exam paper.

The generated site is separate from the Next app. It shows the paper as a continuous two-column review:

- left: website crops placed at roughly the same position they occupy on the original page
- right: the continuous original rendered PDF pages
- sticky top bar: `Mark paper checked` button for each paper

## Run

```bash
bun run crop:manual-review -- --subject Chemistry
```

Useful filters:

```bash
bun run crop:manual-review -- --adapter aqa-combined-science-chemistry-paper-1-higher
bun run crop:manual-review -- --adapter aqa-combined-science-chemistry-paper-2-higher --year 2024
```

Output goes to `data/manual-crop-review/<timestamp>/` unless `--out` is provided. Serve the folder with a local static server, then open `index.html`.

Checked-paper state is stored in browser localStorage. The index hides checked papers by default, so the remaining list is the staging queue. Checking a paper does not deploy anything by itself.
