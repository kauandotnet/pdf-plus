/**
 * Cell Mapper Module
 *
 * Maps text items to table cells based on their positions
 * relative to detected rows and columns.
 */

import type {
  TableCell,
  TableRow,
  RowCluster,
  ColumnCluster,
  ClusterTextItem,
} from "../../../types/table-types.js";
import type { Position } from "../../../types/index.js";
import { findColumnForItem } from "../detection/column-detector.js";

/**
 * Options for cell mapping
 */
export interface CellMappingOptions {
  /** Tolerance for column assignment */
  columnTolerance?: number;
  /** Whether to merge text items in the same cell */
  mergeItemsInCell?: boolean;
  /** Separator for merged text items */
  textSeparator?: string;
}

/**
 * Maps row and column clusters to table rows with cells
 *
 * @param rows - Detected row clusters
 * @param columns - Detected column clusters
 * @param options - Mapping options
 * @returns Array of table rows with mapped cells
 */
export function mapCells(
  rows: RowCluster[],
  columns: ColumnCluster[],
  options: CellMappingOptions = {}
): TableRow[] {
  const {
    columnTolerance = 5,
    mergeItemsInCell = true,
    textSeparator = " ",
  } = options;

  const tableRows: TableRow[] = [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const rowCluster = rows[rowIndex];
    const cells = mapRowCells(
      rowCluster,
      rowIndex,
      columns,
      columnTolerance,
      mergeItemsInCell,
      textSeparator
    );

    const tableRow: TableRow = {
      index: rowIndex,
      y: rowCluster.y,
      height: rowCluster.maxY - rowCluster.minY,
      cells,
      isHeader: false, // Will be set by header detector
    };

    tableRows.push(tableRow);
  }

  return tableRows;
}

/**
 * Maps items in a row cluster to cells
 */
function mapRowCells(
  rowCluster: RowCluster,
  rowIndex: number,
  columns: ColumnCluster[],
  tolerance: number,
  mergeItems: boolean,
  separator: string
): TableCell[] {
  // Group items by column
  const columnItems: Map<number, ClusterTextItem[]> = new Map();

  for (const item of rowCluster.items) {
    const colIndex = findColumnForItem(item, columns, tolerance);
    if (colIndex >= 0) {
      const existing = columnItems.get(colIndex) || [];
      existing.push(item);
      columnItems.set(colIndex, existing);
    }
  }

  // Create cells for each column
  const cells: TableCell[] = [];

  for (let colIndex = 0; colIndex < columns.length; colIndex++) {
    const items = columnItems.get(colIndex) || [];
    const column = columns[colIndex];

    // Sort items by X position (left to right)
    items.sort((a, b) => a.x - b.x);

    // Merge content or take first item
    let content = "";
    if (mergeItems && items.length > 0) {
      content = items.map((item) => item.str).join(separator);
    } else if (items.length > 0) {
      content = items[0].str;
    }

    // Calculate cell position
    const position = calculateCellPosition(items, rowCluster, column);

    const cell: TableCell = {
      row: rowIndex,
      column: colIndex,
      content: content.trim(),
      position,
      isHeader: false, // Will be set by header detector
    };

    cells.push(cell);
  }

  return cells;
}

/**
 * Calculates the position/bounds of a cell
 */
function calculateCellPosition(
  items: ClusterTextItem[],
  rowCluster: RowCluster,
  column: ColumnCluster
): Position {
  if (items.length === 0) {
    // Empty cell - use column bounds and row height
    return {
      x: column.minX,
      y: rowCluster.minY,
      width: column.width,
      height: rowCluster.maxY - rowCluster.minY,
    };
  }

  // Use actual item bounds
  const minX = Math.min(...items.map((i) => i.x));
  const maxX = Math.max(...items.map((i) => i.x + i.width));
  const minY = Math.min(...items.map((i) => i.y));
  const maxY = Math.max(...items.map((i) => i.y + i.height));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Fills in missing cells in rows to ensure complete grid
 *
 * @param rows - Table rows that may have gaps
 * @param columnCount - Expected number of columns
 * @returns Rows with complete cell arrays
 */
export function fillMissingCells(
  rows: TableRow[],
  columnCount: number
): TableRow[] {
  return rows.map((row) => {
    if (row.cells.length >= columnCount) {
      return row;
    }

    // Create a map of existing cells by column index
    const cellMap = new Map<number, TableCell>();
    for (const cell of row.cells) {
      cellMap.set(cell.column, cell);
    }

    // Fill in missing cells
    const completeCells: TableCell[] = [];
    for (let colIndex = 0; colIndex < columnCount; colIndex++) {
      const existing = cellMap.get(colIndex);
      if (existing) {
        completeCells.push(existing);
      } else {
        // Create empty cell
        completeCells.push({
          row: row.index,
          column: colIndex,
          content: "",
          position: { x: 0, y: row.y, width: 0, height: row.height },
          isHeader: row.isHeader,
        });
      }
    }

    return {
      ...row,
      cells: completeCells,
    };
  });
}

/**
 * Gets the content of a specific cell in a table
 *
 * @param rows - Table rows
 * @param rowIndex - Row index (0-based)
 * @param colIndex - Column index (0-based)
 * @returns Cell content or empty string if not found
 */
export function getCellContent(
  rows: TableRow[],
  rowIndex: number,
  colIndex: number
): string {
  if (rowIndex < 0 || rowIndex >= rows.length) {
    return "";
  }

  const row = rows[rowIndex];
  const cell = row.cells.find((c) => c.column === colIndex);
  return cell?.content || "";
}

/**
 * Converts table rows to a 2D array of strings
 *
 * @param rows - Table rows
 * @returns 2D array of cell contents
 */
export function rowsToArray(rows: TableRow[]): string[][] {
  return rows.map((row) =>
    row.cells
      .sort((a, b) => a.column - b.column)
      .map((cell) => cell.content)
  );
}

/**
 * Gets a column as an array of values
 *
 * @param rows - Table rows
 * @param colIndex - Column index (0-based)
 * @returns Array of cell contents for the column
 */
export function getColumn(rows: TableRow[], colIndex: number): string[] {
  return rows.map((row) => {
    const cell = row.cells.find((c) => c.column === colIndex);
    return cell?.content || "";
  });
}
