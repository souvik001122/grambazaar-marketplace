# Contributing to GramBazaar

Thanks for contributing. This guide defines the standard workflow, quality bar, and review expectations for this repository.

## Branch Strategy

- `main`: stable, release-ready branch.
- `develop`: active integration branch.
- `feature/*`: optional for isolated large changes.

Rules:
- Open pull requests to `develop` for normal work.
- Merge to `main` only after review, validation, and stability checks.
- Do not create lab-specific branches.

## Contribution Workflow

1. Sync your local `develop` branch.
2. Create a focused branch if needed (`feature/*`).
3. Implement one logical change set at a time.
4. Run checks and manual verification for affected flows.
5. Commit with the approved message format.
6. Open a pull request to `develop` with clear notes.
7. Address review feedback and update docs/lab traces where needed.

## Commit Message Convention

Use one of these prefixes:
- `[INIT]` repository/bootstrap setup
- `[DOCS]` documentation updates
- `[LAB-x]` lab tracking updates (for x = 1..12)
- `[FEAT]` new feature
- `[FIX]` bug fix
- `[MERGE]` controlled branch integration

Commit quality requirements:
- Keep commits atomic and reviewable.
- Do not mix unrelated refactors with functional fixes.
- Write clear, action-oriented commit summaries.

## Pull Request Standard

Each PR should include:
- Purpose and scope.
- Key files/modules changed.
- Validation performed (manual and/or automated).
- Any Appwrite schema/index/permission impact.
- Any documentation updates.

## Required PR Checklist

- No new compile or type errors.
- Affected workflows tested.
- Documentation updated for behavior/setup changes.
- Lab traceability updated when relevant.
- No secrets or credentials committed.

## Appwrite Schema Alignment (Mandatory)

For backend-impacting changes:
- Keep code and Appwrite schema fully aligned.
- Update attributes, indexes, permissions, and validation rules as needed.
- Include setup/migration script updates in the same change set when applicable.
- Do not rely only on app-side workarounds for schema validation issues.

## Lab Documentation Policy

- Labs are tracked only in `docs/lab1` through `docs/lab12`.
- Keep `docs/lab-traceability-matrix.md` synchronized with meaningful milestones.

## Code Quality Expectations

- Preserve module boundaries and existing architecture patterns.
- Prefer robust, maintainable fixes over temporary patches.
- Keep naming, formatting, and error handling consistent.
- Add or update tests where practical for critical behavior changes.

## Review Expectations

Reviewers focus on:
- Correctness and regression risk.
- Security and data integrity.
- Appwrite permission/schema correctness.
- Clarity and maintainability.
- Documentation completeness.

## Communication

If a change is large, risky, or cross-cutting:
- Split into smaller PRs when possible.
- Mention assumptions and known limitations explicitly.
- Request early feedback before broad refactoring.
