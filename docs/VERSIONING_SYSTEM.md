# Versioning and Build System

Complete overview of the mcp-smartthings versioning, build tracking, and release automation system.

## System Components

### 1. Version Management (`scripts/version.sh`)

Handles semantic versioning with conventional commits integration.

**Key Features:**
- Get current version from package.json
- Analyze commits to suggest version bump
- Bump version (patch/minor/major)
- Set specific version
- Sync version across all files
- Validate version format

**Files Updated:**
- `package.json`
- `package-lock.json`
- `src/version.ts`

**Commands:**
```bash
bash scripts/version.sh current       # Show current version
bash scripts/version.sh status        # Show status + suggested bump
bash scripts/version.sh bump patch    # Bump patch version
bash scripts/version.sh set 2.0.0     # Set specific version
bash scripts/version.sh sync          # Sync version across files
bash scripts/version.sh analyze       # Suggest version bump
```

### 2. Build System (`scripts/build.sh`)

Comprehensive build automation with validation and tracking.

**Build Workflow:**
1. **Pre-build Validation** (optional)
   - Type checking (`tsc --noEmit`)
   - Linting (`eslint`)
   - Tests (`vitest`)

2. **Clean Build**
   - Remove `dist/` directory

3. **Update Build Metadata**
   - Git commit hash
   - Git branch
   - Build timestamp
   - Update `src/version.ts`

4. **Build TypeScript**
   - Compile with `tsc`

5. **Post-build Verification**
   - Verify `dist/` exists
   - Check for `index.js` and `index.d.ts`
   - Count build artifacts
   - Report build size

6. **Track Build**
   - Record build metadata
   - Increment build number

**Build Modes:**
```bash
# Full production build
bash scripts/build.sh

# Development build (skip validation)
SKIP_VALIDATION=true bash scripts/build.sh

# Skip tests only
SKIP_TESTS=true bash scripts/build.sh
```

### 3. Build Tracking (`scripts/build-tracker.sh`)

Tracks build numbers, metadata, and history.

**Tracking Data:**
- Build number (auto-incremented)
- Timestamp (ISO 8601)
- Version (from package.json)
- Git commit hash
- Git branch
- Build status

**Storage:**
- `.build/build_number` - Current build number
- `.build/build_history.log` - Build history log
- `.build/latest_build.json` - Latest build metadata

**Commands:**
```bash
bash scripts/build-tracker.sh init       # Initialize tracking
bash scripts/build-tracker.sh get        # Get current build number
bash scripts/build-tracker.sh record     # Record a build
bash scripts/build-tracker.sh history    # Show build history
bash scripts/build-tracker.sh latest     # Show latest build
bash scripts/build-tracker.sh clean      # Clean tracking data
```

### 4. Release Automation (`scripts/release.sh`)

Complete release workflow automation.

**Release Workflow:**
1. **Pre-release Checks**
   - Verify working directory is clean
   - Check current branch (main/master)
   - Fetch latest changes

2. **Quality Validation**
   - Run tests
   - Type checking
   - Linting

3. **Version Management**
   - Determine version bump (auto or specified)
   - Update package.json and package-lock.json
   - Generate/update CHANGELOG.md
   - Update src/version.ts

4. **Build**
   - Run production build
   - Verify build artifacts

5. **Git Operations**
   - Commit version changes
   - Create git tag (e.g., v1.2.3)
   - Push changes and tags

6. **Publish** (optional)
   - Publish to npm registry
   - Verify published package

7. **Post-release Verification**
   - Verify git tag exists
   - Verify npm package version

**Release Types:**
```bash
bash scripts/release.sh patch   # 1.0.0 -> 1.0.1 (bug fixes)
bash scripts/release.sh minor   # 1.0.0 -> 1.1.0 (new features)
bash scripts/release.sh major   # 1.0.0 -> 2.0.0 (breaking changes)
bash scripts/release.sh auto    # Auto-detect from commits
```

**Release Options:**
```bash
DRY_RUN=true          # Test without making changes
SKIP_TESTS=true       # Skip test execution
SKIP_BUILD=true       # Skip build step
SKIP_PUBLISH=true     # Skip npm publish
SKIP_GIT=true         # Skip git operations
```

