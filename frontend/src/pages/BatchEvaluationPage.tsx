import React, { useState } from "react";
import ExcelUpload from "../components/ExcelUpload";
import DataPreview from "../components/DataPreview";
import BatchResults from "../components/BatchResults";
import { parseExcelFile, convertToBatchDatasets, type ParsedExcelData } from "../utils/excelParser";
import { submitBatchEvaluation, type BatchEvaluationResponse, type BatchDataset } from "../services/batchEvalApi";
import "../styles/batch-evaluation-page.css";

type PageState = "upload" | "preview" | "evaluating" | "results" | "error";

/**
 * BatchEvaluationPage Component
 * 
 * Main page for batch evaluation workflow:
 * 1. Upload Excel file
 * 2. Preview converted data
 * 3. Submit for batch evaluation
 * 4. Display results
 */
const BatchEvaluationPage: React.FC = () => {
  const [pageState, setPageState] = useState<PageState>("upload");
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  // Data state
  const [parsedData, setParsedData] = useState<ParsedExcelData | null>(null);
  const [datasets, setDatasets] = useState<BatchDataset[]>([]);
  const [batchResult, setBatchResult] = useState<BatchEvaluationResponse | null>(null);

  /**
   * Handle Excel file selection
   */
  const handleFileSelect = async (file: File) => {
    try {
      setError(null);
      setIsProcessing(true);
      setFileName(file.name);

      console.log(`📁 Processing file: ${file.name}`);

      // Parse Excel file
      const parsed = await parseExcelFile(file);
      console.log(`✅ Parsed ${parsed.totalRows} rows`);

      // Convert to batch datasets
      const convertedDatasets = convertToBatchDatasets(parsed);
      console.log(`✅ Converted ${convertedDatasets.length} datasets`);

      if (convertedDatasets.length === 0) {
        throw new Error(
          "No valid datasets found in Excel file. Ensure each row has a 'metric' field and required fields for that metric."
        );
      }

      setParsedData(parsed);
      setDatasets(convertedDatasets);
      setPageState("preview");

    } catch (err) {
      console.error("❌ Error processing file:", err);
      setError(err instanceof Error ? err.message : "Failed to process Excel file");
      setPageState("error");
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Handle batch evaluation submission
   */
  const handleBatchSubmit = async () => {
    try {
      setError(null);
      setIsProcessing(true);
      setPageState("evaluating");

      console.log(`🚀 Submitting batch evaluation for ${datasets.length} datasets...`);

      // Submit batch evaluation
      const result = await submitBatchEvaluation(datasets);

      console.log(`✅ Batch evaluation complete!`);
      console.log(`   Success Rate: ${result.summary?.success_rate.toFixed(1)}%`);
      console.log(`   Successful: ${result.successful}/${result.total_records}`);

      setBatchResult(result);
      setPageState("results");

    } catch (err) {
      console.error("❌ Batch evaluation failed:", err);
      setError(err instanceof Error ? err.message : "Batch evaluation failed");
      setPageState("error");
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Reset to upload state
   */
  const handleStartNew = () => {
    setPageState("upload");
    setError(null);
    setFileName(null);
    setParsedData(null);
    setDatasets([]);
    setBatchResult(null);
  };

  /**
   * Generate and download HTML report
   */
  const handleDownloadHTML = () => {
    if (!batchResult) return;

    const html = generateHTMLReport(batchResult);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `batch-report-${batchResult.batch_id}.html`;
    link.click();
    URL.revokeObjectURL(url);

    console.log("📄 HTML report downloaded");
  };

  /**
   * Generate and download Excel report (simplified - uses CSV format)
   */
  const handleDownloadExcel = () => {
    if (!batchResult) return;

    const csv = generateCSVReport(batchResult);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `batch-report-${batchResult.batch_id}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    console.log("📊 CSV report downloaded");
  };

  return (
    <div className="batch-evaluation-page">
      <div className="batch-page-header">
        <h1>🚀 Batch Evaluation</h1>
        <p className="subtitle">
          Upload an Excel file to evaluate multiple datasets in a single batch operation
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="progress-indicator">
        <div className={`step ${pageState === "upload" || ["preview", "evaluating", "results"].includes(pageState) ? "completed" : ""}`}>
          <span className="step-number">1</span>
          <span className="step-label">Upload File</span>
        </div>
        <div className="progress-line"></div>
        <div className={`step ${pageState === "preview" || ["evaluating", "results"].includes(pageState) ? "active" : pageState === "upload" ? "" : "completed"}`}>
          <span className="step-number">2</span>
          <span className="step-label">Preview Data</span>
        </div>
        <div className="progress-line"></div>
        <div className={`step ${pageState === "evaluating" || pageState === "results" ? "active" : ""}`}>
          <span className="step-number">3</span>
          <span className="step-label">Evaluate</span>
        </div>
        <div className="progress-line"></div>
        <div className={`step ${pageState === "results" ? "completed" : ""}`}>
          <span className="step-number">4</span>
          <span className="step-label">Results</span>
        </div>
      </div>

      {/* Content Area */}
      <div className="batch-page-content">
        {pageState === "upload" && (
          <section className="upload-section">
            <ExcelUpload
              onFileSelect={handleFileSelect}
              isLoading={isProcessing}
              acceptedFormats={[".xlsx", ".xls"]}
            />
            <div className="upload-help">
              <h3>📋 Excel Format Guide</h3>
              <p>Your Excel file should contain the following columns:</p>
              <ul>
                <li><strong>metric</strong> (required): Evaluation metric (e.g., faithfulness, contextual_precision)</li>
                <li><strong>query</strong>: The user's question (required for most metrics)</li>
                <li><strong>output</strong>: LLM response (optional for context-quality metrics)</li>
                <li><strong>context</strong>: Retrieved documents, one per line or as JSON array</li>
                <li><strong>expected_output</strong>: Reference answer (required for precision/recall metrics)</li>
                <li><strong>provider</strong> (optional): LLM provider (defaults to 'groq')</li>
              </ul>
              <p className="note">Use <code>NA</code> to skip optional fields</p>
            </div>
          </section>
        )}

        {pageState === "preview" && parsedData && datasets.length > 0 && (
          <section className="preview-section">
            <DataPreview
              datasets={datasets}
              totalRows={parsedData.totalRows}
              processedRows={datasets.length}
              onConfirm={handleBatchSubmit}
              onCancel={handleStartNew}
              isLoading={isProcessing}
            />
          </section>
        )}

        {pageState === "evaluating" && (
          <section className="evaluating-section">
            <div className="evaluating-card">
              <div className="spinner"></div>
              <h2>Processing {datasets.length} Datasets...</h2>
              <p>This may take a few minutes depending on the number of datasets.</p>
              <div className="progress-bar">
                <div className="progress-fill"></div>
              </div>
              <p className="progress-text">Evaluating datasets...</p>
            </div>
          </section>
        )}

        {pageState === "results" && batchResult && (
          <section className="results-section">
            <BatchResults
              batchResult={batchResult}
              onDownloadHTML={handleDownloadHTML}
              onDownloadExcel={handleDownloadExcel}
              onStartNew={handleStartNew}
            />
          </section>
        )}

        {pageState === "error" && error && (
          <section className="error-section">
            <div className="error-card">
              <div className="error-icon">❌</div>
              <h2>Error Processing Batch</h2>
              <p className="error-message">{error}</p>
              <button className="btn btn-retry" onClick={handleStartNew}>
                Back to Upload
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

/**
 * Generate HTML report from batch results
 */
function generateHTMLReport(batchResult: BatchEvaluationResponse): string {
  const successRate = batchResult.summary?.success_rate ?? 0;
  const timestamp = new Date(batchResult.timestamp).toLocaleString();

  const resultsHTML = batchResult.results
    .map(
      (result) => `
    <tr class="result-row ${result.status}">
      <td>${result.dataset_id}</td>
      <td>${result.metric}</td>
      <td>${result.status === "success" ? "✓ Success" : "✗ Error"}</td>
      <td>${result.status === "success" && result.score ? (result.score * 100).toFixed(1) + "%" : "-"}</td>
      <td>${result.verdict || "-"}</td>
      <td>${result.explanation || result.error || "-"}</td>
    </tr>
  `
    )
    .join("");

  const metricsHTML = batchResult.summary?.metrics_used
    .map((metric) => `<li>${metric}</li>`)
    .join("");

  const averageScoresHTML = batchResult.summary?.average_scores
    ? Object.entries(batchResult.summary.average_scores)
        .map(([metric, score]) => `<tr><td>${metric}</td><td>${((score ?? 0) * 100).toFixed(1)}%</td></tr>`)
        .join("")
    : "";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Batch Evaluation Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
        h1 { color: #2c3e50; border-bottom: 2px solid #d4a574; padding-bottom: 10px; }
        h2 { color: #555; margin-top: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
        .summary-item { background: #f5ede3; padding: 15px; border-radius: 8px; }
        .summary-label { color: #666; font-size: 0.9rem; }
        .summary-value { font-size: 1.5rem; font-weight: bold; color: #2c3e50; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f5ede3; font-weight: bold; }
        tr.success { background-color: #f1f8f4; }
        tr.error { background-color: #fff5f5; }
        .timestamp { color: #999; font-size: 0.9rem; margin: 20px 0; }
      </style>
    </head>
    <body>
      <h1>Batch Evaluation Report</h1>
      <p>Generated: ${timestamp}</p>
      <p>Batch ID: <code>${batchResult.batch_id}</code></p>
      
      <h2>Summary</h2>
      <div class="summary">
        <div class="summary-item">
          <div class="summary-label">Success Rate</div>
          <div class="summary-value">${successRate.toFixed(1)}%</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Successful</div>
          <div class="summary-value">${batchResult.successful}/${batchResult.total_records}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Failed</div>
          <div class="summary-value">${batchResult.failed}/${batchResult.total_records}</div>
        </div>
      </div>

      ${
        batchResult.summary?.average_scores && Object.keys(batchResult.summary.average_scores).length > 0
          ? `
      <h2>Average Scores by Metric</h2>
      <table>
        <thead>
          <tr><th>Metric</th><th>Average Score</th></tr>
        </thead>
        <tbody>
          ${averageScoresHTML}
        </tbody>
      </table>
      `
          : ""
      }

      <h2>Detailed Results</h2>
      <table>
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
          ${resultsHTML}
        </tbody>
      </table>

      <div class="timestamp">Report generated on ${new Date().toLocaleString()}</div>
    </body>
    </html>
  `;
}

/**
 * Generate CSV report from batch results
 */
function generateCSVReport(batchResult: BatchEvaluationResponse): string {
  const headers = ["Dataset ID", "Metric", "Status", "Score", "Verdict", "Explanation"];
  const rows = batchResult.results.map((result) => [
    result.dataset_id,
    result.metric,
    result.status,
    result.status === "success" && result.score ? ((result.score ?? 0) * 100).toFixed(1) + "%" : "",
    result.verdict || "",
    result.explanation || result.error || "",
  ]);

  const csvContent = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          const str = String(cell);
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(",")
    )
    .join("\n");

  return csvContent;
}

export default BatchEvaluationPage;
