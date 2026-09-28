# Git hooks (Windows safety)

This repo uses Husky (`.husky/`), not a custom `core.hooksPath`.

`pre-commit` runs `scripts/check-windows-paths.sh --staged` then lint-staged.
`pre-push` scans the whole index.

Enable on a fresh clone:

```
pnpm install
```

Husky installs `.husky/pre-commit` automatically. CI (`.github/workflows/windows-path-safety.yml`) runs the same scan so a machine without hooks cannot land `*:Zone.Identifier` or colon filenames.
