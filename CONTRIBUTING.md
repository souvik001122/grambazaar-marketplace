# Contributing to GramBazaar

Thank you for contributing to GramBazaar. This guide defines the expected workflow and quality bar for all project updates.

## Project Team
- Shubham Kumar (231210099)
- Souvik Das (231210104)
- Vivek Bhardwaj (231210125)
- Yuvraj Pegu (231210129)

## Branching Model
- Use `develop` for daily integration work.
- Use `main` only for stable, review-ready state.
- Optionally use `feature/*` branches for large isolated work.

## Standard Contribution Workflow
1. Pull the latest updates from `develop`.
2. Implement focused changes (optionally on a `feature/*` branch).
3. Commit in small logical steps, not one large commit.
4. Push and create a pull request to `develop`.
5. Merge to `main` only after review and stability validation.

## Commit Format
- `[LAB-x]` for academic timeline entries.
- `[FEAT]` for feature implementation.
- `[FIX]` for bug fixes and stability improvements.
- `[DOCS]` for documentation updates.
- `[INIT]` for baseline/repository initialization.

## Commit Quality Rules
- Keep each commit atomic and easy to review.
- Avoid mixing unrelated files in a single commit.
- Use clear, action-focused commit messages.

## Pull Request Rules
- Target branch: `develop` for active work.
- Keep PR scope focused and testable.
- Include summary, changed modules, and validation notes.
- Update matching docs when behavior changes.

## Pull Request Checklist
- Confirm no new compile/type errors.
- Confirm changed flows are manually tested.
- Confirm docs are updated when behavior or setup changes.
- Confirm lab traceability updates are added where required.

## Lab Documentation Rule
- Labs must be tracked in `docs/lab1` to `docs/lab12`.
- Do not create lab-specific git branches.

## Appwrite and Data Alignment Rule
- Keep Appwrite database schema and indexes aligned with code changes.
- Include migration or setup script updates when backend validation rules change.

## Quality Gate
- Preserve existing coding style and module boundaries.
- Avoid unrelated refactors in focused fixes.
- Ensure no new compile errors before merge.

## Review Standard
- Ship production-style, readable, and maintainable code.
- Prefer robust fixes over temporary workarounds.
- Keep documentation clear, concise, and up to date.
