# Yaba Architecture

This document describes the runtime structure and extension boundaries of Yaba.

## Goals

- Keep the CLI contract stable for automation users.
- Keep command behavior deterministic with explicit exit codes and JSON output.
- Keep external integrations (GitHub, Slack, future providers) isolated behind service boundaries.
- Keep the codebase maintainable for a small team.

## Runtime Overview

Yaba runs in three high-level phases:

1. Parse and normalize CLI input.
2. Resolve runtime configuration (flags, env, config files).
3. Execute one command handler (`release`, `doctor`, or `config`) and return an exit code.

Main entrypoint:

- `bin/index.js`

## Layered Structure

### 1) CLI Parsing

`bin/utils/command.js` is responsible for:

- Declaring commands/options with `yargs`.
- Normalizing flags and aliases.
- Deriving canonical command ids (`release.create`, `release.preview`, `doctor`, `config.init`, `config.validate`).
- Producing deprecation warnings for legacy flag usage.

### 2) Command Orchestration

`bin/index.js` is intentionally thin:

- Validates command support.
- Creates output controller (`human`/`json`).
- Loads runtime config once (except `config init`).
- Routes to command handlers.
- Applies centralized error normalization and exit-code propagation.

### 3) Command Handlers

Command handlers contain command-specific orchestration only:

- `bin/commands/release-command.js`
- `bin/commands/doctor-command.js`
- `bin/commands/config-init-command.js`
- `bin/commands/config-validate-command.js`

### 4) Shared Services

Services host reusable domain logic:

- `bin/services/runtime-config-service.js`
  - default config template
  - config file loading/merging
  - context resolution for release runtime
- `bin/services/config-validation-service.js`
  - schema-like validation for resolved config
- `bin/services/release-safety-service.js`
  - release gating (`allowEmpty`, `failOnEmpty`, `maxCommits`)
- `bin/services/command-output.js`
  - human summaries and JSON output helpers

### 5) Integration Adapters

`bin/utils/flow.js` is the external IO adapter layer:

- GitHub API calls via `octokit`
- network connectivity checks
- Slack webhook publishing
- spinner-based human output for long-running operations

`bin/utils/helper.js` provides utility behavior (repo detection, defaults, prompt interaction, templating input prep).

## Notification Provider Boundary

Notification fan-out is decoupled from release logic:

- `bin/notifications/publisher.js`
- `bin/notifications/providers/slack-provider.js`

`release-command` calls `publishReleaseNotifications(...)` with context. Providers are validated against the registry before execution.

## Configuration Model

Resolution precedence:

`flags > env vars > project config (./yaba.config.json) > user config (~/.config/yaba/config.json) > defaults`

Important config namespaces:

- `github.*`
- `release.*`
- `notifications.*`
- `output.*`

Validation entrypoint:

- `yaba config validate`

## Output and Exit Contracts

- Human output: summaries/spinners for interactive users.
- JSON output: stable machine-readable payloads for CI/automation.
- Exit codes are deterministic and centralized in `bin/utils/exit-codes.js`.

## Extension Playbooks

### Add a New Command

1. Add command declaration in `bin/utils/command.js`.
2. Add handler module under `bin/commands/`.
3. Route it from `bin/index.js`.
4. Add unit + integration tests for the command contract.
5. Update README usage docs.

### Add a New Notification Provider

1. Create `bin/notifications/providers/<provider>-provider.js` with `publish(context)`.
2. Register provider in `bin/notifications/publisher.js`.
3. Add provider validation tests.
4. Document required env/config.

### Add a New Config Field

1. Add default in `buildDefaultConfigTemplate`.
2. Add resolution logic in `resolveReleaseContext` or relevant resolver.
3. Add validation rules in `config-validation-service`.
4. Add tests for precedence + validation.

## Architectural Constraints

- `utils/flow.js` still mixes transport and spinner concerns in one module; future extraction into API client + UI progress adapter would reduce coupling.
- The project remains JavaScript-first (no TypeScript dependency), so contracts rely on tests + validation instead of static types.
- CLI parsing currently normalizes legacy behavior for v2 compatibility; v3 can simplify this surface by removing deprecated options.
