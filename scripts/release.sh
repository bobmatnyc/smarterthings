#!/bin/bash
# Release automation script for mcp-smartthings
# Handles complete release workflow: validation, version bump, build, tag, publish

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Logging functions
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration
DRY_RUN="${DRY_RUN:-false}"
SKIP_TESTS="${SKIP_TESTS:-false}"
SKIP_BUILD="${SKIP_BUILD:-false}"
SKIP_PUBLISH="${SKIP_PUBLISH:-false}"
SKIP_GIT="${SKIP_GIT:-false}"

# Parse command line arguments
RELEASE_TYPE="${1:-}"

if [ -z "$RELEASE_TYPE" ]; then
  log_error "Release type required"
  echo ""
  echo "Usage: $0 {patch|minor|major|auto} [OPTIONS]"
  echo ""
  echo "Release Types:"
  echo "  patch  - Bug fixes and minor changes (1.0.0 -> 1.0.1)"
  echo "  minor  - New features, backwards compatible (1.0.0 -> 1.1.0)"
  echo "  major  - Breaking changes (1.0.0 -> 2.0.0)"
  echo "  auto   - Automatically determine from commits"
  echo ""
  echo "Environment Variables:"
  echo "  DRY_RUN=true       - Show what would happen without making changes"
  echo "  SKIP_TESTS=true    - Skip test execution"
  echo "  SKIP_BUILD=true    - Skip build step"
  echo "  SKIP_PUBLISH=true  - Skip npm publish"
  echo "  SKIP_GIT=true      - Skip git operations (commit, tag, push)"
  echo ""
  echo "Examples:"
  echo "  $0 patch"
  echo "  DRY_RUN=true $0 minor"
  echo "  SKIP_PUBLISH=true $0 major"
  exit 1
fi

# Determine release type
if [ "$RELEASE_TYPE" = "auto" ]; then
  log_info "Auto-detecting release type from commits..."
  RELEASE_TYPE=$(bash "$SCRIPT_DIR/version.sh" analyze)
  log_info "Detected release type: $RELEASE_TYPE"
fi

# Validate release type
if [[ ! "$RELEASE_TYPE" =~ ^(patch|minor|major)$ ]]; then
  log_error "Invalid release type: $RELEASE_TYPE (must be patch, minor, or major)"
  exit 1
fi

log_info "Starting $RELEASE_TYPE release process..."

if [ "$DRY_RUN" = "true" ]; then
  log_warning "DRY RUN MODE - No changes will be made"
fi

# Step 1: Pre-release checks
log_info "Step 1: Pre-release checks..."

# Check git status
if [ "$SKIP_GIT" != "true" ]; then
  if [ -n "$(git status --porcelain)" ]; then
    log_error "Working directory is not clean. Commit or stash changes first."
    git status --short
    exit 1
  fi
  log_success "Working directory is clean"

  # Check current branch
  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
  if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
    log_warning "Not on main/master branch (current: $CURRENT_BRANCH)"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  fi

  # Ensure we're up to date
  log_info "Fetching latest changes..."
  git fetch origin
  log_success "Repository is up to date"
fi

# Run tests
if [ "$SKIP_TESTS" != "true" ]; then
  log_info "Running tests..."
  if [ "$DRY_RUN" != "true" ]; then
    pnpm test
  else
    log_info "DRY RUN: Would run tests"
  fi
  log_success "Tests passed"
else
  log_warning "Tests skipped"
fi

# Type checking
log_info "Running type check..."
if [ "$DRY_RUN" != "true" ]; then
  pnpm run typecheck
else
  log_info "DRY RUN: Would run type check"
fi
log_success "Type check passed"

# Linting
log_info "Running linter..."
if [ "$DRY_RUN" != "true" ]; then
  pnpm run lint
else
  log_info "DRY RUN: Would run linter"
fi
log_success "Linting passed"

# Step 2: Version bump using standard-version
log_info "Step 2: Version bump and changelog generation..."

CURRENT_VERSION=$(node -p "require('./package.json').version")
log_info "Current version: $CURRENT_VERSION"

