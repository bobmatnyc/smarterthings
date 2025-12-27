# Squarified Treemap Dashboard Implementation

**Date**: 2025-12-23
**Feature**: Mondrian Kiosk Dashboard with Squarified Treemap Layout
**Status**: ✅ Implemented

## Summary

Implemented a squarified treemap algorithm for the Mondrian Dashboard, sizing rooms proportionally to their device count with optimized aspect ratios for square-like tiles.

## Algorithm

**Squarified Treemap (Bruls, Huizing, van Wijk, 2000)**

The algorithm minimizes the maximum aspect ratio of all rectangles, creating more square-shaped (less elongated) rectangles.

### Core Principles

1. **Sort items by value (descending)**: Larger rooms get laid out first
2. **Greedy optimization**: Each row is built to minimize worst aspect ratio
3. **Aspect ratio metric**: `max(width/height, height/width)` - closer to 1 is better
4. **Recursive subdivision**: Container space is progressively divided

### Key Functions

```typescript
computeTreemap(items, width, height): TreemapRect[]
- Main entry point
- Normalizes values to container area
- Calls squarify() recursively

squarify(items, currentRow, container, result)
- Recursive algorithm
- Decides when to complete a row vs. add more items
- Optimizes for aspect ratios

worstAspectRatio(row, container): number
- Calculates worst aspect ratio in a row
- Used to decide row completion

layoutRow(row, container, result): LayoutState
- Positions rectangles in current row
- Returns remaining container space

applyGap(rectangles, gap): TreemapRect[]
- Applies Mondrian-style gaps between tiles
- Ensures black borders between rooms
```

## Implementation Files

### 1. Treemap Algorithm (`web/src/lib/utils/treemap.ts`)

**Exports**:
- `computeTreemap()` - Main algorithm
- `applyGap()` - Gap application utility
- Types: `TreemapItem`, `TreemapRect`

**Features**:
- Handles edge cases (empty arrays, zero values, invalid dimensions)
- Preserves metadata through layout process
- Filters out zero/negative values
- Validates inputs thoroughly

### 2. MondrianGrid Component (`web/src/lib/components/dashboard/MondrianGrid.svelte`)

**Key Changes**:
- Added `ResizeObserver` to track container dimensions
- Reactive `$derived` for treemap layout recalculation
- Absolute positioning for tiles (instead of CSS Grid)
- Black background for Mondrian-style gaps

**Props**:
- `rooms: Room[]` - All rooms
- `devices: UnifiedDevice[]` - All devices
- `hiddenRooms: string[]` - Rooms to hide

**State**:
- `containerElement` - Bound to container div
- `containerWidth` - Tracked via ResizeObserver
- `containerHeight` - Tracked via ResizeObserver
- `roomTiles` - Derived room data with device counts
- `treemapLayout` - Derived treemap rectangles

### 3. RoomTile Component (`web/src/lib/components/dashboard/RoomTile.svelte`)

**Key Changes**:
- Made clickable (navigates to `/rooms?room={roomName}`)
- Mondrian-inspired color palette
- Bold uppercase room names
- Black square device count badge
- Hover effects (scale, shadow)
- Limits displayed devices to 8 (shows "+N more")

**Props**:
- `room: Room` - Room data
- `devices: UnifiedDevice[]` - Devices in room
- `deviceCount?: number` - Optional override

**Styling**:
- Mondrian colors: `#FEFEFE`, `#FFE8E8`, `#E8F0FF`, `#FFFBE8`, etc.
- Bold black borders (`2px solid rgba(0, 0, 0, 0.8)`)
- Square badges (no border-radius)
- Uppercase room names with letter spacing
- Pointer cursor and opacity transitions

## Visual Design

### Mondrian Aesthetic

1. **Colors**: Subtle pastel versions of Mondrian's primary colors
   - White: `#FEFEFE`
   - Light Red: `#FFE8E8`
   - Light Blue: `#E8F0FF`
   - Light Yellow: `#FFFBE8`

2. **Borders**: Bold black (`#000`) at 3px width

3. **Typography**:
   - Uppercase room names
   - Bold weights (700)
   - Sans-serif fonts (Arial, Helvetica)
   - Increased letter spacing

4. **Layout**: Squarified rectangles with proportional sizing

### Interaction

- **Hover**: Scale up (1.02x), add shadow
- **Click**: Navigate to `/rooms?room={roomName}`
- **Active**: Reduced opacity (0.8)

