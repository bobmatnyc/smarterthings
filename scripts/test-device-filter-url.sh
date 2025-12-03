#!/bin/bash

###############################################################################
# Device Filter URL Persistence - Quick Verification Script
# Ticket: 1M-533
#
# This script helps verify the URL persistence feature works correctly.
# It opens multiple browser tabs with different filter combinations.
###############################################################################

set -e

BASE_URL="http://localhost:5181/devices"

echo "🧪 Device Filter URL Persistence - Quick Test"
echo "=============================================="
echo ""
echo "This script will open several browser tabs to test URL persistence."
echo "Prerequisites:"
echo "  - Frontend running on http://localhost:5181"
echo "  - Modern browser (Chrome, Firefox, Safari, or Edge)"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."
echo ""

# Detect OS for browser command
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  BROWSER="open"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  # Linux
  BROWSER="xdg-open"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
  # Windows (Git Bash or WSL)
  BROWSER="start"
else
  echo "❌ Unknown OS. Please open URLs manually."
  exit 1
fi

echo "Opening test URLs..."
echo ""

# Test 1: Room filter
echo "1️⃣  Testing: Room filter (Master Bedroom)"
$BROWSER "${BASE_URL}?room=Master+Bedroom"
sleep 1

# Test 2: Type filter
echo "2️⃣  Testing: Type filter (switch)"
$BROWSER "${BASE_URL}?type=switch"
sleep 1

# Test 3: Manufacturer filter
echo "3️⃣  Testing: Manufacturer filter (Brilliant)"
$BROWSER "${BASE_URL}?manufacturer=Brilliant"
sleep 1

# Test 4: Search query
echo "4️⃣  Testing: Search query (light)"
$BROWSER "${BASE_URL}?search=light"
sleep 1

# Test 5: Combined filters
echo "5️⃣  Testing: Combined filters (Kitchen + switch + ceiling)"
$BROWSER "${BASE_URL}?room=Kitchen&type=switch&search=ceiling"
sleep 1

echo ""
echo "✅ Test URLs opened!"
echo ""
echo "Manual Verification Steps:"
echo "=========================="
echo ""
echo "For each tab, verify:"
echo "  ✓ Filter UI reflects URL parameters (dropdowns selected, search filled)"
echo "  ✓ Device list shows filtered results"
echo "  ✓ Changing filters updates URL"
echo "  ✓ Refreshing page (F5) preserves filters"
echo "  ✓ 'Clear Filters' button removes URL parameters"
echo ""
echo "Advanced Tests:"
echo "  ✓ Bookmark a filtered view → close tab → open bookmark"
echo "  ✓ Share URL with colleague (copy URL, paste in new incognito tab)"
echo "  ✓ Navigate away, then use browser back button"
echo ""
echo "Expected Behavior:"
echo "  - URL updates immediately for dropdowns"
echo "  - URL updates after 300ms for search input (debounced)"
echo "  - No page reload when changing filters"
echo "  - SSE 'Live' indicator stays connected"
echo ""
echo "📋 Full QA checklist: docs/qa/DEVICE-FILTER-URL-PERSISTENCE-TEST.md"
echo "🧪 Run automated tests: pnpm test:e2e tests/e2e/device-filter-url-persistence.spec.ts"
echo ""
