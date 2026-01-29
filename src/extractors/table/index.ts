/**
 * Table Extraction Module
 *
 * Provides automatic table detection and extraction from PDF documents
 * using text positioning data.
 */

export { TableExtractor, extractTables } from "./table-extractor.js";

// Re-export detection utilities
export {
  detectRows,
  filterTableRows,
  groupConsecutiveRows,
  detectColumns,
  refineColumnBoundaries,
  findColumnForItem,
  validateGrid,
  createTableCandidate,
  type GridValidationOptions,
  type GridValidationResult,
} from "./detection/index.js";

// Re-export utility functions
export {
  mapCells,
  fillMissingCells,
  getCellContent,
  rowsToArray,
  getColumn,
  detectHeaders,
  markHeaderRows,
  getHeaderNames,
  tableToCSV,
  tableToMarkdown,
  tableToHTML,
  tableToArray,
  tableToObjects,
  tableToJSON,
  type CellMappingOptions,
  type HeaderDetectionOptions,
  type HeaderDetectionResult,
  type CSVFormatOptions,
  type MarkdownFormatOptions,
  type HTMLFormatOptions,
} from "./utils/index.js";
