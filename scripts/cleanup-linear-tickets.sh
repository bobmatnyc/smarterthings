#!/bin/bash

# Linear Cleanup Script
# Cancels test pollution and duplicate tracking tickets

set -e

# LINEAR_API_KEY should be set in environment
if [ -z "$LINEAR_API_KEY" ]; then
  echo "Error: LINEAR_API_KEY environment variable is not set"
  exit 1
fi

echo "=================================="
echo "Linear Ticket Cleanup - Phase 1"
echo "Archiving WORKER TRACE TEST tickets"
echo "=================================="

# Track results
SUCCESS_COUNT=0
FAILED_COUNT=0
FAILED_TICKETS=()

# Phase 1: Archive WORKER TRACE TEST tickets (14 tickets)
WORKER_TRACE_TICKETS=(
  "1M-610"
  "1M-611"
  "1M-612"
  "1M-613"
  "1M-614"
  "1M-615"
  "1M-616"
  "1M-617"
  "1M-618"
  "1M-619"
  "1M-620"
  "1M-488"
  "1M-466"
  "1M-467"
)

for ticket in "${WORKER_TRACE_TICKETS[@]}"; do
  echo ""
  echo "Processing $ticket..."

  # First add a comment
  if mcp-ticketer ticket comment "$ticket" --adapter linear --text "Archived as test pollution - cleanup operation 2025-12-04" 2>&1; then
    echo "✅ Added comment to $ticket"
  else
    echo "⚠️  Failed to add comment to $ticket (continuing...)"
  fi

  # Then transition to Canceled state
  if mcp-ticketer ticket transition "$ticket" --state closed --adapter linear 2>&1; then
    echo "✅ Canceled $ticket"
    ((SUCCESS_COUNT++))
  else
    echo "❌ Failed to cancel $ticket"
    ((FAILED_COUNT++))
    FAILED_TICKETS+=("$ticket")
  fi
done

echo ""
echo "=================================="
echo "Linear Ticket Cleanup - Phase 2"
echo "Closing duplicate Track: tickets"
echo "=================================="

# Phase 2: Close duplicate Track: tickets (6 tickets)
TRACK_TICKETS=(
  "1M-573"
  "1M-574"
  "1M-575"
  "1M-576"
  "1M-577"
  "1M-578"
)

for ticket in "${TRACK_TICKETS[@]}"; do
  echo ""
  echo "Processing $ticket..."

  # First add a comment
  if mcp-ticketer ticket comment "$ticket" --adapter linear --text "Closed as duplicate tracking ticket - cleanup operation 2025-12-04" 2>&1; then
    echo "✅ Added comment to $ticket"
  else
    echo "⚠️  Failed to add comment to $ticket (continuing...)"
  fi

  # Then transition to Canceled state
  if mcp-ticketer ticket transition "$ticket" --state closed --adapter linear 2>&1; then
    echo "✅ Canceled $ticket"
    ((SUCCESS_COUNT++))
  else
    echo "❌ Failed to cancel $ticket"
    ((FAILED_COUNT++))
    FAILED_TICKETS+=("$ticket")
  fi
done

echo ""
echo "=================================="
echo "Cleanup Summary"
echo "=================================="
echo "✅ Successfully processed: $SUCCESS_COUNT tickets"
echo "❌ Failed: $FAILED_COUNT tickets"

if [ ${#FAILED_TICKETS[@]} -gt 0 ]; then
  echo ""
  echo "Failed tickets:"
  for ticket in "${FAILED_TICKETS[@]}"; do
    echo "  - $ticket"
  done
fi

echo ""
echo "✅ Cleanup operation complete!"
