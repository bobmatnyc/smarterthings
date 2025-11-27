# Release Guide

This guide provides comprehensive instructions for creating releases of mcp-smartthings.

## Table of Contents

- [Overview](#overview)
- [Semantic Versioning](#semantic-versioning)
- [Release Workflow](#release-workflow)
- [Automated Release](#automated-release)
- [Manual Release](#manual-release)
- [Troubleshooting](#troubleshooting)

## Overview

The mcp-smartthings project uses:

- **Semantic Versioning (semver)**: MAJOR.MINOR.PATCH
- **Conventional Commits**: For automated changelog generation
- **standard-version**: For version bumping and changelog management
- **Automated Scripts**: For streamlined release process

## Semantic Versioning

We follow [Semantic Versioning 2.0.0](https://semver.org/):

- **MAJOR** (1.0.0 -> 2.0.0): Breaking changes
- **MINOR** (1.0.0 -> 1.1.0): New features (backwards compatible)
- **PATCH** (1.0.0 -> 1.0.1): Bug fixes (backwards compatible)

### When to Bump

| Change Type | Version Bump | Example |
|------------|--------------|---------|
| Breaking API changes | MAJOR | Removing a function, changing function signature |
| New features | MINOR | Adding new device support, new API endpoints |
| Bug fixes | PATCH | Fixing authentication issues, error handling |
| Documentation | PATCH | README updates, comment improvements |
| Refactoring | PATCH | Code cleanup without behavior changes |

## Release Workflow

### Automated Release (Recommended)

The simplest way to create a release:

```bash
# 1. Ensure working directory is clean
git status

# 2. Create release (auto-detects version bump from commits)
make release-auto

# Or specify the bump type explicitly
make release-patch    # Bug fixes only
make release-minor    # New features added
make release-major    # Breaking changes
```

### What Happens During Release

The automated release script (`scripts/release.sh`) performs:

1. **Pre-release Checks**
   - ✅ Verify git working directory is clean
   - ✅ Check you're on main/master branch
   - ✅ Fetch latest changes

2. **Quality Validation**
   - ✅ Run all tests (`pnpm test`)
   - ✅ Run type checking (`pnpm run typecheck`)
   - ✅ Run linter (`pnpm run lint`)

3. **Version Management**
   - ✅ Determine version bump (from commits or specified)
   - ✅ Update package.json and package-lock.json
   - ✅ Generate/update CHANGELOG.md
   - ✅ Update src/version.ts

4. **Build**
   - ✅ Clean previous build
   - ✅ Run production build
   - ✅ Verify build artifacts

5. **Git Operations**
   - ✅ Commit version changes
   - ✅ Create git tag (e.g., v1.2.3)
   - ✅ Push changes and tags

6. **Publish** (optional)
   - ✅ Publish to npm registry
   - ✅ Verify published package

## Automated Release Commands

### Using Makefile

```bash
# Auto-detect release type from commits
make release-auto

# Explicit release types
make release-patch    # 1.0.0 -> 1.0.1
make release-minor    # 1.0.0 -> 1.1.0
make release-major    # 1.0.0 -> 2.0.0

# Dry run (test without making changes)
make release-dry-run
```

### Using npm Scripts

```bash
# standard-version only (no build/publish)
pnpm run release:patch
pnpm run release:minor
pnpm run release:major

# Full release workflow (build + publish)
pnpm run release:full:patch
pnpm run release:full:minor
pnpm run release:full:major

# Auto-detect version bump
pnpm run release:auto

# Dry run
pnpm run release:dry-run
```

### Using Release Script Directly

```bash
# Basic usage
bash scripts/release.sh patch
bash scripts/release.sh minor
bash scripts/release.sh major
bash scripts/release.sh auto

# With options
DRY_RUN=true bash scripts/release.sh patch         # Dry run
SKIP_TESTS=true bash scripts/release.sh patch       # Skip tests
SKIP_PUBLISH=true bash scripts/release.sh patch     # Skip npm publish
SKIP_GIT=true bash scripts/release.sh patch         # Skip git operations
```

## Manual Release

If you prefer step-by-step control:

### Step 1: Check Status

```bash
# Check current version
make version-current

# Check version status and suggested bump
make version-status

# View recent commits
git log --oneline --decorate -10
```

### Step 2: Update Version

```bash
# Use standard-version (recommended)
pnpm run release:patch    # or minor/major

# Or bump manually
make version-bump-patch   # or minor/major
```

This will:
- Update package.json and package-lock.json
- Generate changelog from commits
- Create git commit
- Create git tag

### Step 3: Build

```bash
make build
```

### Step 4: Verify

```bash
# Run all quality checks
make quality

# Verify build artifacts
make build-verify
```

### Step 5: Push

```bash
# Push changes and tags
git push --follow-tags origin main
```

### Step 6: Publish (Optional)

```bash
# Publish to npm
npm publish --access public
```

## Version Management

### Check Version

```bash
# Current version
make version-current
# or
pnpm run version:current

# Full status (current, suggested bump, recent commits)
make version-status
# or
pnpm run version:status
```

### Sync Version

Ensure version is synchronized across all files:

```bash
make version-sync
# or
pnpm run version:sync
```

This updates:
- package.json
- package-lock.json
- src/version.ts

### Set Specific Version

```bash
bash scripts/version.sh set 2.0.0
```

## Conventional Commits

Our release automation relies on conventional commit messages.

### Commit Format

```
<type>(<scope>): <subject>
```

### Types That Trigger Version Bumps

- `feat:` → MINOR bump (new feature)
- `fix:` → PATCH bump (bug fix)
- `BREAKING CHANGE:` → MAJOR bump
- `<type>!:` → MAJOR bump (e.g., `feat!:`)

### Examples

```bash
# PATCH bump
git commit -m "fix(auth): resolve token refresh issue"

# MINOR bump
git commit -m "feat(devices): add support for thermostats"

# MAJOR bump
git commit -m "feat(api)!: redesign device control interface"

# MAJOR bump (alternative)
git commit -m "feat(api): redesign device control interface

BREAKING CHANGE: The device control API has been completely redesigned."
```

## Build Tracking

Track builds and metadata:

```bash
# View build history
make build-history

# View latest build info
make build-latest

# Clean build tracking
make build-track-clean
```

Build metadata includes:
- Build number (auto-incremented)
- Timestamp
- Version
- Git commit hash
- Git branch

## CI/CD Integration

### GitHub Actions

The project includes two workflows:

1. **CI Workflow** (`.github/workflows/ci.yml`)
   - Runs on push and PR
   - Tests, lints, builds
   - Uploads build artifacts

2. **Release Workflow** (`.github/workflows/release.yml`)
   - Triggers on version tags (v*.*.*)
   - Builds and tests
   - Publishes to npm
   - Creates GitHub release

### Triggering CI/CD Release

```bash
# Create and push a tag
git tag v1.2.3
git push origin v1.2.3

# The release workflow will automatically:
# 1. Build and test
# 2. Publish to npm
# 3. Create GitHub release
```

## Troubleshooting

### Working Directory Not Clean

```bash
# Check status
git status

# Commit or stash changes
git add .
git commit -m "chore: prepare for release"
# or
git stash
```

### Tests Failing

```bash
# Run tests
make test

# Fix failing tests, then retry release
```

### Version Mismatch

If package.json version doesn't match git tags:

```bash
# Sync version
make version-sync

# Or set specific version
bash scripts/version.sh set 1.2.3
```

### npm Publish Failed

```bash
# Check if logged in
npm whoami

# Login if needed
npm login

# Verify package name is available
npm view @bobmatnyc/mcp-smartthings

# Retry publish
npm publish --access public
```

### Rollback Release

If you need to rollback:

```bash
# Revert the release commit
git revert HEAD

# Delete the tag locally
git tag -d v1.2.3

# Delete the tag remotely
git push origin :refs/tags/v1.2.3

# Unpublish from npm (within 72 hours)
npm unpublish @bobmatnyc/mcp-smartthings@1.2.3
```

### Skip Individual Steps

You can skip steps during release:

```bash
# Skip tests (not recommended)
SKIP_TESTS=true bash scripts/release.sh patch

# Skip build
SKIP_BUILD=true bash scripts/release.sh patch

# Skip npm publish
SKIP_PUBLISH=true bash scripts/release.sh patch

# Skip git operations
SKIP_GIT=true bash scripts/release.sh patch
```

## Release Checklist

Before creating a release:

- [ ] All tests passing
- [ ] Code formatted and linted
- [ ] Documentation updated
- [ ] CHANGELOG accurate (auto-generated from commits)
- [ ] Working directory clean
- [ ] On main/master branch
- [ ] Latest changes pulled

After creating a release:

- [ ] Verify git tag exists
- [ ] Verify npm package published
- [ ] Verify GitHub release created
- [ ] Test installation: `npm install @bobmatnyc/mcp-smartthings@latest`
- [ ] Announce release (if applicable)

## Best Practices

1. **Use Conventional Commits**: Enables automatic changelog and version detection
2. **Run Dry Run First**: Test release process with `make release-dry-run`
3. **Release from Main**: Always release from main/master branch
4. **Clean Working Directory**: Commit all changes before release
5. **Review Changelog**: Check generated changelog before releasing
6. **Test After Publish**: Verify package works after npm publish

## Resources

- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [standard-version](https://github.com/conventional-changelog/standard-version)
- [Keep a Changelog](https://keepachangelog.com/)
