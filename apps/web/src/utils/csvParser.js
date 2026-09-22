/**
 * Robust CSV parser that handles:
 * - Multiline values enclosed in double quotes
 * - Escaped double quotes ("") inside fields
 * - Trailing blank rows and rows with empty commas (,,,,)
 * - Trailing/leading whitespace around fields and column headers
 * - Normalized case-insensitive keys for easy property access
 * 
 * @param {string} csvText - Raw CSV string content
 * @returns {Array<Object>} Array of row objects mapping headers to cell values
 */
export const parseCSV = (csvText) => {
  if (!csvText || typeof csvText !== "string") return [];

  const rows = [];
  let currentRow = [];
  let currentCell = "";
  let inQuotes = false;
  let i = 0;

  while (i < csvText.length) {
    const ch = csvText[i];
    const nextCh = csvText[i + 1];

    if (ch === '"') {
      if (inQuotes && nextCh === '"') {
        // Escaped double quote inside quoted field ("")
        currentCell += '"';
        i += 2;
        continue;
      } else {
        // Toggle quotes mode
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      // Cell delimiter outside quotes
      currentRow.push(currentCell);
      currentCell = "";
    } else if ((ch === '\r' || ch === '\n') && !inQuotes) {
      // End of line outside quotes
      if (ch === '\r' && nextCh === '\n') {
        i++; // Skip \n in \r\n
      }
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
    } else {
      currentCell += ch;
    }
    i++;
  }

  // Push last field & row if anything remaining
  if (currentCell !== "" || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  // Filter out completely empty rows (rows where every cell is blank or whitespace)
  const validRows = rows.filter((row) =>
    row.some((cell) => cell !== undefined && cell.trim() !== "")
  );

  if (validRows.length < 2) return [];

  // Extract headers from first row, trim whitespace and strip quotes
  const rawHeaders = validRows[0];
  const headers = rawHeaders.map((h) =>
    h.trim().replace(/^"|"$/g, "").trim()
  );

  // Map remaining rows to key-value objects
  const parsedData = [];
  for (let r = 1; r < validRows.length; r++) {
    const row = validRows[r];
    const rowObj = {};
    let hasValue = false;

    headers.forEach((header, idx) => {
      let val = row[idx] ?? "";
      val = val.trim();
      // Strip leading/trailing quotes if the value was wrapped in quotes
      if (val.startsWith('"') && val.endsWith('"') && val.length >= 2) {
        val = val.slice(1, -1).replace(/""/g, '"').trim();
      }
      if (header) {
        rowObj[header] = val;
        // Case-insensitive key aliases for convenience (lowercase, trimmed)
        rowObj[header.toLowerCase()] = val;
      }
      if (val !== "") hasValue = true;
    });

    if (hasValue) {
      parsedData.push(rowObj);
    }
  }

  return parsedData;
};
