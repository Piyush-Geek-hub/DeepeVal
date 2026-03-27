import React from "react";
import { BatchEvaluationResponse, BatchEvalResult } from "../services/batchEvalApi";
import "../styles/batch-results.css";

interface BatchResultsProps {
  batchResult: BatchEvaluationResponse;
  onDownloadHTML?: () => void;
  onDownloadExcel?: () => void;
  onStartNew?: () => void;
}

/**
 * BatchResults Component
 * 
 * Displays comprehensive batch evaluation results including:
 * - Summary statistics
 * - Success/failure metrics
 * - Detailed results table
 * - Export options
 */
export const BatchResults: React.FC<BatchResultsProps> = ({
  batchResult,
  onDownloadHTML,
  onDownloadExcel,
  onStartNew,
}) => {
  const { summary } = batchResult;
  const successRate = summary?.success_rate ?? 0;
  const successClass = successRate === 100 ? "excellent" : successRate >= 80 ? "good" : successRate >= 60 ? "fair" : "poor";

  const sortedResults = [...batchResult.results].sort((a, b) => {
    // Sort by status (errors first) then by score
    if (a.status !== b.status) {
      return a.status === "error" ? -1 : 1;
    }
    return (b.score ?? 0) - (a.score ?? 0);
  });

  return (
    <div className="batch-results-container">
      {/* Batch Header */}
      <div className="results-header">
        <h2>✅ Batch Evaluation Complete</h2>
        <p className="batch-id">Batch ID: <code>{batchResult.batch_id}</code></p>
        <p className="timestamp">Completed at: {new Date(batchResult.timestamp).toLocaleString()}</p>
      </div>

      {/* Summary Statistics */}
      <div className="results-summary">
        <div className={`summary-card success-rate ${successClass}`}>
          <div className="card-icon">📊</div>
          <div className="card-content">
            <p className="card-label">Success Rate</p>
            <p className="card-value">{successRate.toFixed(1)}%</p>
            <p className="card-subtitle">of records evaluated successfully</p>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon">✅</div>
          <div className="card-content">
            <p className="card-label">Successful</p>
            <p className="card-value">{batchResult.successful}/{batchResult.total_records}</p>
            <p className="card-subtitle">records processed</p>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon">❌</div>
          <div className="card-content">
            <p className="card-label">Failed</p>
            <p className="card-value">{batchResult.failed}/{batchResult.total_records}</p>
            <p className="card-subtitle">records with errors</p>
          </div>
        </div>

        {summary?.metrics_used && (
          <div className="summary-card">
            <div className="card-icon">📋</div>
            <div className="card-content">
              <p className="card-label">Metrics Used</p>
              <p className="card-value">{summary.metrics_used.length}</p>
              <p className="card-subtitle">{summary.metrics_used.join(", ")}</p>
            </div>
          </div>
        )}
      </div>

      {/* Average Scores */}
      {summary?.average_scores && Object.keys(summary.average_scores).length > 0 && (
        <div className="average-scores">
          <h3>Average Scores by Metric</h3>
          <div className="scores-grid">
            {Object.entries(summary.average_scores).map(([metric, score]) => (
              <div key={metric} className="score-item">
                <p className="score-metric">{metric}</p>
                <div className="score-bar">
                  <div
                    className="score-fill"
                    style={{ width: `${(score ?? 0) * 100}%` }}
                  ></div>
                </div>
                <p className="score-value">{((score ?? 0) * 100).toFixed(1)}%</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Results Table */}
      <div className="detailed-results">
        <h3>Detailed Results</h3>
        <div className="results-table-wrapper">
          <table className="results-table">
            <thead>
              <tr>
                <th>Dataset ID</th>
                <th>Metric</th>
                <th>Status</th>
                <th>Score</th>
                <th>Verdict</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {sortedResults.map((result, index) => (
                <tr key={index} className={`result-row ${result.status}`}>
                  <td className="id-cell">
                    <span className="id-badge">{result.dataset_id}</span>
                  </td>
                  <td className="metric-cell">{result.metric}</td>
                  <td className="status-cell">
                    <span className={`status-badge ${result.status}`}>
                      {result.status === "success" ? "✓ Success" : "✗ Error"}
                    </span>
                  </td>
                  <td className="score-cell">
                    {result.status === "success" && result.score !== undefined ? (
                      <span className="score-badge">
                        {(result.score * 100).toFixed(1)}%
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="verdict-cell">
                    {result.verdict ? (
                      <span className="verdict">{result.verdict}</span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="message-cell" title={result.error || result.explanation || ""}>
                    {result.error ? (
                      <span className="error-message">{truncate(result.error, 60)}</span>
                    ) : result.explanation ? (
                      <span className="explanation">{truncate(result.explanation, 60)}</span>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {batchResult.results.length === 0 && (
          <p className="no-results">No results to display</p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="results-actions">
        {onDownloadHTML && (
          <button
            className="btn btn-download"
            onClick={onDownloadHTML}
            title="Download results as HTML report"
          >
            📄 Download HTML Report
          </button>
        )}
        {onDownloadExcel && (
          <button
            className="btn btn-download"
            onClick={onDownloadExcel}
            title="Download results as Excel spreadsheet"
          >
            📊 Download Excel Report
          </button>
        )}
        {onStartNew && (
          <button
            className="btn btn-primary"
            onClick={onStartNew}
            title="Start a new batch evaluation"
          >
            Start New Evaluation
          </button>
        )}
      </div>
    </div>
  );
};

function truncate(text: string, length: number): string {
  return text.length > length ? text.substring(0, length) + "..." : text;
}

export default BatchResults;
