# Build and Release System

Complete guide to the mcp-smarterthings build and release automation system.

## Table of Contents

- [Quick Start](#quick-start)
- [Build System](#build-system)
- [Release System](#release-system)
- [Version Management](#version-management)
- [Build Tracking](#build-tracking)
- [Scripts Reference](#scripts-reference)

## Quick Start

### Common Commands

```bash
# Development
make dev                # Start development mode with watch
make build              # Full production build
make test               # Run all tests

# Code Quality
make lint               # Check code quality
make format             # Format code
make quality            # Run all quality checks

# Version Management
make version-status     # Check version and suggested bump
make version-current    # Show current version

# Release
make release-auto       # Auto-detect and create release
make release-patch      # Create patch release (1.0.0 -> 1.0.1)
make release-minor      # Create minor release (1.0.0 -> 1.1.0)
make release-major      # Create major release (1.0.0 -> 2.0.0)
```

## Build System

### Overview

The build system provides:
- Automated pre-build validation (type check, lint, test)
- Build artifact verification
- Build metadata tracking
- Development and production build modes

### Build Scripts

#### Full Production Build

```bash
make build
# or
pnpm run build
# or
bash scripts/build.sh
```

**Steps performed:**
1. Type checking (`tsc --noEmit`)
2. Linting (`eslint`)
3. Tests (`vitest`)
4. Clean previous build (`rm -rf dist/`)
5. Build TypeScript (`tsc`)
6. Update build metadata (git commit, branch, timestamp)
7. Verify build artifacts
8. Record build in tracking system

#### Development Build

Skip validation for faster iteration:

```bash
make build-dev
# or
pnpm run build:dev
# or
SKIP_VALIDATION=true SKIP_TESTS=true bash scripts/build.sh
```

#### Clean Build

```bash
make build-clean
# or
pnpm run build:clean
```

### Build Environment Variables

Control build behavior with environment variables:

```bash
# Skip pre-build validation
SKIP_VALIDATION=true bash scripts/build.sh

# Skip tests (but run type check and lint)
SKIP_TESTS=true bash scripts/build.sh

# Combine options
SKIP_VALIDATION=true SKIP_TESTS=true bash scripts/build.sh
```

### Build Verification

Verify build artifacts after build:

```bash
make build-verify
```

Checks:
- `dist/` directory exists
- `dist/index.js` exists
- `dist/index.d.ts` exists (type declarations)
- `dist/mcp/` directory exists
- Reports build size and artifact counts

## Release System

### Overview

The release system provides:
- Semantic versioning with conventional commits
- Automated changelog generation
- Full release workflow automation
- CI/CD integration
- npm publishing

### Automated Release

**Recommended method** - One command to do everything:

```bash
# Auto-detect version bump from commits
make release-auto

# Or specify bump type
make release-patch    # Bug fixes (1.0.0 -> 1.0.1)
make release-minor    # New features (1.0.0 -> 1.1.0)
make release-major    # Breaking changes (1.0.0 -> 2.0.0)
```

**What happens:**
1. ✅ Verify working directory is clean
2. ✅ Run quality checks (type check, lint, test)
3. ✅ Bump version (package.json, package-lock.json)
4. ✅ Update CHANGELOG.md from commits
5. ✅ Update src/version.ts
6. ✅ Build production artifacts
7. ✅ Create git commit and tag
8. ✅ Push to remote
9. ✅ Publish to npm (optional)

### Release Options

Control release behavior with environment variables:

```bash
# Dry run (test without making changes)
DRY_RUN=true bash scripts/release.sh patch
# or
make release-dry-run

# Skip tests (not recommended)
SKIP_TESTS=true bash scripts/release.sh patch

# Skip build
SKIP_BUILD=true bash scripts/release.sh patch

# Skip npm publish
SKIP_PUBLISH=true bash scripts/release.sh patch

# Skip git operations
SKIP_GIT=true bash scripts/release.sh patch
```

### Using standard-version Directly

For version bump and changelog only (no build/publish):

```bash
pnpm run release:patch
pnpm run release:minor
pnpm run release:major
```

This uses `standard-version` to:
- Bump version
- Update CHANGELOG.md
- Create commit and tag

Then manually build and publish:

```bash
make build
npm publish --access public
```

## Version Management

### Check Version Status

```bash
# Current version
make version-current
# Output: 1.0.3

# Full status with suggested bump
make version-status
# Output:
# Current version: 1.0.3
# Last git tag: v1.0.3
# Suggested bump: minor
# Recent commits:
#   - feat: new feature
#   - fix: bug fix
```

### Sync Version

Ensure version is synchronized across all files:

```bash
make version-sync
# or
pnpm run version:sync
```

Updates:
- `package.json`
- `package-lock.json`
- `src/version.ts`

### Manual Version Bump

```bash
# Using scripts
make version-bump-patch    # 1.0.0 -> 1.0.1
make version-bump-minor    # 1.0.0 -> 1.1.0
make version-bump-major    # 1.0.0 -> 2.0.0

# Using version script directly
bash scripts/version.sh bump patch
bash scripts/version.sh bump minor
bash scripts/version.sh bump major

# Set specific version
bash scripts/version.sh set 2.0.0
```

### Version Analysis

Analyze commits to determine suggested version bump:

```bash
bash scripts/version.sh analyze
# Output: patch | minor | major
```

Based on conventional commit types:
- `fix:` → patch
- `feat:` → minor
- `BREAKING CHANGE:` or `!:` → major

## Build Tracking

Track build numbers, metadata, and history.

### Commands

```bash
# Show build history
make build-history
bash scripts/build-tracker.sh history

# Show latest build info
make build-latest
bash scripts/build-tracker.sh latest

# Get current build number
bash scripts/build-tracker.sh get

# Initialize tracking
bash scripts/build-tracker.sh init

# Clean tracking data
make build-track-clean
bash scripts/build-tracker.sh clean
```

### Build Metadata

Each build records:
- Build number (auto-incremented)
- Timestamp (ISO 8601)
- Version (from package.json)
- Git commit hash
- Git branch
- Build status (success/failure)

Stored in:
- `.build/build_number` - Current build number
- `.build/build_history.log` - Build history
- `.build/latest_build.json` - Latest build metadata

### Example Build History

```
Build# | Timestamp            | Version | Commit  | Branch | Status
-------|----------------------|---------|---------|--------|--------
1      | 2025-01-15T10:30:00Z | 1.0.0   | abc1234 | main   | success
2      | 2025-01-15T14:45:00Z | 1.0.1   | def5678 | main   | success
3      | 2025-01-16T09:15:00Z | 1.1.0   | ghi9012 | main   | success
```

## Scripts Reference

### build.sh

**Location:** `scripts/build.sh`

**Usage:**
```bash
bash scripts/build.sh [production|development]

# Environment variables
SKIP_VALIDATION=true   # Skip pre-build checks
SKIP_TESTS=true        # Skip tests
```

**Features:**
- Pre-build validation (type check, lint, test)
- Clean previous build
- Update build metadata
- Build TypeScript
- Verify build artifacts
- Track build in history

### version.sh

**Location:** `scripts/version.sh`

**Usage:**
```bash
bash scripts/version.sh COMMAND

Commands:
  current          # Show current version
  status           # Show version status and suggested bump
  bump [TYPE]      # Bump version (patch|minor|major)
  set VERSION      # Set specific version
  sync             # Sync version across files
  analyze          # Analyze commits and suggest bump
```

**Examples:**
```bash
bash scripts/version.sh current
bash scripts/version.sh status
bash scripts/version.sh bump minor
bash scripts/version.sh set 2.0.0
bash scripts/version.sh sync
```

### release.sh

**Location:** `scripts/release.sh`

**Usage:**
```bash
bash scripts/release.sh {patch|minor|major|auto}

# Environment variables
DRY_RUN=true           # Test without making changes
SKIP_TESTS=true        # Skip test execution
SKIP_BUILD=true        # Skip build step
SKIP_PUBLISH=true      # Skip npm publish
SKIP_GIT=true          # Skip git operations
```

**Examples:**
```bash
# Auto-detect release type
bash scripts/release.sh auto

# Specific release type
bash scripts/release.sh patch

# Dry run
DRY_RUN=true bash scripts/release.sh minor

# Skip npm publish
SKIP_PUBLISH=true bash scripts/release.sh patch
```

### build-tracker.sh

**Location:** `scripts/build-tracker.sh`

**Usage:**
```bash
bash scripts/build-tracker.sh COMMAND

Commands:
  init       # Initialize build tracking
  get        # Get current build number
  increment  # Increment build number
  record     # Record a build (increments + saves metadata)
  history    # Show recent build history
  latest     # Show latest build metadata
  clean      # Clean build tracking data
```

**Examples:**
```bash
bash scripts/build-tracker.sh init
bash scripts/build-tracker.sh record
bash scripts/build-tracker.sh history
bash scripts/build-tracker.sh latest
```

## CI/CD Integration

### GitHub Actions Workflows

#### CI Workflow (`.github/workflows/ci.yml`)

Runs on push and pull requests:
- Tests on Node.js 18.x and 20.x
- Type checking
- Linting
- Code formatting check
- Build verification
- Upload build artifacts

#### Release Workflow (`.github/workflows/release.yml`)

Triggers on version tags (`v*.*.*`):
- Run tests
- Build project
- Verify version matches tag
- Publish to npm with provenance
- Create GitHub release
- Verify published package

### Triggering Releases via CI/CD

```bash
# Create and push a tag
git tag v1.2.3
git push origin v1.2.3

# GitHub Actions will automatically:
# 1. Build and test
# 2. Publish to npm
# 3. Create GitHub release
```

## Conventional Commits

The release system relies on conventional commit messages.

### Format

```
<type>(<scope>): <subject>
```

### Types

- `feat:` - New feature (minor bump)
- `fix:` - Bug fix (patch bump)
- `docs:` - Documentation
- `style:` - Code style
- `refactor:` - Code refactoring
- `perf:` - Performance improvement
- `test:` - Tests
- `build:` - Build system
- `ci:` - CI/CD
- `chore:` - Chores

### Breaking Changes

Add `!` after type or include `BREAKING CHANGE:` in footer:

```bash
feat(api)!: redesign device interface

BREAKING CHANGE: Device API has been redesigned
```

This triggers a major version bump.

## Best Practices

1. **Always use conventional commits** - Enables automatic versioning
2. **Run dry run before release** - Test with `make release-dry-run`
3. **Check version status** - Use `make version-status` before release
4. **Keep working directory clean** - Commit changes before release
5. **Release from main branch** - Ensure you're on main/master
6. **Verify after publish** - Test installation after npm publish
7. **Use quality checks** - Run `make quality` regularly
8. **Review changelog** - Check generated CHANGELOG.md before release

## Troubleshooting

### Build Fails

```bash
# Check what's failing
make quality

# Fix issues
make lint-fix
make format

# Retry build
make build
```

### Version Mismatch

```bash
# Sync version across files
make version-sync
```

### Tests Failing

```bash
# Run tests
make test

# Run specific test suites
make test-unit
make test-integration

# Run with coverage
make test-coverage
```

### Release Fails

```bash
# Run dry run to see what would happen
make release-dry-run

# Check version status
make version-status

# Ensure working directory is clean
git status
```

## Resources

- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contributing guidelines
- [RELEASE_GUIDE.md](./RELEASE_GUIDE.md) - Detailed release guide
- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [standard-version](https://github.com/conventional-changelog/standard-version)
