/**
 * Table Formatter Module
 *
 * Provides formatters to convert tables to various output formats:
 * - CSV (Comma-Separated Values)
 * - Markdown
 * - HTML
 * - JSON
 */

import type { Table, TableRow } from "../../../types/table-types.js";

/**
 * Options for CSV formatting
 */
export interface CSVFormatOptions {
  /** Field delimiter (default: ",") */
  delimiter?: string;
  /** Quote character for fields with special characters (default: '"') */
  quote?: string;
  /** Line ending (default: "\n") */
  lineEnding?: string;
  /** Whether to include headers (default: true) */
  includeHeaders?: boolean;
}

/**
 * Options for Markdown formatting
 */
export interface MarkdownFormatOptions {
  /** Alignment for columns ('left', 'center', 'right', or array per column) */
  alignment?: "left" | "center" | "right" | Array<"left" | "center" | "right">;
  /** Whether to include headers (default: true) */
  includeHeaders?: boolean;
  /** Minimum cell width for padding (default: 3) */
  minCellWidth?: number;
}

/**
 * Options for HTML formatting
 */
export interface HTMLFormatOptions {
  /** CSS class for the table element */
  tableClass?: string;
  /** CSS class for header cells */
  headerClass?: string;
  /** CSS class for body cells */
  cellClass?: string;
  /** Whether to include a caption */
  caption?: string;
  /** Whether to add basic inline styles (default: false) */
  includeStyles?: boolean;
}

/**
 * Converts a table to CSV format
 *
 * @param table - Table to convert
 * @param options - CSV formatting options
 * @returns CSV string
 */
export function tableToCSV(table: Table, options: CSVFormatOptions = {}): string {
  const {
    delimiter = ",",
    quote = '"',
    lineEnding = "\n",
    includeHeaders = true,
  } = options;

  const rows = table.rows;
  const lines: string[] = [];

  for (const row of rows) {
    // Skip header if not including
    if (!includeHeaders && row.isHeader) {
      continue;
    }

    const cells = row.cells
      .sort((a, b) => a.column - b.column)
      .map((cell) => formatCSVField(cell.content, delimiter, quote));

    lines.push(cells.join(delimiter));
  }

  return lines.join(lineEnding);
}

/**
 * Formats a single CSV field, escaping special characters
 */
function formatCSVField(content: string, delimiter: string, quote: string): string {
  // Check if quoting is needed
  const needsQuoting =
    content.includes(delimiter) ||
    content.includes(quote) ||
    content.includes("\n") ||
    content.includes("\r");

  if (!needsQuoting) {
    return content;
  }

  // Escape quotes by doubling them
  const escaped = content.replace(new RegExp(quote, "g"), quote + quote);
  return quote + escaped + quote;
}

/**
 * Converts a table to Markdown format
 *
 * @param table - Table to convert
 * @param options - Markdown formatting options
 * @returns Markdown string
 */
export function tableToMarkdown(
  table: Table,
  options: MarkdownFormatOptions = {}
): string {
  const { alignment = "left", includeHeaders = true, minCellWidth = 3 } = options;

  const rows = table.rows;
  if (rows.length === 0) {
    return "";
  }

  // Calculate column widths
  const columnCount = table.columnCount;
  const columnWidths = calculateColumnWidths(rows, columnCount, minCellWidth);

  const lines: string[] = [];
  let hasAddedSeparator = false;

  for (const row of rows) {
    // Skip header if not including
    if (!includeHeaders && row.isHeader) {
      continue;
    }

    const cells = row.cells
      .sort((a, b) => a.column - b.column)
      .map((cell, idx) => padCell(cell.content, columnWidths[idx] || minCellWidth));

    lines.push("| " + cells.join(" | ") + " |");

    // Add separator after header row
    if (row.isHeader && !hasAddedSeparator) {
      const separator = createMarkdownSeparator(
        columnWidths,
        alignment,
        columnCount
      );
      lines.push(separator);
      hasAddedSeparator = true;
    }
  }

  // If no header was found, add separator after first row
  if (!hasAddedSeparator && lines.length > 0) {
    const separator = createMarkdownSeparator(
      columnWidths,
      alignment,
      columnCount
    );
    lines.splice(1, 0, separator);
  }

  return lines.join("\n");
}

/**
 * Calculates the maximum width for each column
 */
function calculateColumnWidths(
  rows: TableRow[],
  columnCount: number,
  minWidth: number
): number[] {
  const widths: number[] = Array(columnCount).fill(minWidth);

  for (const row of rows) {
    for (const cell of row.cells) {
      const idx = cell.column;
      if (idx < columnCount) {
        widths[idx] = Math.max(widths[idx], cell.content.length);
      }
    }
  }

  return widths;
}

/**
 * Pads a cell content to the specified width
 */
function padCell(content: string, width: number): string {
  return content.padEnd(width);
}

/**
 * Creates the Markdown separator row
 */
