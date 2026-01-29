/**
 * Column Detection Module
 *
 * Detects table columns by finding consistent X-position alignments
 * across multiple rows.
 */

import type {
  ColumnCluster,
  RowCluster,
  ClusterTextItem,
} from "../../../types/table-types.js";

/**
 * Default tolerance for X-position clustering (in points)
 */
const DEFAULT_COLUMN_TOLERANCE = 5;

/**
 * Detects columns by analyzing X-position alignments across rows
 *
 * @param rows - Array of row clusters to analyze
 * @param tolerance - Maximum X-distance to consider items in the same column
 * @returns Array of column clusters sorted by X position (left to right)
 */
export function detectColumns(
  rows: RowCluster[],
  tolerance: number = DEFAULT_COLUMN_TOLERANCE
): ColumnCluster[] {
  if (rows.length === 0) {
    return [];
  }

  // Collect all unique X positions from all rows
  const xPositions: Array<{ x: number; width: number }> = [];

  for (const row of rows) {
    for (const item of row.items) {
      xPositions.push({ x: item.x, width: item.width });
    }
  }

  // Cluster X positions
  const columns = clusterXPositions(xPositions, tolerance);

  // Filter to keep only columns that appear in multiple rows
  const minRowAppearance = Math.max(2, Math.floor(rows.length * 0.3));
  const validColumns = filterColumnsByRowAppearance(columns, rows, tolerance, minRowAppearance);

  return validColumns.sort((a, b) => a.x - b.x);
}

/**
 * Clusters X positions into column groups
 */
function clusterXPositions(
  positions: Array<{ x: number; width: number }>,
  tolerance: number
): ColumnCluster[] {
  if (positions.length === 0) {
    return [];
  }

  // Sort by X position
  const sorted = [...positions].sort((a, b) => a.x - b.x);

  const clusters: ColumnCluster[] = [];
  let currentCluster: {
    positions: Array<{ x: number; width: number }>;
    minX: number;
    maxX: number;
  } | null = null;

  for (const pos of sorted) {
    if (!currentCluster) {
      currentCluster = {
        positions: [pos],
        minX: pos.x,
        maxX: pos.x + pos.width,
      };
    } else if (pos.x - currentCluster.minX <= tolerance) {
      // Close enough to current cluster
      currentCluster.positions.push(pos);
      currentCluster.minX = Math.min(currentCluster.minX, pos.x);
      currentCluster.maxX = Math.max(currentCluster.maxX, pos.x + pos.width);
    } else {
      // Start new cluster
      clusters.push(finalizeCluster(currentCluster));
      currentCluster = {
        positions: [pos],
        minX: pos.x,
        maxX: pos.x + pos.width,
      };
    }
  }

  if (currentCluster) {
    clusters.push(finalizeCluster(currentCluster));
  }

  return clusters;
}

/**
 * Finalizes a column cluster by computing average position and width
 */
function finalizeCluster(cluster: {
  positions: Array<{ x: number; width: number }>;
  minX: number;
  maxX: number;
}): ColumnCluster {
  const avgX =
    cluster.positions.reduce((sum, p) => sum + p.x, 0) / cluster.positions.length;

  return {
    x: avgX,
    minX: cluster.minX,
    maxX: cluster.maxX,
    width: cluster.maxX - cluster.minX,
  };
}

/**
 * Filters columns to keep only those that appear in multiple rows
 */
function filterColumnsByRowAppearance(
  columns: ColumnCluster[],
  rows: RowCluster[],
  tolerance: number,
  minAppearances: number
): ColumnCluster[] {
  return columns.filter((column) => {
    let appearances = 0;

    for (const row of rows) {
      const hasItemInColumn = row.items.some(
        (item) => Math.abs(item.x - column.x) <= tolerance
      );
      if (hasItemInColumn) {
        appearances++;
      }
    }

    return appearances >= minAppearances;
  });
}

/**
 * Refines column boundaries based on actual content
 *
 * Adjusts column widths to better fit the actual content,
 * handling cases where columns may overlap.
 *
 * @param columns - Initial column clusters
 * @param rows - Row clusters with text items
 * @returns Refined column clusters with adjusted boundaries
 */
export function refineColumnBoundaries(
  columns: ColumnCluster[],
  _rows: RowCluster[]
): ColumnCluster[] {
  if (columns.length <= 1) {
    return columns;
  }

  const refined = columns.map((col) => ({ ...col }));

  // Adjust boundaries between adjacent columns
  for (let i = 0; i < refined.length - 1; i++) {
    const left = refined[i];
    const right = refined[i + 1];

    // Find the midpoint between columns
    const midpoint = (left.maxX + right.minX) / 2;

    // Only adjust if columns are close or overlapping
    if (left.maxX > right.minX - 10) {
      left.maxX = midpoint;
      left.width = left.maxX - left.minX;
      right.minX = midpoint;
      right.width = right.maxX - right.minX;
    }
  }

  return refined;
}

/**
 * Finds which column a text item belongs to
 *
 * @param item - Text item to place
 * @param columns - Array of column clusters
 * @param tolerance - X-position tolerance
 * @returns Column index (0-based) or -1 if no match
 */
export function findColumnForItem(
  item: ClusterTextItem,
  columns: ColumnCluster[],
  tolerance: number = DEFAULT_COLUMN_TOLERANCE
): number {
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    // Check if item's X position falls within column bounds (with tolerance)
    if (item.x >= col.minX - tolerance && item.x <= col.maxX + tolerance) {
      return i;
    }
    // Also check if item overlaps with column
    const itemRight = item.x + item.width;
    if (item.x < col.maxX && itemRight > col.minX) {
      return i;
    }
  }

  // No exact match - find closest column
  let closestCol = -1;
  let closestDistance = Infinity;

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const distance = Math.min(
      Math.abs(item.x - col.x),
      Math.abs(item.x - col.minX),
      Math.abs(item.x - col.maxX)
    );
    if (distance < closestDistance) {
      closestDistance = distance;
      closestCol = i;
    }
  }

  return closestCol;
}

/**
 * Gets the total width spanned by all columns
 */
export function getTotalColumnsWidth(columns: ColumnCluster[]): number {
  if (columns.length === 0) {
    return 0;
  }
  const minX = Math.min(...columns.map((c) => c.minX));
  const maxX = Math.max(...columns.map((c) => c.maxX));
  return maxX - minX;
}
