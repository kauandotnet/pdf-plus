/**
 * Header Detection Module
 *
 * Detects header rows in tables using various heuristics:
 * - First row position
 * - Bold or larger fonts
 * - Different styling from body rows
 * - Content patterns (uppercase, short labels)
 */

import type { TableRow, RowCluster } from "../../../types/table-types.js";

/**
 * Options for header detection
 */
export interface HeaderDetectionOptions {
  /** Whether to check the first row (default: true) */
  checkFirstRow?: boolean;
  /** Whether to check font characteristics (default: true) */
  checkFontStyle?: boolean;
  /** Font size ratio threshold to consider as header (default: 1.1) */
  fontSizeRatioThreshold?: number;
  /** Whether to check content patterns (default: true) */
  checkContentPatterns?: boolean;
}

/**
 * Result of header detection
 */
export interface HeaderDetectionResult {
  /** Whether a header was detected */
  hasHeader: boolean;
  /** Index of the header row(s) */
  headerRowIndices: number[];
  /** Confidence score for header detection (0-1) */
  confidence: number;
  /** Reasons for the detection */
  reasons: string[];
}

/**
 * Detects header rows in a table
 *
 * @param rows - Table rows to analyze
 * @param rowClusters - Original row clusters with font info
 * @param options - Detection options
 * @returns Header detection result
 */
export function detectHeaders(
  rows: TableRow[],
  rowClusters: RowCluster[],
  options: HeaderDetectionOptions = {}
): HeaderDetectionResult {
  const {
    checkFirstRow = true,
    checkFontStyle = true,
    fontSizeRatioThreshold = 1.1,
    checkContentPatterns = true,
  } = options;

  if (rows.length === 0) {
    return {
      hasHeader: false,
      headerRowIndices: [],
      confidence: 0,
      reasons: ["No rows to analyze"],
    };
  }

  const scores: Array<{ index: number; score: number; reasons: string[] }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cluster = rowClusters[i];
    let score = 0;
    const reasons: string[] = [];

    // Check if it's the first row
    if (checkFirstRow && i === 0) {
      score += 0.3;
      reasons.push("First row");
    }

    // Check font characteristics
    if (checkFontStyle && cluster) {
      const fontScore = checkFontCharacteristics(
        cluster,
        rowClusters.slice(1), // Compare to other rows
        fontSizeRatioThreshold
      );
      if (fontScore.isDistinct) {
        score += fontScore.score;
        reasons.push(...fontScore.reasons);
      }
    }

    // Check content patterns
    if (checkContentPatterns) {
      const contentScore = checkContentPatternScore(row);
      if (contentScore.isHeaderLike) {
        score += contentScore.score;
        reasons.push(...contentScore.reasons);
      }
    }

    scores.push({ index: i, score, reasons });
  }

  // Find rows with significant header scores
  const threshold = 0.3;
  const headerRows = scores.filter((s) => s.score >= threshold);

  // Usually only the first row(s) are headers
  const firstHeaderIndex = headerRows.length > 0 ? headerRows[0].index : -1;
  const isFirstRowHeader = firstHeaderIndex === 0;

  if (isFirstRowHeader && headerRows[0].score >= threshold) {
    return {
      hasHeader: true,
      headerRowIndices: [0],
      confidence: Math.min(1, headerRows[0].score),
      reasons: headerRows[0].reasons,
    };
  }

  return {
    hasHeader: false,
    headerRowIndices: [],
    confidence: 0,
    reasons: ["No clear header detected"],
  };
}

/**
 * Checks font characteristics to detect headers
 */
function checkFontCharacteristics(
  row: RowCluster,
  otherRows: RowCluster[],
  sizeRatioThreshold: number
): { isDistinct: boolean; score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  if (otherRows.length === 0 || row.items.length === 0) {
    return { isDistinct: false, score: 0, reasons: [] };
  }

  // Calculate average font size in this row
  const avgSize =
    row.items.reduce((sum, item) => sum + item.fontSize, 0) / row.items.length;

  // Calculate average font size in other rows
  const otherSizes = otherRows.flatMap((r) => r.items.map((i) => i.fontSize));
  const avgOtherSize =
    otherSizes.length > 0
      ? otherSizes.reduce((sum, s) => sum + s, 0) / otherSizes.length
      : avgSize;

  // Check if font size is larger
  if (avgSize >= avgOtherSize * sizeRatioThreshold) {
    score += 0.25;
    reasons.push("Larger font size");
  }

  // Check for bold fonts (common naming patterns)
  const boldPatterns = /bold|heavy|black|medium/i;
  const hasBoldFont = row.items.some((item) => boldPatterns.test(item.fontName));
  const otherHaveBold = otherRows.some((r) =>
    r.items.some((item) => boldPatterns.test(item.fontName))
  );

  if (hasBoldFont && !otherHaveBold) {
    score += 0.25;
    reasons.push("Bold font");
  }

  return {
    isDistinct: score > 0,
    score,
    reasons,
  };
}

/**
 * Checks content patterns that suggest a header row
 */
function checkContentPatternScore(row: TableRow): {
  isHeaderLike: boolean;
  score: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  let score = 0;

  const contents = row.cells.map((cell) => cell.content).filter((c) => c.length > 0);

  if (contents.length === 0) {
    return { isHeaderLike: false, score: 0, reasons: [] };
  }

  // Check for short labels (headers tend to be short)
  const avgLength = contents.reduce((sum, c) => sum + c.length, 0) / contents.length;
  if (avgLength < 20) {
    score += 0.1;
    reasons.push("Short labels");
  }

  // Check for capitalized or uppercase content
  const capitalizedCount = contents.filter(
    (c) => c.charAt(0) === c.charAt(0).toUpperCase() && /^[A-Z]/.test(c)
  ).length;

  if (capitalizedCount > contents.length * 0.7) {
    score += 0.15;
    reasons.push("Capitalized content");
  }

  // Check for common header keywords
  const headerKeywords =
    /^(id|name|date|time|type|status|amount|price|quantity|description|title|number|code|category|value|total|count|rate|percent|index|key|label)$/i;

  const keywordMatches = contents.filter((c) => headerKeywords.test(c.trim())).length;
  if (keywordMatches > 0) {
    score += 0.2 * Math.min(1, keywordMatches / contents.length);
    reasons.push("Contains header keywords");
  }

  // Check for no numbers (headers rarely have numbers)
  const hasNumbers = contents.some((c) => /^\d+(\.\d+)?$/.test(c.trim()));
  if (!hasNumbers && contents.length > 1) {
    score += 0.1;
    reasons.push("No numeric values");
  }

  return {
    isHeaderLike: score > 0.2,
    score,
    reasons,
  };
}

/**
 * Marks header rows in table rows
 *
 * @param rows - Table rows to update
 * @param headerIndices - Indices of header rows
 * @returns Updated rows with isHeader flag set
 */
export function markHeaderRows(rows: TableRow[], headerIndices: number[]): TableRow[] {
  const headerSet = new Set(headerIndices);

  return rows.map((row, index) => {
    const isHeader = headerSet.has(index);
    return {
      ...row,
      isHeader,
      cells: row.cells.map((cell) => ({
        ...cell,
        isHeader,
      })),
    };
  });
}

/**
 * Gets header row content as column names
 *
 * @param rows - Table rows
 * @returns Array of column names from the header row
 */
export function getHeaderNames(rows: TableRow[]): string[] {
  const headerRow = rows.find((row) => row.isHeader);
  if (!headerRow) {
    return [];
  }

  return headerRow.cells
    .sort((a, b) => a.column - b.column)
    .map((cell) => cell.content);
}
