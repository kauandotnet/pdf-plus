/**
 * Table Detection Module Exports
 */

export {
  detectRows,
  filterTableRows,
  groupConsecutiveRows,
  getRowHeight,
  getRowXBounds,
} from "./row-detector.js";

export {
  detectColumns,
  refineColumnBoundaries,
  findColumnForItem,
  getTotalColumnsWidth,
} from "./column-detector.js";

export {
  validateGrid,
  createTableCandidate,
  tablesOverlap,
  measureColumnConsistency,
  type GridValidationOptions,
  type GridValidationResult,
} from "./grid-validator.js";
