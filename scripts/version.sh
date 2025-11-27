#!/bin/bash
# Version management script for mcp-smartthings
# Handles semantic versioning with conventional commits integration

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

# Get current version from package.json
get_current_version() {
  node -p "require('./package.json').version"
}

# Parse version components
parse_version() {
  local version=$1
  echo "$version" | sed -E 's/([0-9]+)\.([0-9]+)\.([0-9]+).*/\1 \2 \3/'
}

# Bump version
bump_version() {
  local bump_type=$1
  local current_version=$(get_current_version)

  log_info "Current version: $current_version"
  log_info "Bump type: $bump_type"

  # Use npm version to bump (it handles package.json and package-lock.json)
  local new_version=$(npm version "$bump_type" --no-git-tag-version 2>&1 | grep -v "npm notice" | tail -1)
  new_version="${new_version#v}"  # Remove leading 'v' if present

  log_success "Version bumped to: $new_version"
  echo "$new_version"
}

# Update version in version.ts
update_version_file() {
  local version=$1

  if [ ! -f "src/version.ts" ]; then
    log_warning "src/version.ts not found, creating it..."
  fi

  cat > src/version.ts << EOF
/**
 * Version information for mcp-smartthings
 * This file is automatically updated during the release process
 */

// Version is synchronized with package.json during release
export const VERSION = '$version';

// Build metadata (updated by build scripts)
export const BUILD_INFO = {
  version: VERSION,
  buildDate: new Date().toISOString(),
  gitCommit: process.env.GIT_COMMIT || 'unknown',
  gitBranch: process.env.GIT_BRANCH || 'unknown',
} as const;

/**
 * Get formatted version string with build info
 */
export function getVersionString(): string {
  return \`\${VERSION} (\${BUILD_INFO.gitCommit.substring(0, 7)})\`;
}

/**
 * Get full version information
 */
export function getFullVersionInfo(): typeof BUILD_INFO {
  return BUILD_INFO;
}
EOF

  log_success "Updated src/version.ts to version $version"
}

# Analyze commits since last tag to suggest version bump
analyze_commits() {
  local last_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

  if [ -z "$last_tag" ]; then
    log_warning "No previous tags found, showing all commits"
    local commits=$(git log --pretty=format:"%s" --no-merges)
  else
    log_info "Analyzing commits since $last_tag..."
    local commits=$(git log --pretty=format:"%s" "$last_tag"..HEAD --no-merges)
  fi

  if [ -z "$commits" ]; then
    log_warning "No commits found since last tag"
    echo "none"
    return
  fi

  # Check for breaking changes (major)
  if echo "$commits" | grep -qE "^[a-z]+(\([a-z]+\))?!:|BREAKING CHANGE:"; then
    echo "major"
    return
  fi

  # Check for features (minor)
  if echo "$commits" | grep -qE "^feat(\([a-z]+\))?:"; then
    echo "minor"
    return
  fi

  # Check for fixes (patch)
  if echo "$commits" | grep -qE "^fix(\([a-z]+\))?:"; then
    echo "patch"
    return
  fi

  # Default to patch if there are commits but no conventional format
  echo "patch"
}

# Validate version format
validate_version() {
  local version=$1

  if ! echo "$version" | grep -qE "^[0-9]+\.[0-9]+\.[0-9]+$"; then
    log_error "Invalid version format: $version (expected: MAJOR.MINOR.PATCH)"
    exit 1
  fi
}

# Set specific version
set_version() {
  local version=$1

  validate_version "$version"

  log_info "Setting version to: $version"

  # Update package.json
  npm version "$version" --no-git-tag-version --allow-same-version

  # Update version.ts
  update_version_file "$version"

  log_success "Version set to: $version"
}

# Show current version and status
show_status() {
  local current_version=$(get_current_version)
  local last_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "none")
  local suggested_bump=$(analyze_commits)

  echo ""
  echo "Version Status:"
  echo "==============="
  echo "Current version: $current_version"
  echo "Last git tag: $last_tag"
  echo "Suggested bump: $suggested_bump"
  echo ""

  if [ "$suggested_bump" != "none" ]; then
    log_info "Suggested next version based on commits: $suggested_bump"
    echo ""
    echo "Recent commits:"
    if [ "$last_tag" != "none" ]; then
      git log --pretty=format:"  - %s" "$last_tag"..HEAD --no-merges | head -10
    else
      git log --pretty=format:"  - %s" --no-merges | head -10
    fi
    echo ""
  fi
}

# Sync version across all files
sync_version() {
  local version=$(get_current_version)

  log_info "Synchronizing version $version across all files..."

  # Update version.ts
  update_version_file "$version"

  # Ensure package-lock.json is in sync
  if [ -f "package-lock.json" ]; then
    npm install --package-lock-only
    log_success "package-lock.json synchronized"
  fi

  log_success "Version synchronized across all files"
}

# Main command handler
case "${1:-}" in
  current)
    get_current_version
    ;;
  status)
    show_status
    ;;
  bump)
    bump_type="${2:-patch}"
    new_version=$(bump_version "$bump_type")
    update_version_file "$new_version"
    log_info "Don't forget to commit and tag: git commit -am 'chore(release): $new_version' && git tag v$new_version"
    ;;
  set)
    if [ -z "${2:-}" ]; then
      log_error "Version argument required"
      echo "Usage: $0 set VERSION"
      exit 1
    fi
    set_version "$2"
    ;;
  sync)
    sync_version
    ;;
  analyze)
    suggested=$(analyze_commits)
    echo "$suggested"
    ;;
  *)
    echo "Version Management Script"
    echo "========================="
    echo ""
    echo "Usage: $0 COMMAND [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  current          - Show current version"
    echo "  status           - Show version status and suggested bump"
    echo "  bump [TYPE]      - Bump version (patch|minor|major)"
    echo "  set VERSION      - Set specific version (e.g., 1.2.3)"
    echo "  sync             - Sync version across all files"
    echo "  analyze          - Analyze commits and suggest version bump"
    echo ""
    echo "Examples:"
    echo "  $0 status"
    echo "  $0 bump patch"
    echo "  $0 bump minor"
    echo "  $0 set 2.0.0"
    echo "  $0 sync"
    exit 1
    ;;
esac
