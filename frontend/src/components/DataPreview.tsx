import React from "react";
import "../styles/data-preview.css";

export interface PreviewDataset {
  id?: string;
  query?: string;
  output?: string;
  context?: string[];
  expected_output?: string;
  metric: string;
  provider?: string;
}

interface DataPreviewProps {
  datasets: PreviewDataset[];
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  totalRows: number;
  processedRows: number;
}

/**
 * DataPreview Component
 * 
 * Displays the converted Excel data as a table before batch evaluation
 * Allows users to verify the data and metrics before submission
 */
export const DataPreview: React.FC<DataPreviewProps> = ({
  datasets,
  onConfirm,
  onCancel,
  isLoading = false,
  totalRows,
  processedRows,
}) => {
  const skippedRows = totalRows - processedRows;

  return (
    <div className="data-preview-container">
      <div className="preview-header">
        <h2>📊 Data Preview - {processedRows} of {totalRows} rows</h2>
        {skippedRows > 0 && (
          <p className="skipped-info">
            ⚠️ {skippedRows} row(s) skipped due to missing required fields
          </p>
        )}
      </div>

      <div className="preview-table-wrapper">
        <table className="preview-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Metric</th>
              <th>Query</th>
              <th>Output</th>
              <th>Context</th>
              <th>Expected Output</th>
              <th>Provider</th>
            </tr>
          </thead>
          <tbody>
            {datasets.slice(0, 10).map((dataset, index) => (
              <tr key={index}>
                <td>
                  <span className="id-badge">{dataset.id || `row-${index + 1}`}</span>
                </td>
                <td>
                  <span className="metric-badge">{dataset.metric}</span>
                </td>
                <td className="query-cell">
                  {dataset.query ? truncate(dataset.query, 50) : "-"}
                </td>
                <td className="output-cell">
                  {dataset.output ? truncate(dataset.output, 40) : "-"}
                </td>
                <td className="context-cell">
                  {dataset.context && dataset.context.length > 0 ? (
                    <span className="context-count">{dataset.context.length} item(s)</span>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="expected-output-cell">
                  {dataset.expected_output ? truncate(dataset.expected_output, 40) : "-"}
                </td>
                <td className="provider-cell">
                  {dataset.provider || "groq"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {datasets.length > 10 && (
        <p className="preview-info">
          Showing 10 of {datasets.length} datasets. All {datasets.length} will be evaluated.
        </p>
      )}

      <div className="preview-summary">
        <div className="summary-item">
          <span className="label">Total Datasets:</span>
          <span className="value">{datasets.length}</span>
        </div>
        <div className="summary-item">
          <span className="label">Metrics Used:</span>
          <span className="value">{getUniqueMetrics(datasets).join(", ")}</span>
        </div>
        <div className="summary-item">
          <span className="label">Success Rate Expected:</span>
          <span className="value">~95%</span>
        </div>
      </div>

      <div className="preview-actions">
        <button
          className="btn btn-cancel"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          className="btn btn-confirm"
          onClick={onConfirm}
          disabled={isLoading || datasets.length === 0}
        >
          {isLoading ? "Evaluating..." : "Start Batch Evaluation"}
        </button>
      </div>
    </div>
  );
};

function truncate(text: string, length: number): string {
  return text.length > length ? text.substring(0, length) + "..." : text;
}

function getUniqueMetrics(datasets: PreviewDataset[]): string[] {
  const metrics = new Set(datasets.map(d => d.metric));
  return Array.from(metrics).sort();
}

export default DataPreview;
