# Contributing to GramBazaar

## Branching Model
- Use `develop` for daily integration work.
- Use `main` only for stable, review-ready state.
- Optionally use `feature/*` branches for large isolated work.

## Commit Format
- `[LAB-x]` for academic timeline entries.
- `[FEAT]` for feature implementation.
- `[FIX]` for bug fixes and stability improvements.
- `[DOCS]` for documentation updates.
- `[INIT]` for baseline/repository initialization.

## Pull Request Rules
- Target branch: `develop` for active work.
- Keep PR scope focused and testable.
- Include summary, changed modules, and validation notes.
- Update matching docs when behavior changes.

## Lab Documentation Rule
- Labs must be tracked in `docs/lab1` to `docs/lab12`.
- Do not create lab-specific git branches.

## Quality Gate
- Preserve existing coding style and module boundaries.
- Avoid unrelated refactors in focused fixes.
- Ensure no new compile errors before merge.
