/**
 * Table Extractor
 *
 * Main class for detecting and extracting tables from PDF documents.
 * Uses text positioning data to identify table structures.
 */

import type {
  Table,
  TableColumn,
  TableExtractionOptions,
  TableExtractionResult,
  ClusterTextItem,
  TableCandidate,
} from "../../types/table-types.js";
import type { PDFTextItem } from "../../lib/pdf/types.js";
import { extractTextItems } from "../../lib/pdf/text.js";
import {
  detectRows,
  filterTableRows,
  groupConsecutiveRows,
  detectColumns,
  refineColumnBoundaries,
  validateGrid,
  createTableCandidate,
} from "./detection/index.js";
import {
  mapCells,
  fillMissingCells,
  detectHeaders,
  markHeaderRows,
  tableToCSV,
  tableToMarkdown,
  tableToHTML,
  tableToArray,
  tableToObjects,
} from "./utils/index.js";

/**
 * Default extraction options
 */
const DEFAULT_OPTIONS: Required<
  Omit<TableExtractionOptions, "pages" | "verbose">
> = {
  rowTolerance: 3,
  columnTolerance: 5,
  minColumns: 2,
  minRows: 2,
  minGridDensity: 0.6,
  detectHeaders: true,
};

/**
 * TableExtractor class for detecting and extracting tables from PDFs
 *
 * @example
 * ```typescript
 * const extractor = new TableExtractor();
 * const result = await extractor.extract('document.pdf', {
 *   detectHeaders: true,
 *   minRows: 3
 * });
 *
 * for (const table of result.tables) {
 *   console.log(extractor.tableToMarkdown(table));
 * }
 * ```
 */
export class TableExtractor {
  /**
   * Extract tables from a PDF file
   *
   * @param pdfPath - Path to the PDF file
   * @param options - Extraction options
   * @returns Promise resolving to extraction result
   */
  async extract(
    pdfPath: string,
    options: TableExtractionOptions = {}
  ): Promise<TableExtractionResult> {
    const startTime = Date.now();
    const opts = { ...DEFAULT_OPTIONS, ...options };

    if (opts.verbose) {
      console.log(`📊 Starting table extraction from: ${pdfPath}`);
    }

    // Extract text items with positioning
    const textResult = await extractTextItems(pdfPath, {
      firstPage: options.pages?.[0],
      lastPage: options.pages ? Math.max(...options.pages) : undefined,
    });

    if (opts.verbose) {
      console.log(`📝 Extracted text from ${textResult.totalPages} pages`);
    }

    // Filter to specific pages if requested
    const pageIndices = options.pages
      ? options.pages.map((p) => p - 1) // Convert to 0-based
      : Array.from({ length: textResult.totalPages }, (_, i) => i);

    const tables: Table[] = [];
    let filteredCandidates = 0;

    // Process each page
    for (const pageIndex of pageIndices) {
      if (pageIndex < 0 || pageIndex >= textResult.items.length) {
        continue;
      }

      const pageItems = textResult.items[pageIndex];
      const pageNumber = pageIndex + 1;

      if (opts.verbose) {
        console.log(`  Processing page ${pageNumber} (${pageItems.length} items)`);
      }

      // Convert PDF text items to cluster format
      const clusterItems = pageItems.map(pdfItemToClusterItem);

      // Detect tables on this page
      const pageTables = this.detectTablesOnPage(
        clusterItems,
        pageNumber,
        opts
      );

      filteredCandidates += pageTables.filtered;
      tables.push(...pageTables.tables);

      if (opts.verbose && pageTables.tables.length > 0) {
        console.log(`    Found ${pageTables.tables.length} table(s)`);
      }
    }

    const result: TableExtractionResult = {
      tables,
      pagesProcessed: pageIndices.length,
      tableCount: tables.length,
      metadata: {
        extractionTimeMs: Date.now() - startTime,
        options: opts,
        filteredCandidates,
      },
    };

    if (opts.verbose) {
      console.log(`✅ Extraction complete: ${tables.length} table(s) found in ${result.metadata.extractionTimeMs}ms`);
    }

    return result;
  }