if [ "$DRY_RUN" != "true" ]; then
  # Use standard-version for version bump and changelog
  pnpm run "release:$RELEASE_TYPE"

  NEW_VERSION=$(node -p "require('./package.json').version")
  log_success "Version bumped to: $NEW_VERSION"

  # Update version.ts
  bash "$SCRIPT_DIR/version.sh" sync
else
  log_info "DRY RUN: Would bump $RELEASE_TYPE version and update changelog"
  NEW_VERSION="$CURRENT_VERSION"
fi

# Step 3: Build
if [ "$SKIP_BUILD" != "true" ]; then
  log_info "Step 3: Building project..."
  if [ "$DRY_RUN" != "true" ]; then
    bash "$SCRIPT_DIR/build.sh"
  else
    log_info "DRY RUN: Would run build"
  fi
  log_success "Build completed"
else
  log_warning "Build skipped"
fi

# Step 4: Git tag (standard-version already creates the tag)
if [ "$SKIP_GIT" != "true" ]; then
  log_info "Step 4: Git operations..."
  if [ "$DRY_RUN" != "true" ]; then
    # standard-version already committed and tagged, just need to push
    log_info "Pushing changes and tags to origin..."
    git push --follow-tags origin "$CURRENT_BRANCH"
    log_success "Changes and tags pushed"
  else
    log_info "DRY RUN: Would push changes and tags"
  fi
else
  log_warning "Git operations skipped"
fi

# Step 5: Publish to npm
if [ "$SKIP_PUBLISH" != "true" ]; then
  log_info "Step 5: Publishing to npm..."

  # Check if logged in to npm
  if [ "$DRY_RUN" != "true" ]; then
    if ! npm whoami &>/dev/null; then
      log_error "Not logged in to npm. Run 'npm login' first."
      exit 1
    fi

    log_info "Publishing version $NEW_VERSION to npm..."
    npm publish --access public

    log_success "Published to npm successfully!"
  else
    log_info "DRY RUN: Would publish to npm"
  fi
else
  log_warning "npm publish skipped"
fi

# Step 6: Post-release verification
log_info "Step 6: Post-release verification..."

if [ "$DRY_RUN" != "true" ]; then
  # Verify git tag exists
  if [ "$SKIP_GIT" != "true" ]; then
    if git rev-parse "v$NEW_VERSION" >/dev/null 2>&1; then
      log_success "Git tag v$NEW_VERSION verified"
    else
      log_error "Git tag v$NEW_VERSION not found!"
    fi
  fi

  # Verify npm package
  if [ "$SKIP_PUBLISH" != "true" ]; then
    sleep 5  # Give npm registry time to update
    NPM_VERSION=$(npm view @bobmatnyc/mcp-smartthings version 2>/dev/null || echo "not found")
    if [ "$NPM_VERSION" = "$NEW_VERSION" ]; then
      log_success "npm package version verified: $NPM_VERSION"
    else
      log_warning "npm package version mismatch (expected: $NEW_VERSION, got: $NPM_VERSION)"
    fi
  fi
else
  log_info "DRY RUN: Would verify release"
fi

# Summary
echo ""
echo "======================================"
echo "Release Summary"
echo "======================================"
echo "Release type: $RELEASE_TYPE"
echo "Previous version: $CURRENT_VERSION"
echo "New version: $NEW_VERSION"
echo "Dry run: $DRY_RUN"
echo ""

if [ "$DRY_RUN" = "true" ]; then
  log_warning "This was a DRY RUN - no changes were made"
  echo ""
  echo "To perform the actual release, run:"
  echo "  $0 $RELEASE_TYPE"
else
  log_success "Release completed successfully!"
  echo ""
  echo "Next steps:"
  echo "  1. Verify release on GitHub: https://github.com/bobmatnyc/mcp-smartthings/releases"
  echo "  2. Verify npm package: https://www.npmjs.com/package/@bobmatnyc/mcp-smartthings"
  echo "  3. Update documentation if needed"
  echo "  4. Announce the release"
fi

echo ""
