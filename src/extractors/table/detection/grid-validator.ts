/**
 * Grid Validation Module
 *
 * Validates that detected row/column structures form a valid table grid.
 * Checks for minimum dimensions, grid density, and structural consistency.
 */

import type {
  RowCluster,
  ColumnCluster,
  TableCandidate,
} from "../../../types/table-types.js";
import type { Position } from "../../../types/index.js";

/**
 * Default validation thresholds
 */
const DEFAULT_MIN_ROWS = 2;
const DEFAULT_MIN_COLUMNS = 2;
const DEFAULT_MIN_DENSITY = 0.6;

/**
 * Validation options
 */
export interface GridValidationOptions {
  /** Minimum number of rows (default: 2) */
  minRows?: number;
  /** Minimum number of columns (default: 2) */
  minColumns?: number;
  /** Minimum grid density - ratio of filled cells to total cells (default: 0.6) */
  minDensity?: number;
  /** Column tolerance for cell assignment */
  columnTolerance?: number;
}

/**
 * Validation result
 */
export interface GridValidationResult {
  /** Whether the grid is valid */
  isValid: boolean;
  /** Reason for invalidity (if not valid) */
  reason?: string;
  /** Grid density (0-1) */
  density: number;
  /** Number of rows */
  rowCount: number;
  /** Number of columns */
  columnCount: number;
  /** Number of filled cells */
  filledCells: number;
  /** Total possible cells */
  totalCells: number;
}

/**
 * Validates a potential table grid
 *
 * @param rows - Detected row clusters
 * @param columns - Detected column clusters
 * @param options - Validation options
 * @returns Validation result
 */
export function validateGrid(
  rows: RowCluster[],
  columns: ColumnCluster[],
  options: GridValidationOptions = {}
): GridValidationResult {
  const {
    minRows = DEFAULT_MIN_ROWS,
    minColumns = DEFAULT_MIN_COLUMNS,
    minDensity = DEFAULT_MIN_DENSITY,
    columnTolerance = 5,
  } = options;

  const rowCount = rows.length;
  const columnCount = columns.length;
  const totalCells = rowCount * columnCount;

  // Check minimum dimensions
  if (rowCount < minRows) {
    return {
      isValid: false,
      reason: `Insufficient rows: ${rowCount} < ${minRows}`,
      density: 0,
      rowCount,
      columnCount,
      filledCells: 0,
      totalCells,
    };
  }

  if (columnCount < minColumns) {
    return {
      isValid: false,
      reason: `Insufficient columns: ${columnCount} < ${minColumns}`,
      density: 0,
      rowCount,
      columnCount,
      filledCells: 0,
      totalCells,
    };
  }

  // Calculate grid density (how many cells have content)
  const filledCells = countFilledCells(rows, columns, columnTolerance);
  const density = totalCells > 0 ? filledCells / totalCells : 0;

  if (density < minDensity) {
    return {
      isValid: false,
      reason: `Low grid density: ${(density * 100).toFixed(1)}% < ${(minDensity * 100).toFixed(1)}%`,
      density,
      rowCount,
      columnCount,
      filledCells,
      totalCells,
    };
  }

  return {
    isValid: true,
    density,
    rowCount,
    columnCount,
    filledCells,
    totalCells,
  };
}

/**
 * Counts the number of cells that have content
 */
function countFilledCells(
  rows: RowCluster[],
  columns: ColumnCluster[],
  tolerance: number
): number {
  let filled = 0;

  for (const row of rows) {
    const columnsWithContent = new Set<number>();

    for (const item of row.items) {
      // Find which column this item belongs to
      for (let colIndex = 0; colIndex < columns.length; colIndex++) {
        const col = columns[colIndex];
        if (itemBelongsToColumn(item.x, item.width, col, tolerance)) {
          columnsWithContent.add(colIndex);
          break;
        }
      }
    }

    filled += columnsWithContent.size;
  }

  return filled;
}

/**
 * Checks if an item's X position falls within a column
 */
