#!/bin/bash
# Build tracking script for mcp-smarterthings
# Tracks build numbers, metadata, and history

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

# Build tracking file
BUILD_TRACKING_DIR="$PROJECT_ROOT/.build"
BUILD_NUMBER_FILE="$BUILD_TRACKING_DIR/build_number"
BUILD_HISTORY_FILE="$BUILD_TRACKING_DIR/build_history.log"
BUILD_METADATA_FILE="$BUILD_TRACKING_DIR/latest_build.json"

# Logging functions
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Initialize build tracking
init_tracking() {
  mkdir -p "$BUILD_TRACKING_DIR"

  if [ ! -f "$BUILD_NUMBER_FILE" ]; then
    echo "0" > "$BUILD_NUMBER_FILE"
    log_info "Build tracking initialized (build #0)"
  fi

  if [ ! -f "$BUILD_HISTORY_FILE" ]; then
    echo "# Build History" > "$BUILD_HISTORY_FILE"
    echo "# Format: Build# | Timestamp | Version | Commit | Branch | Status" >> "$BUILD_HISTORY_FILE"
    echo "---" >> "$BUILD_HISTORY_FILE"
  fi
}

# Get current build number
get_build_number() {
  init_tracking
  cat "$BUILD_NUMBER_FILE"
}

# Increment build number
increment_build_number() {
  init_tracking
  local current=$(cat "$BUILD_NUMBER_FILE")
  local next=$((current + 1))
  echo "$next" > "$BUILD_NUMBER_FILE"
  echo "$next"
}

# Record build metadata
record_build() {
  init_tracking

  local build_number=$(increment_build_number)
  local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  local version=$(cd "$PROJECT_ROOT" && node -p "require('./package.json').version" 2>/dev/null || echo "unknown")
  local commit=$(git -C "$PROJECT_ROOT" rev-parse HEAD 2>/dev/null || echo "unknown")
  local branch=$(git -C "$PROJECT_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
  local status="success"

  # Create JSON metadata
  cat > "$BUILD_METADATA_FILE" << EOF
{
  "buildNumber": $build_number,
  "timestamp": "$timestamp",
  "version": "$version",
  "gitCommit": "$commit",
  "gitBranch": "$branch",
  "status": "$status"
}
EOF

  # Append to build history
  echo "$build_number | $timestamp | $version | ${commit:0:7} | $branch | $status" >> "$BUILD_HISTORY_FILE"

  log_success "Build #$build_number recorded"
  echo ""
  echo "Build metadata:"
  echo "  - Build number: $build_number"
  echo "  - Version: $version"
  echo "  - Commit: ${commit:0:7}"
  echo "  - Branch: $branch"
  echo "  - Timestamp: $timestamp"
}

# Show build history
show_history() {
  init_tracking

  if [ ! -f "$BUILD_HISTORY_FILE" ]; then
    log_error "No build history found"
    exit 1
  fi

  echo ""
  echo "Build History:"
  echo "=============="
  tail -n 20 "$BUILD_HISTORY_FILE"
  echo ""
}

# Show latest build info
show_latest() {
  init_tracking

  if [ ! -f "$BUILD_METADATA_FILE" ]; then
    log_error "No build metadata found"
    exit 1
  fi

  echo ""
  echo "Latest Build:"
  echo "============="
  cat "$BUILD_METADATA_FILE"
  echo ""
}

# Clean build tracking (reset)
clean_tracking() {
  log_info "Cleaning build tracking data..."
  rm -rf "$BUILD_TRACKING_DIR"
  log_success "Build tracking data cleaned"
}

# Main command handler
case "${1:-}" in
  init)
    init_tracking
    ;;
  get)
    get_build_number
    ;;
  increment)
    increment_build_number
    ;;
  record)
    record_build
    ;;
  history)
    show_history
    ;;
  latest)
    show_latest
    ;;
  clean)
    clean_tracking
    ;;
  *)
    echo "Usage: $0 {init|get|increment|record|history|latest|clean}"
    echo ""
    echo "Commands:"
    echo "  init       - Initialize build tracking"
    echo "  get        - Get current build number"
    echo "  increment  - Increment build number"
    echo "  record     - Record a build (increments and saves metadata)"
    echo "  history    - Show recent build history"
    echo "  latest     - Show latest build metadata"
    echo "  clean      - Clean build tracking data"
    exit 1
    ;;
esac