function createMarkdownSeparator(
  widths: number[],
  alignment: MarkdownFormatOptions["alignment"],
  columnCount: number
): string {
  const separators: string[] = [];

  for (let i = 0; i < columnCount; i++) {
    const width = widths[i] || 3;
    const align = Array.isArray(alignment) ? alignment[i] || "left" : alignment;

    let sep = "-".repeat(width);
    if (align === "center") {
      sep = ":" + "-".repeat(width - 2) + ":";
    } else if (align === "right") {
      sep = "-".repeat(width - 1) + ":";
    } else {
      sep = ":" + "-".repeat(width - 1);
    }

    separators.push(sep);
  }

  return "| " + separators.join(" | ") + " |";
}

/**
 * Converts a table to HTML format
 *
 * @param table - Table to convert
 * @param options - HTML formatting options
 * @returns HTML string
 */
export function tableToHTML(table: Table, options: HTMLFormatOptions = {}): string {
  const {
    tableClass,
    headerClass,
    cellClass,
    caption,
    includeStyles = false,
  } = options;

  const lines: string[] = [];

  // Open table tag
  const tableAttrs: string[] = [];
  if (tableClass) {
    tableAttrs.push(`class="${escapeHTML(tableClass)}"`);
  }
  if (includeStyles) {
    tableAttrs.push('style="border-collapse: collapse; width: 100%;"');
  }

  lines.push(`<table${tableAttrs.length ? " " + tableAttrs.join(" ") : ""}>`);

  // Add caption if provided
  if (caption) {
    lines.push(`  <caption>${escapeHTML(caption)}</caption>`);
  }

  // Separate header and body rows
  const headerRows = table.rows.filter((r) => r.isHeader);
  const bodyRows = table.rows.filter((r) => !r.isHeader);

  // Render header
  if (headerRows.length > 0) {
    lines.push("  <thead>");
    for (const row of headerRows) {
      lines.push("    <tr>");
      const cells = row.cells.sort((a, b) => a.column - b.column);
      for (const cell of cells) {
        const attrs: string[] = [];
        if (headerClass) {
          attrs.push(`class="${escapeHTML(headerClass)}"`);
        }
        if (includeStyles) {
          attrs.push('style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2; font-weight: bold;"');
        }
        lines.push(
          `      <th${attrs.length ? " " + attrs.join(" ") : ""}>${escapeHTML(cell.content)}</th>`
        );
      }
      lines.push("    </tr>");
    }
    lines.push("  </thead>");
  }

  // Render body
  if (bodyRows.length > 0) {
    lines.push("  <tbody>");
    for (const row of bodyRows) {
      lines.push("    <tr>");
      const cells = row.cells.sort((a, b) => a.column - b.column);
      for (const cell of cells) {
        const attrs: string[] = [];
        if (cellClass) {
          attrs.push(`class="${escapeHTML(cellClass)}"`);
        }
        if (includeStyles) {
          attrs.push('style="border: 1px solid #ddd; padding: 8px;"');
        }
        lines.push(
          `      <td${attrs.length ? " " + attrs.join(" ") : ""}>${escapeHTML(cell.content)}</td>`
        );
      }
      lines.push("    </tr>");
    }
    lines.push("  </tbody>");
  }

  lines.push("</table>");

  return lines.join("\n");
}

/**
 * Escapes HTML special characters
 */
function escapeHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Converts a table to a 2D array of strings
 *
 * @param table - Table to convert
 * @param includeHeaders - Whether to include header rows (default: true)
 * @returns 2D array of cell contents
 */
export function tableToArray(table: Table, includeHeaders: boolean = true): string[][] {
  const rows = includeHeaders
    ? table.rows
    : table.rows.filter((r) => !r.isHeader);

  return rows.map((row) =>
    row.cells
      .sort((a, b) => a.column - b.column)
      .map((cell) => cell.content)
  );
}

/**
 * Converts a table to an array of objects
 *
 * Uses header row values as keys for each row object.
 *
 * @param table - Table to convert
 * @returns Array of row objects
 */
export function tableToObjects(table: Table): Array<Record<string, string>> {
  const headerRow = table.rows.find((r) => r.isHeader);
  const bodyRows = table.rows.filter((r) => !r.isHeader);

  if (!headerRow) {
    // Use column indices as keys
    return bodyRows.map((row) => {
      const obj: Record<string, string> = {};
      for (const cell of row.cells) {
        obj[`col_${cell.column}`] = cell.content;
      }
      return obj;
    });
  }

  // Use header values as keys
  const headers = headerRow.cells
    .sort((a, b) => a.column - b.column)
    .map((cell) => cell.content || `col_${cell.column}`);

  return bodyRows.map((row) => {
    const obj: Record<string, string> = {};
    const sortedCells = row.cells.sort((a, b) => a.column - b.column);

    for (let i = 0; i < sortedCells.length; i++) {
      const key = headers[i] || `col_${i}`;
      obj[key] = sortedCells[i].content;
    }

    return obj;
  });
}

/**
 * Converts a table to JSON format
 *
 * @param table - Table to convert
 * @param asObjects - Whether to convert to objects using headers (default: true)
 * @param pretty - Whether to pretty-print (default: false)
 * @returns JSON string
 */
export function tableToJSON(
  table: Table,
  asObjects: boolean = true,
  pretty: boolean = false
): string {
  const data = asObjects ? tableToObjects(table) : tableToArray(table);
  return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
}
