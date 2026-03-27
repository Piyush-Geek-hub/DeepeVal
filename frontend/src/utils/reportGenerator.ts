/**
 * Report Generator Utility
 * 
 * Generates HTML and Excel reports from batch evaluation results
 */

import { BatchEvaluationResponse } from "../services/batchEvalApi";

/**
 * Generate a comprehensive HTML report
 */
export function generateHTMLReport(batchResult: BatchEvaluationResponse): string {
  const { batch_id, total_records, successful, failed, timestamp, results, summary } = batchResult;
  const successRate = summary?.success_rate ?? 0;
  const formattedTime = new Date(timestamp).toLocaleString();

  // Build success rate color indicator
  let rateColor = "#f44336"; // Red
  if (successRate >= 80) rateColor = "#4caf50"; // Green
  else if (successRate >= 60) rateColor = "#ff9800"; // Orange

  // Generate results table rows
  const resultsTableRows = results
    .map((result) => {
      const statusColor = result.status === "success" ? "#c8e6c9" : "#ffcdd2";
      const statusText = result.status === "success" ? "✓ Success" : "✗ Error";
      const scoreDisplay =
        result.status === "success" && result.score !== undefined
          ? `${(result.score * 100).toFixed(1)}%`
          : "-";

      return `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 12px; background-color: #f5ede3; font-weight: 500;">${result.dataset_id}</td>
          <td style="padding: 12px;">${result.metric}</td>
          <td style="padding: 12px; background-color: ${statusColor}; text-align: center; font-weight: 600;">${statusText}</td>
          <td style="padding: 12px; text-align: right; font-weight: 600;">${scoreDisplay}</td>
          <td style="padding: 12px; color: #666;">${result.verdict || "-"}</td>
          <td style="padding: 12px; color: #555; font-size: 0.9rem; max-width: 300px;">${
            truncateText(result.explanation || result.error || "-", 100)
          }</td>
        </tr>
      `;
    })
    .join("");

  // Generate average scores section
  const averageScoresHTML =
    summary?.average_scores && Object.keys(summary.average_scores).length > 0
      ? `
    <section style="margin-top: 40px; margin-bottom: 40px;">
      <h2 style="color: #2c3e50; border-bottom: 2px solid #d4a574; padding-bottom: 10px;">Average Scores by Metric</h2>
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr style="background-color: #f5ede3; border-bottom: 2px solid #d4a574;">
            <th style="padding: 12px; text-align: left; font-weight: 600;">Metric</th>
            <th style="padding: 12px; text-align: left;">Score</th>
            <th style="padding: 12px; text-align: left;">Score Bar</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(summary.average_scores)
            .map(
              ([metric, score]) => `
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 12px; font-weight: 500;">${metric}</td>
              <td style="padding: 12px; font-weight: 600;">${((score ?? 0) * 100).toFixed(1)}%</td>
              <td style="padding: 12px;">
                <div style="background-color: #e0e0e0; height: 20px; border-radius: 4px; overflow: hidden;">
                  <div style="background: linear-gradient(90deg, #d4a574, #8b6f47); height: 100%; width: ${(score ?? 0) * 100}%; transition: width 0.3s;"></div>
                </div>
              </td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </section>
  `
      : "";

  // Generate metrics used section
  const metricsUsedHTML =
    summary?.metrics_used && summary.metrics_used.length > 0
      ? `<li><strong>Metrics Used:</strong> ${summary.metrics_used.join(", ")}</li>`
      : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Batch Evaluation Report - ${batch_id}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #333;
      background-color: #f5f5f5;
      padding: 40px 20px;
      line-height: 1.6;
    }
    
    .container {
      max-width: 1000px;
      margin: 0 auto;
      background-color: #ffffff;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    
    .header {
      border-bottom: 3px solid #d4a574;
      padding-bottom: 20px;
      margin-bottom: 30px;
      text-align: center;
    }
    
    h1 {
      color: #2c3e50;
      font-size: 2.5rem;
      margin-bottom: 10px;
    }
    
    .report-meta {
      color: #666;
      font-size: 0.95rem;
      margin: 10px 0;
    }
    
    .batch-id {
      background-color: #f5ede3;
      padding: 8px 12px;
      border-radius: 4px;
      font-family: monospace;
      font-weight: 500;
      display: inline-block;
    }
    
    .timestamp {
      color: #999;
      font-size: 0.9rem;
      margin-top: 10px;
    }
    
    section {
      margin: 30px 0;
    }
    
    h2 {
      color: #2c3e50;
      border-bottom: 2px solid #d4a574;
      padding-bottom: 10px;
      margin: 30px 0 20px 0;
      font-size: 1.5rem;
    }
    
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin: 20px 0;
    }
    
    .summary-card {
      padding: 20px;
      background-color: #faf8f5;
      border-left: 4px solid #d4a574;
      border-radius: 4px;
    }
    
    .summary-card.success {
      border-left-color: #4caf50;
      background-color: #e8f5e9;
    }
    
    .summary-card-label {
      font-size: 0.9rem;
      color: #666;
      margin-bottom: 8px;
    }
    
    .summary-card-value {
      font-size: 2rem;
      font-weight: 700;
      color: #2c3e50;
    }
    
    .summary-list {
      list-style: none;
      margin: 20px 0;
    }
    
    .summary-list li {
      padding: 10px;
      background-color: #faf8f5;
      margin: 8px 0;
      border-left: 3px solid #d4a574;
      padding-left: 15px;
      border-radius: 2px;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 0.95rem;
    }
    
    thead {
      background-color: #f5ede3;
      border-bottom: 2px solid #d4a574;
    }
    
    th {
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #2c3e50;
    }
    
    td {
      padding: 12px;
      border-bottom: 1px solid #eee;
    }
    
    tbody tr:hover {
      background-color: #faf8f5;
    }
    
    .success-row {
      background-color: #f1f8f4;
    }
    
    .error-row {
      background-color: #fff5f5;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      text-align: center;
      color: #999;
      font-size: 0.9rem;
    }
    
    .success-rate-display {
      background: linear-gradient(135deg, ${rateColor}, ${lightenColor(rateColor, 20)});
      color: white;
      padding: 30px;
      border-radius: 8px;
      text-align: center;
      margin: 20px 0;
    }
    
    .success-rate-value {
      font-size: 3rem;
      font-weight: 700;
      margin: 10px 0;
    }
    
    .success-rate-label {
      font-size: 1.1rem;
      opacity: 0.9;
    }
    
    @media (max-width: 600px) {
      .container {
        padding: 20px;
      }
      
      h1 {
        font-size: 1.8rem;
      }
      
      .summary-grid {
        grid-template-columns: 1fr;
      }
      
      table {
        font-size: 0.85rem;
      }
      
      th, td {
        padding: 8px;
      }
    }
    
    @page {
      margin: 1in;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Batch Evaluation Report</h1>
      <div class="report-meta">
        <div>Batch ID: <span class="batch-id">${batch_id}</span></div>
        <div class="timestamp">Generated: ${formattedTime}</div>
      </div>
    </div>
    
    <section>
      <div class="success-rate-display">
        <div class="success-rate-label">Overall Success Rate</div>
        <div class="success-rate-value">${successRate.toFixed(1)}%</div>
      </div>
      
      <ul class="summary-list">
        <li><strong>Total Records:</strong> ${total_records}</li>
        <li><strong>Successful:</strong> ${successful} <span style="color: #666;">/ ${total_records}</span></li>
        <li><strong>Failed:</strong> ${failed} <span style="color: #666;">/ ${total_records}</span></li>
        ${metricsUsedHTML}
      </ul>
    </section>
    
    ${averageScoresHTML}
    
    <section>
      <h2>Detailed Results</h2>
      <table>
        <thead>
          <tr>
            <th>Dataset ID</th>
            <th>Metric</th>
            <th>Status</th>
            <th>Score</th>
            <th>Verdict</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          ${resultsTableRows}
        </tbody>
      </table>
    </section>
    
    <div class="footer">
      <p>This report was automatically generated by LLM Evaluation Framework</p>
      <p>Report generated on ${new Date().toLocaleString()}</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate a CSV export of results
 */
export function generateCSVReport(batchResult: BatchEvaluationResponse): string {
  const headers = [
    "Dataset ID",
    "Metric",
    "Status",
    "Score (%)",
    "Verdict",
    "Explanation",
    "Error",
  ];

  const rows = batchResult.results.map((result) => [
    result.dataset_id,
    result.metric,
    result.status,
    result.status === "success" && result.score ? (result.score * 100).toFixed(1) : "",
    result.verdict || "",
    (result.explanation || "").replace(/"/g, '""'),
    (result.error || "").replace(/"/g, '""'),
  ]);

  // Prepend summary info
  const summary = [
    ["Batch Evaluation Report"],
    [batchResult.batch_id],
    [`Generated: ${new Date(batchResult.timestamp).toLocaleString()}`],
    [],
    ["Summary Statistics"],
    ["Total Records", batchResult.total_records],
    ["Successful", batchResult.successful],
    ["Failed", batchResult.failed],
    ["Success Rate (%)", (batchResult.summary?.success_rate ?? 0).toFixed(1)],
    [],
  ];

  if (batchResult.summary?.average_scores) {
    summary.push(["Average Scores by Metric"], []);
    Object.entries(batchResult.summary.average_scores).forEach(([metric, score]) => {
      summary.push([metric, ((score ?? 0) * 100).toFixed(1) + "%"]);
    });
    summary.push([]);
  }

  summary.push(["Detailed Results"], headers);

  const csvContent = [...summary, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          const str = String(cell || "");
          // Quote fields containing commas, quotes, or newlines
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",")
    )
    .join("\n");

  return csvContent;
}

/**
 * Utility function to truncate text
 */
function truncateText(text: string, maxLength: number): string {
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
}

/**
 * Utility function to lighten a color
 */
function lightenColor(color: string, percent: number): string {
  // Simple approach: if color is hex, adjust slightly
  // For production, use a proper color library
  return color === "#4caf50" ? "#81c784" : color === "#ff9800" ? "#ffb74d" : "#ef5350";
}
