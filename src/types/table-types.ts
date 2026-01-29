/**
 * Table Extraction Types
 *
 * Type definitions for automatic table detection and extraction from PDFs.
 */

import type { Position } from "./index.js";

/**
 * A detected table in the PDF
 */
export interface Table {
  /** Unique identifier for the table */
  id: string;
  /** Page number where the table is located (1-based) */
  page: number;
  /** Bounding box position of the table */
  position: Position;
  /** Array of rows in the table */
  rows: TableRow[];
  /** Array of column definitions */
  columns: TableColumn[];
  /** Confidence score for table detection (0-1) */
  confidence: number;
  /** Whether the table has a detected header row */
  hasHeader: boolean;
  /** Number of rows in the table */
  rowCount: number;
  /** Number of columns in the table */
  columnCount: number;
}

/**
 * A row in a table
 */
export interface TableRow {
  /** Row index (0-based) */
  index: number;
  /** Y position of the row */
  y: number;
  /** Height of the row */
  height: number;
  /** Cells in this row */
  cells: TableCell[];
  /** Whether this row is a header row */
  isHeader: boolean;
}

/**
 * A column in a table
 */
export interface TableColumn {
  /** Column index (0-based) */
  index: number;
  /** X position of the column */
  x: number;
  /** Width of the column */
  width: number;
  /** Column header text (if detected) */
  header?: string;
}

/**
 * A cell in a table
 */
export interface TableCell {
  /** Row index (0-based) */
  row: number;
  /** Column index (0-based) */
  column: number;
  /** Text content of the cell */
  content: string;
  /** Position of the cell */
  position: Position;
  /** Whether this cell is in a header row */
  isHeader: boolean;
  /** Row span (for merged cells, default: 1) */
  rowSpan?: number;
  /** Column span (for merged cells, default: 1) */
  colSpan?: number;
}

/**
 * Options for table extraction
 */
export interface TableExtractionOptions {
  /** Specific pages to extract tables from (1-based). If not specified, all pages are processed. */
  pages?: number[];
  /** Y-position tolerance for grouping text items into rows (default: 3) */
  rowTolerance?: number;
  /** X-position tolerance for grouping text items into columns (default: 5) */
  columnTolerance?: number;
  /** Minimum number of columns to consider a valid table (default: 2) */
  minColumns?: number;
  /** Minimum number of rows to consider a valid table (default: 2) */
  minRows?: number;
  /** Minimum grid density (filled cells / total cells) to consider valid (default: 0.6) */
  minGridDensity?: number;
  /** Whether to detect header rows (default: true) */
  detectHeaders?: boolean;
  /** Enable verbose logging (default: false) */
  verbose?: boolean;
}

/**
 * Result of table extraction
 */
export interface TableExtractionResult {
  /** Array of detected tables */
  tables: Table[];
  /** Total number of pages processed */
  pagesProcessed: number;
  /** Total number of tables found */
  tableCount: number;
  /** Extraction metadata */
  metadata: TableExtractionMetadata;
}

/**
 * Metadata about the extraction process
 */
export interface TableExtractionMetadata {
  /** Time taken to extract tables (in milliseconds) */
  extractionTimeMs: number;
  /** Options used for extraction */
  options: TableExtractionOptions;
  /** Number of candidate tables that were filtered out */
  filteredCandidates: number;
}

/**
 * Internal type for a cluster of text items at similar Y positions
 */
export interface RowCluster {
  /** Average Y position of the cluster */
  y: number;
  /** Minimum Y position in the cluster */
  minY: number;
  /** Maximum Y position in the cluster */
  maxY: number;
  /** Text items in this cluster */
  items: ClusterTextItem[];
}

/**
 * Internal type for a cluster of X positions forming a column
 */
export interface ColumnCluster {
  /** Average X position of the column */
  x: number;
  /** Minimum X position in the column */
  minX: number;
  /** Maximum X position in the column */
  maxX: number;
  /** Width of the column */
  width: number;
}

/**
 * Simplified text item for clustering
 */
export interface ClusterTextItem {
  /** Text content */
  str: string;
  /** X position */
  x: number;
  /** Y position */
  y: number;
  /** Width */
  width: number;
  /** Height */
  height: number;
  /** Font name */
  fontName: string;
  /** Font size */
  fontSize: number;
}

/**
 * A candidate table region before validation
 */
export interface TableCandidate {
  /** Page number */
  page: number;
  /** Row clusters */
  rows: RowCluster[];
  /** Column clusters */
  columns: ColumnCluster[];
  /** Bounding box */
  bounds: Position;
  /** Grid density */
  density: number;
}