  /**
   * Detects tables on a single page
   */
  private detectTablesOnPage(
    items: ClusterTextItem[],
    pageNumber: number,
    options: Required<Omit<TableExtractionOptions, "pages" | "verbose">> & { verbose?: boolean; detectHeaders: boolean }
  ): { tables: Table[]; filtered: number } {
    const tables: Table[] = [];
    let filtered = 0;

    // Step 1: Detect rows by Y-position clustering
    const allRows = detectRows(items, options.rowTolerance);

    // Step 2: Filter to rows that look like table rows
    const tableRows = filterTableRows(allRows, options.minColumns);

    if (tableRows.length < options.minRows) {
      return { tables, filtered: 0 };
    }

    // Step 3: Group consecutive rows into potential tables
    const rowGroups = groupConsecutiveRows(tableRows);

    // Step 4: Process each row group as a potential table
    for (const rowGroup of rowGroups) {
      if (rowGroup.length < options.minRows) {
        filtered++;
        continue;
      }

      // Detect columns for this row group
      const columns = detectColumns(rowGroup, options.columnTolerance);

      if (columns.length < options.minColumns) {
        filtered++;
        continue;
      }

      // Refine column boundaries
      const refinedColumns = refineColumnBoundaries(columns, rowGroup);

      // Validate the grid structure
      const validation = validateGrid(rowGroup, refinedColumns, {
        minRows: options.minRows,
        minColumns: options.minColumns,
        minDensity: options.minGridDensity,
        columnTolerance: options.columnTolerance,
      });

      if (!validation.isValid) {
        filtered++;
        continue;
      }

      // Create table candidate
      const candidate = createTableCandidate(
        pageNumber,
        rowGroup,
        refinedColumns,
        validation.density
      );

      // Build the table
      const table = this.buildTable(candidate, options);
      tables.push(table);
    }

    return { tables, filtered };
  }

  /**
   * Builds a Table object from a validated candidate
   */
  private buildTable(
    candidate: TableCandidate,
    options: { detectHeaders: boolean; columnTolerance?: number }
  ): Table {
    const tableId = `table_p${candidate.page}_${Date.now()}`;

    // Map cells from row/column clusters
    let tableRows = mapCells(candidate.rows, candidate.columns, {
      columnTolerance: options.columnTolerance ?? 5,
    });

    // Fill in any missing cells
    tableRows = fillMissingCells(tableRows, candidate.columns.length);

    // Detect and mark headers
    if (options.detectHeaders) {
      const headerResult = detectHeaders(tableRows, candidate.rows);
      if (headerResult.hasHeader) {
        tableRows = markHeaderRows(tableRows, headerResult.headerRowIndices);
      }
    }

    // Build column definitions
    const tableColumns: TableColumn[] = candidate.columns.map((col, index) => ({
      index,
      x: col.x,
      width: col.width,
      header: tableRows[0]?.isHeader
        ? tableRows[0].cells.find((c) => c.column === index)?.content
        : undefined,
    }));

    return {
      id: tableId,
      page: candidate.page,
      position: candidate.bounds,
      rows: tableRows,
      columns: tableColumns,
      confidence: candidate.density,
      hasHeader: tableRows.some((r) => r.isHeader),
      rowCount: tableRows.length,
      columnCount: candidate.columns.length,
    };
  }

  // ============================================================================
  // Convenience methods for formatting
  // ============================================================================

  /**
   * Converts a table to a 2D array of strings
   */
  tableToArray(table: Table, includeHeaders: boolean = true): string[][] {
    return tableToArray(table, includeHeaders);
  }

  /**
   * Converts a table to CSV format
   */
  tableToCSV(table: Table, delimiter: string = ","): string {
    return tableToCSV(table, { delimiter });
  }

  /**
   * Converts a table to Markdown format
   */
  tableToMarkdown(table: Table): string {
    return tableToMarkdown(table);
  }

  /**
   * Converts a table to HTML format
   */
  tableToHTML(table: Table, options?: { tableClass?: string }): string {
    return tableToHTML(table, options);
  }

  /**
   * Converts a table to an array of objects (using headers as keys)
   */
  tableToObjects(table: Table): Array<Record<string, string>> {
    return tableToObjects(table);
  }
}

/**
 * Converts a PDFTextItem to ClusterTextItem format
 */
function pdfItemToClusterItem(item: PDFTextItem): ClusterTextItem {
  return {
    str: item.str,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    fontName: item.fontName,
    fontSize: item.fontSize,
  };
}

/**
 * Convenience function for extracting tables
 *
 * @param pdfPath - Path to the PDF file
 * @param options - Extraction options
 * @returns Promise resolving to extraction result
 *
 * @example
 * ```typescript
 * import { extractTables } from 'pdf-plus';
 *
 * const result = await extractTables('document.pdf', {
 *   pages: [1, 2],
 *   detectHeaders: true
 * });
 *
 * console.log(`Found ${result.tableCount} tables`);
 * ```
 */
export async function extractTables(
  pdfPath: string,
  options?: TableExtractionOptions
): Promise<TableExtractionResult> {
  const extractor = new TableExtractor();
  return extractor.extract(pdfPath, options);
}