## Responsive Behavior

- **Desktop (>1024px)**: Full treemap layout
- **Tablet/Mobile (<1024px)**: Treemap still works but tiles may be smaller
- **Container tracking**: ResizeObserver ensures layout adapts to window resize

## Performance Considerations

### Optimizations

1. **Reactive Recalculation**: Only recomputes when `rooms`, `devices`, or container size changes
2. **Svelte 5 Runes**: `$derived.by()` for efficient memoization
3. **Absolute Positioning**: No CSS Grid recalculation overhead
4. **Device Limiting**: Show max 8 devices per tile to prevent overcrowding

### Computational Complexity

- **Time**: O(n log n) for sorting + O(n) for layout = O(n log n)
- **Space**: O(n) for rectangles array

For typical home (10-20 rooms), this is negligible (<1ms).

## Testing

### Unit Tests

Created `treemap.test.ts` with test cases:
- Empty arrays
- Single item (fills container)
- Two items (proportional division)
- Multiple items (aspect ratio optimization)
- Zero/negative values (filtered out)
- Invalid dimensions (returns empty)
- No overlapping rectangles
- Metadata preservation

### Visual Test

Created `treemap-visual-test.html` for manual verification:
- Renders sample room data
- Shows clickable tiles with Mondrian colors
- Displays device counts
- Interactive (click to see room details)

**To view**: Open `web/src/lib/utils/treemap-visual-test.html` in browser

## Example Layout

For rooms with device counts `[24, 18, 12, 8, 6, 4]`:

```
┌─────────────────┬─────────────────┐
│                 │                 │
│   Living Room   │    Bedroom      │
│      (24)       │      (18)       │
│                 │                 │
├─────────┬───────┼─────────────────┤
│         │       │                 │
│ Kitchen │ Bath  │     Office      │
│  (12)   │  (8)  │      (6)        │
├─────────┴───────┼─────────────────┤
│    Garage (4)   │                 │
└─────────────────┴─────────────────┘
```

## Acceptance Criteria

✅ **Rooms laid out using squarified treemap algorithm**
- Algorithm implemented in `treemap.ts`
- Properly optimizes for aspect ratios
- Handles edge cases gracefully

✅ **Larger device counts = larger tiles**
- Proportional sizing based on `deviceCount`
- Visible size difference between rooms

✅ **All rooms clickable with visual feedback**
- Navigate to `/rooms?room={roomName}`
- Hover effects (scale, shadow)
- Active state feedback

✅ **Responsive layout (recalculates on window resize)**
- ResizeObserver tracks container dimensions
- Reactive `$derived` recomputes layout
- Smooth adaptation to size changes

✅ **Proper TypeScript types**
- `TreemapItem` interface
- `TreemapRect` interface
- Full type safety throughout

## Code Quality Metrics

### LOC Delta
- **Added**: ~450 lines
  - `treemap.ts`: 250 lines (algorithm + docs)
  - `MondrianGrid.svelte`: +50 lines (ResizeObserver, treemap integration)
  - `RoomTile.svelte`: +50 lines (clickability, Mondrian styling)
  - `treemap.test.ts`: 100 lines (tests)
- **Removed**: ~80 lines
  - Old CSS Grid logic in `MondrianGrid.svelte`
  - Simplified room sizing calculation
- **Net**: +370 lines

### Type Safety
- 100% TypeScript coverage
- Explicit interfaces for all data structures
- No `any` types in algorithm

### Testing
- 10+ unit test cases
- Visual test HTML for manual verification
- Edge case coverage (empty, invalid, zero values)

## Future Enhancements

1. **Color Customization**: User-configurable color palette
2. **Animation**: Smooth transitions on layout changes
3. **Zoom/Pan**: Ability to focus on specific rooms
4. **Density Control**: Adjust gap size dynamically
5. **Custom Sizing Weights**: Option to weight by factors other than device count

## References

- **Paper**: "Squarified Treemaps" by Bruls, Huizing, and van Wijk (2000)
- **Link**: https://www.win.tue.nl/~vanwijk/stm.pdf
- **Piet Mondrian**: Dutch painter known for geometric abstract art with primary colors

## Deployment Notes

- No breaking changes to existing dashboard
- Works with current `roomStore` and `deviceStore`
- Compatible with kiosk mode and config modal
- No new dependencies added
