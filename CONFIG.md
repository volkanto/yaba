# Yaba Configuration Guide

This document describes all available configuration options for `yaba.config.json`.

## Configuration File Locations

Configuration can be placed in one of three locations (in order of precedence):

1. **Project-level** (recommended): `yaba.config.json` in your repo root
2. **User-level**: `~/.config/yaba/config.json` (applies to all projects)
3. **Explicit path**: Via `--config` flag in CLI

Project-level config merges with and overrides user-level config.

## Configuration Schema

### `github` Object

GitHub repository ownership settings.

```json
{
  "github": {
    "owner": "your-org"
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `owner` | string | null | GitHub organization or username |

### `release` Object

Release and tag settings.

#### General Settings

```json
{
  "release": {
    "repo": "my-repo",
    "namePattern": "Global release {yyyy-MM-dd}",
    "target": null,
    "allowEmpty": false,
    "failOnEmpty": false,
    "maxCommits": null,
    "draft": false,
    "interactive": true,
    "firstReleaseMaxCommits": 50
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `repo` | string | null | Repository name |
| `namePattern` | string | "Global release {yyyy-MM-dd}" | Release name pattern (supports `{yyyy}`, `{MM}`, `{dd}`) |
| `target` | string | null | Target branch/commit for release (null = use head branch) |
| `allowEmpty` | boolean | false | Allow releases with no changes |
| `failOnEmpty` | boolean | false | Fail explicitly if no changes found |
| `maxCommits` | number | null | Maximum commits to include in release |
| `draft` | boolean | false | Create release as draft |
| `interactive` | boolean | true | Prompt for confirmation before creating release |
| `firstReleaseMaxCommits` | number | 50 | Max commits for first release (no previous tag) |

#### Tag Settings

```json
{
  "release": {
    "tagPattern": "prod_global_{yyyyMMdd}.{HHmm}",
    "tagStrategy": "pattern",
    "tagOnConflict": "increment",
    "tagMaxAttempts": 20
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `tagPattern` | string | "prod_global_{yyyyMMdd}.{HHmm}" | Tag name pattern. Supports: `{yyyyMMdd}`, `{HHmm}`, `{yyyy}`, `{MM}`, `{dd}`, `{HH}`, `{mm}`, `{ss}`, `{shortSha}`, `{branch}`, `{runNumber}` |
| `tagStrategy` | string | "pattern" | Tag generation strategy: `"pattern"`, `"semver"`, or `"sha"` |
| `tagOnConflict` | string | "increment" | When tag exists: `"increment"` (add suffix) or `"fail"` (reject) |
| `tagMaxAttempts` | number | 20 | Max attempts to find available tag name when incrementing |

#### Label Buckets (Release Notes Grouping)

```json
{
  "release": {
    "labelBuckets": [
      {
        "key": "security",
        "title": "Security Fixes",
        "labels": ["security", "type:security"]
      },
      {
        "key": "chore",
        "title": "Chore",
        "labels": ["chore", "type:chore"]
      }
    ]
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `labelBuckets` | array | null | Custom label-to-section mappings for GitHub release notes |

**Label Bucket Object:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | Yes | Machine identifier (must be unique within array) |
| `title` | string | No | Section heading in release notes. If omitted, derives from `key` (e.g., `techImprovement` → "Tech Improvement") |
| `labels` | array | Yes | Non-empty array of label strings to match (case-insensitive) |

**Behavior:**
- When `labelBuckets` is `null` (default), uses built-in defaults for Breaking Changes, Features, Fixes, Dependencies, Documentation
- PRs matching no bucket automatically go to "Internal" section
- Sections render in the order defined, followed by Internal

### `notifications` Object

Notification provider settings.

```json
{
  "notifications": {
    "providers": ["slack"],
    "slack": {
      "enabled": false
    }
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `providers` | array | ["slack"] | List of notification providers to use |
| `slack.enabled` | boolean | false | Enable Slack notifications on release create |

**Supported providers:** `slack`

### `output` Object

Output formatting settings.

```json
{
  "output": {
    "format": "human",
    "color": true,
    "verbose": false
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `format` | string | "human" | Output format: `"human"` or `"json"` |
| `color` | boolean | true | Enable colored output |
| `verbose` | boolean | false | Enable verbose logging |

## Complete Example

See `yaba.config.example.json` for a complete working example with all options.

## Label Buckets Examples

### Example 1: Custom Label Scheme

```json
{
  "release": {
    "labelBuckets": [
      {
        "key": "breaking",
        "title": "⚠️ Breaking Changes",
        "labels": ["breaking", "BREAKING"]
      },
      {
        "key": "enhancement",
        "title": "✨ Enhancements",
        "labels": ["enhancement", "feature", "feat"]
      },
      {
        "key": "bugfix",
        "title": "🐛 Bug Fixes",
        "labels": ["bug", "bugfix", "fix"]
      },
      {
        "key": "maintenance",
        "labels": ["chore", "maintenance"]
      }
    ]
  }
}
```

### Example 2: Minimal (Use Defaults)

```json
{
  "release": {
    "labelBuckets": null
  }
}
```

This is equivalent to omitting the field entirely.

## CLI Override Precedence

Most settings can be overridden via CLI flags:

```bash
# CLI flag > Config file > Default
yaba release create --owner myorg --repo myrepo
yaba release create --draft
yaba release create --allow-empty
```

For complete flag list:
```bash
yaba release --help
yaba config validate
```

## Validation

Validate your config file:

```bash
yaba config validate
```

This checks:
- Schema correctness
- Field types
- Enum values
- Required fields
- Label bucket uniqueness and structure
