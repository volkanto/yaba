# Development Guide

## Local Setup

```bash
npm install
```

Run all tests:

```bash
npm test
```

## Test Strategy

Current test layers:

- Core tests (`test/*.test.js`)
  - parser normalization
  - service logic
  - error mapping
  - config/runtime behavior

Recommended v2.1.0 target layer:

- Integration tests (`test/integration/*.test.js`) for command contracts and process-level behavior.

When adding features:

1. Add unit tests for pure logic.
2. Add at least one integration test for the command-level contract.
3. Prefer JSON mode assertions for stable automation behavior.

## CI Expectations

CI should run unit tests and integration tests separately so:

- unit failures stay fast and focused
- integration failures are isolated to runtime/contract behavior

## Change Checklist

Before opening a PR:

1. `npm test`
2. Verify `yaba --help` output for new flags/commands.
3. Verify JSON output for changed commands (`--format json`).
4. Update README and architecture docs when boundaries or contracts change.

## Branch and Commit Conventions

- Branch type prefixes:
  - `feat/...`
  - `fix/...`
  - `chore/...`
  - `bug/...`
- Commit message style:
  - `feat(scope): summary`
  - `fix(scope): summary`
  - `chore(scope): summary`

## Release Safety Guidance

For automated release flows:

- use `--no-prompt` to avoid interactive hangs
- consider `--fail-on-empty` for strict pipelines
- use `--max-commits` to prevent oversized release drops

For controlled exceptions:

- use `--allow-empty` explicitly (never as a default)
