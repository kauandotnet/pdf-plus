/**
 * Row Detection Module
 *
 * Clusters text items by Y-position to detect table rows.
 * Uses a tolerance-based clustering algorithm.
 */

import type { RowCluster, ClusterTextItem } from "../../../types/table-types.js";

/**
 * Default tolerance for Y-position clustering (in points)
 */
const DEFAULT_ROW_TOLERANCE = 3;

/**
 * Detects rows by clustering text items with similar Y positions
 *
 * @param items - Array of text items to cluster
 * @param tolerance - Maximum Y-distance to consider items in the same row
 * @returns Array of row clusters sorted by Y position (top to bottom in PDF coordinates)
 */
export function detectRows(
  items: ClusterTextItem[],
  tolerance: number = DEFAULT_ROW_TOLERANCE
): RowCluster[] {
  if (items.length === 0) {
    return [];
  }

  // Sort items by Y position (PDF coordinates: higher Y = higher on page)
  const sortedItems = [...items].sort((a, b) => b.y - a.y);

  const clusters: RowCluster[] = [];
  let currentCluster: RowCluster | null = null;

  for (const item of sortedItems) {
    if (!currentCluster) {
      // Start a new cluster
      currentCluster = createCluster(item);
    } else if (Math.abs(currentCluster.y - item.y) <= tolerance) {
      // Add to current cluster
      addToCluster(currentCluster, item);
    } else {
      // Finalize current cluster and start a new one
      clusters.push(currentCluster);
      currentCluster = createCluster(item);
    }
  }

  // Don't forget the last cluster
  if (currentCluster) {
    clusters.push(currentCluster);
  }

  // Sort clusters by Y position (top to bottom in PDF space)
  return clusters.sort((a, b) => b.y - a.y);
}

/**
 * Creates a new row cluster from a single text item
 */
function createCluster(item: ClusterTextItem): RowCluster {
  return {
    y: item.y,
    minY: item.y,
    maxY: item.y + item.height,
    items: [item],
  };
}

/**
 * Adds an item to an existing cluster and updates bounds
 */
function addToCluster(cluster: RowCluster, item: ClusterTextItem): void {
  cluster.items.push(item);
  // Update Y to be the average
  const totalY = cluster.items.reduce((sum, i) => sum + i.y, 0);
  cluster.y = totalY / cluster.items.length;
  // Update bounds
  cluster.minY = Math.min(cluster.minY, item.y);
  cluster.maxY = Math.max(cluster.maxY, item.y + item.height);
}

/**
 * Filters row clusters that are part of a table structure
 *
 * A table row should have multiple items spread across X positions.
 * This filters out single-item rows or rows with items clustered in one area.
 *
 * @param clusters - Array of row clusters
 * @param minItemsPerRow - Minimum items in a row to be considered (default: 2)
 * @returns Filtered clusters that likely belong to a table
 */
export function filterTableRows(
  clusters: RowCluster[],
  minItemsPerRow: number = 2
): RowCluster[] {
  return clusters.filter((cluster) => {
    // Must have minimum number of items
    if (cluster.items.length < minItemsPerRow) {
      return false;
    }

    // Items should be spread across X positions (not all in one spot)
    const xPositions = cluster.items.map((item) => item.x);
    const minX = Math.min(...xPositions);
    const maxX = Math.max(...xPositions);
    const xSpread = maxX - minX;

    // Require some horizontal spread (at least 50 points)
    return xSpread >= 50;
  });
}

/**
 * Groups consecutive rows that appear to belong to the same table
 *
 * Uses consistent vertical spacing to identify table boundaries.
 *
 * @param clusters - Array of row clusters
 * @param maxGapRatio - Maximum ratio of gap to average row height
 * @returns Array of row cluster groups (potential tables)
 */
export function groupConsecutiveRows(
  clusters: RowCluster[],
  maxGapRatio: number = 2.5
): RowCluster[][] {
  if (clusters.length === 0) {
    return [];
  }

  if (clusters.length === 1) {
    return [clusters];
  }

  // Calculate average row height
  const avgHeight =
    clusters.reduce((sum, c) => sum + (c.maxY - c.minY), 0) / clusters.length;

  const groups: RowCluster[][] = [];
  let currentGroup: RowCluster[] = [clusters[0]];

  for (let i = 1; i < clusters.length; i++) {
    const prevCluster = clusters[i - 1];
    const currCluster = clusters[i];

    // Gap between rows (in PDF coordinates, going down the page)
    const gap = prevCluster.minY - currCluster.maxY;

    // If gap is reasonable, add to current group
    if (gap >= 0 && gap <= avgHeight * maxGapRatio) {
      currentGroup.push(currCluster);
    } else {
      // Start a new group
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = [currCluster];
    }
  }

  // Don't forget the last group
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Calculates the height of a row cluster
 */
export function getRowHeight(cluster: RowCluster): number {
  return cluster.maxY - cluster.minY;
}

/**
 * Gets the bounding X range for all items in a row
 */
export function getRowXBounds(cluster: RowCluster): { minX: number; maxX: number } {
  const xStarts = cluster.items.map((item) => item.x);
  const xEnds = cluster.items.map((item) => item.x + item.width);
  return {
    minX: Math.min(...xStarts),
    maxX: Math.max(...xEnds),
  };
}