### 5. Version File (`src/version.ts`)

Single source of truth for version information in code.

**Contents:**
```typescript
export const VERSION = '1.0.3';

export const BUILD_INFO = {
  version: VERSION,
  buildDate: '2025-01-15T10:30:00Z',
  gitCommit: 'abc1234def5678...',
  gitBranch: 'main',
} as const;

export function getVersionString(): string;
export function getFullVersionInfo(): typeof BUILD_INFO;
```

**Usage in Code:**
```typescript
import { VERSION, BUILD_INFO, getVersionString } from './version';

console.log(`Version: ${VERSION}`);
console.log(`Build: ${getVersionString()}`);
console.log(`Full info:`, BUILD_INFO);
```

### 6. Makefile

Unified interface for all build and release operations.

**Categories:**
- **Development**: `make dev`, `make chat`, `make alexa-server`
- **Build**: `make build`, `make build-dev`, `make build-clean`
- **Testing**: `make test`, `make test-coverage`, `make test-unit`
- **Quality**: `make lint`, `make format`, `make typecheck`, `make quality`
- **Version**: `make version-current`, `make version-status`, `make version-sync`
- **Release**: `make release-patch`, `make release-minor`, `make release-major`
- **Cleanup**: `make clean`, `make clean-all`
- **Setup**: `make setup`, `make pre-commit`

### 7. Conventional Commits Integration

Version bumps are determined from commit messages:

**Commit Types:**
- `fix:` → **PATCH** version bump (1.0.0 → 1.0.1)
- `feat:` → **MINOR** version bump (1.0.0 → 1.1.0)
- `BREAKING CHANGE:` or `!:` → **MAJOR** version bump (1.0.0 → 2.0.0)

**Examples:**
```bash
# Patch bump
git commit -m "fix(auth): resolve token refresh issue"

# Minor bump
git commit -m "feat(devices): add thermostat support"

# Major bump
git commit -m "feat(api)!: redesign device control interface"

# Major bump (alternative)
git commit -m "feat(api): redesign interface

BREAKING CHANGE: Device control API has been redesigned"
```

### 8. Changelog Generation

Automated changelog generation using `standard-version`.

**Configuration:** `.versionrc.json`
```json
{
  "types": [
    {"type": "feat", "section": "Features"},
    {"type": "fix", "section": "Bug Fixes"},
    {"type": "docs", "section": "Documentation"},
    {"type": "refactor", "section": "Code Refactoring"},
    {"type": "perf", "section": "Performance Improvements"}
  ]
}
```

**Generated CHANGELOG.md:**
```markdown
# Changelog

## [1.1.0](https://github.com/.../compare/v1.0.0...v1.1.0) (2025-01-15)

### Features

* add thermostat support ([abc1234](https://github.com/.../commit/abc1234))

### Bug Fixes

* resolve token refresh issue ([def5678](https://github.com/.../commit/def5678))
```

### 9. CI/CD Workflows

#### CI Workflow (`.github/workflows/ci.yml`)

**Triggers:** Push and pull requests

**Jobs:**
1. **Test** (Node.js 18.x and 20.x)
   - Install dependencies
   - Type check
   - Lint
   - Run tests
   - Upload coverage

2. **Build**
   - Build project
   - Verify artifacts
   - Upload build artifacts

3. **Quality**
   - Check formatting
   - Lint check

#### Release Workflow (`.github/workflows/release.yml`)

**Triggers:** Version tags (`v*.*.*`)

**Jobs:**
1. **Release**
   - Install dependencies
   - Run tests
   - Build project
   - Verify version matches tag
   - Publish to npm with provenance
   - Create GitHub release

2. **Verify Release**
   - Wait for npm registry
   - Verify package published

## Workflow Examples

### Example 1: Creating a Patch Release

**Scenario:** Fixed a bug, need to release version 1.0.4

```bash
# 1. Make your fix
git add .
git commit -m "fix(auth): resolve token expiration bug"

# 2. Check suggested version bump
make version-status
# Output: Suggested bump: patch

# 3. Create release
make release-patch

# Done! Version 1.0.4 is built, tagged, and published
```

### Example 2: Creating a Minor Release

**Scenario:** Added new feature, need to release version 1.1.0

