/**
 * Squarified Treemap Algorithm
 *
 * Based on "Squarified Treemaps" by Bruls, Huizing, and van Wijk (2000)
 * https://www.win.tue.nl/~vanwijk/stm.pdf
 *
 * Algorithm Summary:
 * 1. Sort items by value (descending)
 * 2. Greedily optimize for aspect ratios closest to 1 (squarest rectangles)
 * 3. Fill container with rectangles proportional to values
 *
 * The algorithm minimizes the maximum aspect ratio of all rectangles,
 * resulting in more square-shaped (less elongated) rectangles.
 */

export interface TreemapItem {
	id: string;
	value: number; // Must be > 0
	label: string;
	metadata?: any; // Optional user data
}

export interface TreemapRect {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	value: number;
	label: string;
	metadata?: any;
}

interface LayoutState {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Compute squarified treemap layout
 *
 * @param items - Items to layout (must have positive values)
 * @param containerWidth - Container width in pixels
 * @param containerHeight - Container height in pixels
 * @returns Array of positioned rectangles
 */
export function computeTreemap(
	items: TreemapItem[],
	containerWidth: number,
	containerHeight: number
): TreemapRect[] {
	// Validate inputs
	if (containerWidth <= 0 || containerHeight <= 0) {
		console.warn('[Treemap] Invalid container dimensions');
		return [];
	}

	if (items.length === 0) {
		return [];
	}

	// Filter out zero/negative values and sort descending
	const validItems = items
		.filter(item => item.value > 0)
		.sort((a, b) => b.value - a.value);

	if (validItems.length === 0) {
		console.warn('[Treemap] No items with positive values');
		return [];
	}

	// Calculate total value for normalization
	const totalValue = validItems.reduce((sum, item) => sum + item.value, 0);

	// Normalize values to container area
	const containerArea = containerWidth * containerHeight;
	const normalizedItems = validItems.map(item => ({
		...item,
		normalizedValue: (item.value / totalValue) * containerArea
	}));

	// Initialize layout state
	const layoutState: LayoutState = {
		x: 0,
		y: 0,
		width: containerWidth,
		height: containerHeight
	};

	// Compute rectangles using squarified algorithm
	const rectangles: TreemapRect[] = [];
	squarify(normalizedItems, [], layoutState, rectangles);

	return rectangles;
}

/**
 * Recursive squarified treemap algorithm
 *
 * @param items - Remaining items to layout
 * @param currentRow - Items currently being laid out in a row
 * @param container - Current container bounds
 * @param result - Accumulated rectangles
 */
function squarify(
	items: Array<TreemapItem & { normalizedValue: number }>,
	currentRow: Array<TreemapItem & { normalizedValue: number }>,
	container: LayoutState,
	result: TreemapRect[]
): void {
	if (items.length === 0) {
		// Lay out remaining row
		if (currentRow.length > 0) {
			layoutRow(currentRow, container, result);
		}
		return;
	}

	// Take next item
	const [nextItem, ...remainingItems] = items;

	// Try adding item to current row
	const proposedRow = [...currentRow, nextItem];

	if (currentRow.length === 0) {
		// First item in row - always accept
		squarify(remainingItems, proposedRow, container, result);
	} else {
		// Check if adding item improves aspect ratio
		const currentWorst = worstAspectRatio(currentRow, container);
		const proposedWorst = worstAspectRatio(proposedRow, container);

		if (proposedWorst <= currentWorst) {
			// Adding item improves or maintains aspect ratio - accept
			squarify(remainingItems, proposedRow, container, result);
		} else {
			// Adding item worsens aspect ratio - lay out current row and start new one
			const newContainer = layoutRow(currentRow, container, result);
			squarify(items, [], newContainer, result);
		}
	}
}

/**
 * Calculate worst (maximum) aspect ratio in a row
 *
 * @param row - Items in current row
 * @param container - Container bounds
 * @returns Worst aspect ratio
 */
function worstAspectRatio(
	row: Array<TreemapItem & { normalizedValue: number }>,
	container: LayoutState
): number {
	if (row.length === 0) {
		return Infinity;
	}

	const totalValue = row.reduce((sum, item) => sum + item.normalizedValue, 0);
	const shortEdge = Math.min(container.width, container.height);

	if (shortEdge === 0 || totalValue === 0) {
		return Infinity;
	}

	const rowHeight = totalValue / shortEdge;

	let maxAspectRatio = 0;

	for (const item of row) {
		const rectWidth = item.normalizedValue / rowHeight;
		const aspectRatio = Math.max(rectWidth / rowHeight, rowHeight / rectWidth);
		maxAspectRatio = Math.max(maxAspectRatio, aspectRatio);
	}

	return maxAspectRatio;
}

/**
 * Layout a row of items and update container
 *
 * @param row - Items to layout
 * @param container - Current container bounds
 * @param result - Accumulated rectangles
 * @returns Updated container for remaining items
 */
function layoutRow(
	row: Array<TreemapItem & { normalizedValue: number }>,
	container: LayoutState,
	result: TreemapRect[]
): LayoutState {
	if (row.length === 0) {
		return container;
	}

	const totalValue = row.reduce((sum, item) => sum + item.normalizedValue, 0);

	// Determine if we're laying out horizontally or vertically
	const isHorizontal = container.width >= container.height;

	if (isHorizontal) {
		// Lay out vertically along the left edge
		const rowWidth = totalValue / container.height;
		let currentY = container.y;

		for (const item of row) {
			const rectHeight = item.normalizedValue / rowWidth;

			result.push({
				id: item.id,
				x: container.x,
				y: currentY,
				width: rowWidth,
				height: rectHeight,
				value: item.value,
				label: item.label,
				metadata: item.metadata
			});

			currentY += rectHeight;
		}

		// Return remaining container space
		return {
			x: container.x + rowWidth,
			y: container.y,
			width: container.width - rowWidth,
			height: container.height
		};
	} else {
		// Lay out horizontally along the top edge
		const rowHeight = totalValue / container.width;
		let currentX = container.x;

		for (const item of row) {
			const rectWidth = item.normalizedValue / rowHeight;

			result.push({
				id: item.id,
				x: currentX,
				y: container.y,
				width: rectWidth,
				height: rowHeight,
				value: item.value,
				label: item.label,
				metadata: item.metadata
			});

			currentX += rectWidth;
		}

		// Return remaining container space
		return {
			x: container.x,
			y: container.y + rowHeight,
			width: container.width,
			height: container.height - rowHeight
		};
	}
}

/**
 * Apply gap/padding to treemap rectangles
 *
 * @param rectangles - Original rectangles
 * @param gap - Gap size in pixels
 * @returns Rectangles with gaps applied
 */
export function applyGap(rectangles: TreemapRect[], gap: number): TreemapRect[] {
	return rectangles.map(rect => ({
		...rect,
		x: rect.x + gap / 2,
		y: rect.y + gap / 2,
		width: Math.max(0, rect.width - gap),
		height: Math.max(0, rect.height - gap)
	}));
}
