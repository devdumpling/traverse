/**
 * Shared formatting utilities for CLI output.
 */

/**
 * Format a markdown table with aligned columns.
 */
export const formatTable = (
  headers: readonly string[],
  rows: readonly (readonly string[])[]
): string => {
  // Calculate max width for each column
  const widths = headers.map((h, i) => {
    const cellWidths = rows.map(row => (row[i] ?? '').length);
    return Math.max(h.length, ...cellWidths);
  });

  // Pad a cell to the column width
  const pad = (text: string, colIndex: number): string => {
    const width = widths[colIndex] ?? text.length;
    return text.padEnd(width);
  };

  // Build header row
  const headerRow = '| ' + headers.map((h, i) => pad(h, i)).join(' | ') + ' |';

  // Build separator row
  const separator = '|' + widths.map(w => '-'.repeat(w + 2)).join('|') + '|';

  // Build data rows
  const dataRows = rows.map(row =>
    '| ' + row.map((cell, i) => pad(cell ?? '', i)).join(' | ') + ' |'
  );

  return [headerRow, separator, ...dataRows].join('\n');
};

/**
 * Format bytes as human-readable string.
 */
export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

/**
 * Format milliseconds as human-readable string.
 */
export const formatMs = (ms: number): string => `${ms.toFixed(0)}ms`;