```bash
# 1. Implement feature
git add .
git commit -m "feat(devices): add support for door locks"

# 2. Check suggested version bump
make version-status
# Output: Suggested bump: minor

# 3. Create release (auto-detect)
make release-auto

# Done! Version 1.1.0 is released
```

### Example 3: Creating a Major Release

**Scenario:** Breaking API change, need to release version 2.0.0

```bash
# 1. Make breaking changes
git add .
git commit -m "feat(api)!: redesign device control interface

BREAKING CHANGE: Device control API has been completely redesigned"

# 2. Check suggested version bump
make version-status
# Output: Suggested bump: major

# 3. Test release first
make release-dry-run

# 4. Create release
make release-major

# Done! Version 2.0.0 is released
```

### Example 4: Manual Build and Test

**Scenario:** Testing before release

```bash
# 1. Check current state
make version-status

# 2. Run quality checks
make quality

# 3. Build
make build

# 4. Verify build
make build-verify

# 5. Check build history
make build-history

# 6. If everything looks good, release
make release-auto
```

## File Structure

```
mcp-smartthings/
├── .build/                      # Build tracking (gitignored)
│   ├── build_number             # Current build number
│   ├── build_history.log        # Build history
│   └── latest_build.json        # Latest build metadata
├── .github/
│   └── workflows/
│       ├── ci.yml               # CI workflow
│       └── release.yml          # Release workflow
├── scripts/
│   ├── build.sh                 # Build automation
│   ├── version.sh               # Version management
│   ├── release.sh               # Release automation
│   └── build-tracker.sh         # Build tracking
├── src/
│   └── version.ts               # Version constant
├── .versionrc.json              # Changelog configuration
├── CHANGELOG.md                 # Generated changelog
├── Makefile                     # Unified command interface
└── package.json                 # Version source of truth
```

## Integration with package.json

**Package.json Scripts:**
```json
{
  "scripts": {
    "build": "bash scripts/build.sh",
    "build:dev": "SKIP_VALIDATION=true SKIP_TESTS=true bash scripts/build.sh",
    "version:current": "bash scripts/version.sh current",
    "version:status": "bash scripts/version.sh status",
    "version:sync": "bash scripts/version.sh sync",
    "release": "standard-version",
    "release:patch": "standard-version --release-as patch",
    "release:minor": "standard-version --release-as minor",
    "release:major": "standard-version --release-as major",
    "release:auto": "bash scripts/release.sh auto",
    "release:full:patch": "bash scripts/release.sh patch",
    "release:full:minor": "bash scripts/release.sh minor",
    "release:full:major": "bash scripts/release.sh major",
    "release:dry-run": "DRY_RUN=true bash scripts/release.sh patch"
  }
}
```

## Best Practices

1. **Use Conventional Commits** - Enables automatic version detection
2. **Run Dry Run First** - Test releases with `make release-dry-run`
3. **Check Version Status** - Use `make version-status` before releasing
4. **Keep Working Directory Clean** - Commit changes before release
5. **Release from Main** - Always release from main/master branch
6. **Use Quality Checks** - Run `make quality` regularly
7. **Review Changelog** - Check generated changelog before release
8. **Test Locally First** - Use `make verify` before releasing
9. **Use Auto-Detection** - Let the system detect version bump with `make release-auto`
10. **Track Builds** - Monitor build history with `make build-history`

## Troubleshooting

### Version Mismatch Between Files

```bash
make version-sync
```

### Build Fails on Pre-validation

```bash
# Skip validation temporarily
SKIP_VALIDATION=true bash scripts/build.sh

# Or fix issues
make lint-fix
make format
```

### Release Fails

```bash
# Test with dry run
make release-dry-run

# Check git status
git status

# Ensure tests pass
make test
```

### Build Number Reset

```bash
# Reinitialize build tracking
bash scripts/build-tracker.sh init
```

## Resources

- [BUILD_AND_RELEASE.md](./BUILD_AND_RELEASE.md) - Build and release guide
- [RELEASE_GUIDE.md](./RELEASE_GUIDE.md) - Detailed release guide
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contributing guidelines
- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [standard-version](https://github.com/conventional-changelog/standard-version)