function itemBelongsToColumn(
  itemX: number,
  itemWidth: number,
  column: ColumnCluster,
  tolerance: number
): boolean {
  const itemRight = itemX + itemWidth;
  // Check if item overlaps with column (with tolerance)
  return (
    itemX <= column.maxX + tolerance &&
    itemRight >= column.minX - tolerance
  );
}

/**
 * Creates a table candidate from validated rows and columns
 *
 * @param page - Page number
 * @param rows - Validated row clusters
 * @param columns - Validated column clusters
 * @param density - Grid density
 * @returns Table candidate object
 */
export function createTableCandidate(
  page: number,
  rows: RowCluster[],
  columns: ColumnCluster[],
  density: number
): TableCandidate {
  const bounds = calculateBounds(rows, columns);

  return {
    page,
    rows,
    columns,
    bounds,
    density,
  };
}

/**
 * Calculates the bounding box for a table
 */
function calculateBounds(rows: RowCluster[], columns: ColumnCluster[]): Position {
  if (rows.length === 0 || columns.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const minX = Math.min(...columns.map((c) => c.minX));
  const maxX = Math.max(...columns.map((c) => c.maxX));
  const minY = Math.min(...rows.map((r) => r.minY));
  const maxY = Math.max(...rows.map((r) => r.maxY));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Checks if two table candidates overlap significantly
 *
 * Used to merge or deduplicate detected tables.
 *
 * @param a - First table candidate
 * @param b - Second table candidate
 * @param overlapThreshold - Minimum overlap ratio to consider overlapping (default: 0.5)
 * @returns Whether the tables overlap
 */
export function tablesOverlap(
  a: TableCandidate,
  b: TableCandidate,
  overlapThreshold: number = 0.5
): boolean {
  // Must be on the same page
  if (a.page !== b.page) {
    return false;
  }

  // Calculate intersection
  const intersectX = Math.max(a.bounds.x, b.bounds.x);
  const intersectY = Math.max(a.bounds.y, b.bounds.y);
  const intersectRight = Math.min(
    a.bounds.x + a.bounds.width,
    b.bounds.x + b.bounds.width
  );
  const intersectBottom = Math.min(
    a.bounds.y + a.bounds.height,
    b.bounds.y + b.bounds.height
  );

  if (intersectRight <= intersectX || intersectBottom <= intersectY) {
    return false; // No intersection
  }

  const intersectArea =
    (intersectRight - intersectX) * (intersectBottom - intersectY);
  const areaA = a.bounds.width * a.bounds.height;
  const areaB = b.bounds.width * b.bounds.height;
  const minArea = Math.min(areaA, areaB);

  return intersectArea / minArea >= overlapThreshold;
}

/**
 * Checks if rows have consistent column structure
 *
 * Tables typically have consistent column alignment across rows.
 * This checks if the column positions are relatively consistent.
 *
 * @param rows - Row clusters to check
 * @param tolerance - Position tolerance
 * @returns Consistency score (0-1)
 */
export function measureColumnConsistency(
  rows: RowCluster[],
  tolerance: number = 10
): number {
  if (rows.length < 2) {
    return 1;
  }

  // Get X positions from each row
  const rowXPositions = rows.map((row) =>
    row.items.map((item) => item.x).sort((a, b) => a - b)
  );

  // Compare each row to the first row
  const firstRow = rowXPositions[0];
  let totalScore = 0;

  for (let i = 1; i < rowXPositions.length; i++) {
    const currentRow = rowXPositions[i];
    const matchScore = calculatePositionMatchScore(firstRow, currentRow, tolerance);
    totalScore += matchScore;
  }

  return totalScore / (rowXPositions.length - 1);
}

/**
 * Calculates how well two sets of X positions match
 */
function calculatePositionMatchScore(
  posA: number[],
  posB: number[],
  tolerance: number
): number {
  if (posA.length === 0 || posB.length === 0) {
    return 0;
  }

  let matches = 0;
  const usedB = new Set<number>();

  for (const a of posA) {
    for (let i = 0; i < posB.length; i++) {
      if (!usedB.has(i) && Math.abs(a - posB[i]) <= tolerance) {
        matches++;
        usedB.add(i);
        break;
      }
    }
  }

  const maxPossible = Math.max(posA.length, posB.length);
  return matches / maxPossible;
}
