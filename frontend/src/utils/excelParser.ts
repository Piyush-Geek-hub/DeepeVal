/**
 * Excel Parser Utility
 * 
 * Converts Excel files to JSON format for batch evaluation
 * Handles smart field mapping and "NA" value filtering
 * 
 * REQUIRES: npm install xlsx
 */

export interface ParsedExcelData {
  headers: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
}

/**
 * Parse Excel file and convert to JSON format
 * Supports .xlsx files (Excel 2007+)
 * 
 * @param file Excel file to parse
 * @returns Parsed data with headers and rows
 */
export async function parseExcelFile(file: File): Promise<ParsedExcelData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e: ProgressEvent<FileReader>) => {
      try {
        if (!e.target?.result) {
          throw new Error("Failed to read file");
        }

        // Import xlsx dynamically - ensure it's installed via: npm install xlsx
        // @ts-ignore - xlsx is an optional dependency
        let xlsxModule: any;
        try {
          // @ts-ignore
          xlsxModule = await import("xlsx");
        } catch {
          throw new Error(
            "xlsx library not installed. Please run: npm install xlsx"
          );
        }

        const { read, utils } = xlsxModule;
        
        const arrayBuffer = e.target.result as ArrayBuffer;
        const workbook = read(new Uint8Array(arrayBuffer), { type: "array" });
        
        // Get first sheet
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          throw new Error("Excel file has no sheets");
        }
        
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON with headers in first row
        const jsonData = utils.sheet_to_json(worksheet, { defval: "" });
        
        if (jsonData.length === 0) {
          throw new Error("Excel sheet is empty");
        }

        // Extract headers from first row
        const firstRow = jsonData[0] as Record<string, unknown>;
        const headers = Object.keys(firstRow);

        // Convert to standardized format: trim whitespace, handle case-insensitive matching
        const normalizedRows = jsonData.map((row: Record<string, unknown>) => {
          const normalized: Record<string, unknown> = {};
          
          headers.forEach(header => {
            const value = row[header];
            
            // Convert to lowercase for comparison with expected fields
            const headerLower = header.toLowerCase().trim();
            let key = headerLower;
            
            // Map common variations to standard names
            if (headerLower.includes("query") || headerLower.includes("question")) {
              key = "query";
            } else if (headerLower.includes("output") || headerLower.includes("response")) {
              key = "output";
            } else if (headerLower.includes("context") || headerLower.includes("retrieval")) {
              key = "context";
            } else if (headerLower.includes("expected") || headerLower.includes("reference")) {
              key = "expected_output";
            } else if (headerLower.includes("metric")) {
              key = "metric";
            } else if (headerLower.includes("provider")) {
              key = "provider";
            } else if (headerLower.includes("id")) {
              key = "id";
            }
            
            // Handle string values
            if (typeof value === "string") {
              const trimmed = value.trim();
              // Keep empty strings for later filtering
              normalized[key] = trimmed || "";
            } else {
              normalized[key] = value || "";
            }
          });
          
          return normalized;
        });

        resolve({
          headers,
          rows: normalizedRows,
          totalRows: normalizedRows.length
        });

      } catch (error) {
        reject(new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : "Unknown error"}`));
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Convert parsed Excel data to batch datasets
 * Handles "NA" values and empty fields appropriately
 * 
 * @param parsedData Parsed Excel data
 * @param requiredFields Fields that must be present in each row
 * @returns Array of batch datasets ready for evaluation
 */
export function convertToBatchDatasets(
  parsedData: ParsedExcelData,
  requiredFields: string[] = ["metric"]
): any[] {
  const datasets = [];

  for (let i = 0; i < parsedData.rows.length; i++) {
    const row = parsedData.rows[i] as Record<string, unknown>;
    
    // Validate required fields
    const missingFields = requiredFields.filter(
      field => !row[field] || row[field] === "" || (typeof row[field] === "string" && row[field].toLowerCase() === "na")
    );
    
    if (missingFields.length > 0) {
      console.warn(
        `Row ${i + 2} (1-indexed) is missing required fields: ${missingFields.join(", ")}. Skipping.`
      );
      continue;
    }

    // Build dataset object, filtering out NA values
    const dataset: Record<string, any> = {
      id: row.id || `row-${i + 2}` // Use row number as ID if not provided
    };

    // Add fields, skipping "NA" values
    const fieldsToProcess = ["query", "output", "context", "expected_output", "metric", "provider"];
    
    fieldsToProcess.forEach(field => {
      const value = row[field];
      
      // Skip if not present or explicitly "NA"
      if (!value || value === "" || (typeof value === "string" && value.trim().toLowerCase() === "na")) {
        return;
      }

      if (field === "context") {
        // Handle context as either string or array
        if (typeof value === "string") {
          // Try to parse as JSON array, or split by common delimiters
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
              dataset.context = parsed;
            } else {
              dataset.context = [value];
            }
          } catch {
            // If not valid JSON, treat as single item
            dataset.context = [value];
          }
        } else if (Array.isArray(value)) {
          dataset.context = value.filter(item => item && typeof item === "string" && item.toLowerCase() !== "na");
        }
      } else {
        dataset[field] = String(value).trim();
      }
    });

    // Only add to datasets if it has required fields
    if (dataset.metric) {
      datasets.push(dataset);
    }
  }

  return datasets;
}
