/**
 * Table Utility Module Exports
 */

export {
  mapCells,
  fillMissingCells,
  getCellContent,
  rowsToArray,
  getColumn,
  type CellMappingOptions,
} from "./cell-mapper.js";

export {
  detectHeaders,
  markHeaderRows,
  getHeaderNames,
  type HeaderDetectionOptions,
  type HeaderDetectionResult,
} from "./header-detector.js";

export {
  tableToCSV,
  tableToMarkdown,
  tableToHTML,
  tableToArray,
  tableToObjects,
  tableToJSON,
  type CSVFormatOptions,
  type MarkdownFormatOptions,
  type HTMLFormatOptions,
} from "./table-formatter.js";
