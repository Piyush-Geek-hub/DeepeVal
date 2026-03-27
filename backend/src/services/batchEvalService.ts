import { evalWithFields } from "./evalClient.js";

export interface BatchDataset {
  id?: string;
  query?: string;
  output?: string;
  context?: string[];
  expected_output?: string;
  metric: string;
  provider?: string;
}

export interface BatchEvalResult {
  dataset_id: string;
  metric: string;
  score?: number;
  verdict?: string;
  explanation?: string;
  error?: string;
  status: "success" | "error";
}

export interface BatchEvaluationResponse {
  batch_id: string;
  total_records: number;
  successful: number;
  failed: number;
  timestamp: string;
  results: BatchEvalResult[];
  summary?: {
    metrics_used: string[];
    average_scores?: Record<string, number>;
    success_rate: number;
  };
}

/**
 * Evaluate multiple datasets in a single batch operation
 * 
 * Iterates through each dataset and evaluates it with the specified metric.
 * Handles errors gracefully - does not stop on single record failure.
 * 
 * @param datasets Array of datasets to evaluate
 * @param batchId Optional batch identifier for tracking
 * @returns Promise with batch evaluation results including summary stats
 */
export async function evaluateBatch(
  datasets: BatchDataset[],
  batchId?: string
): Promise<BatchEvaluationResponse> {
  const generatedBatchId = batchId || `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const results: BatchEvalResult[] = [];
  let successful = 0;
  let failed = 0;

  // Evaluate each dataset
  for (let i = 0; i < datasets.length; i++) {
    const dataset = datasets[i];
    const datasetId = dataset.id || `record-${i + 1}`;

    // Build evaluation parameters, only including non-empty fields
    const evalParams: any = {
      metric: dataset.metric,
      provider: dataset.provider || "groq"
    };

    // Smart field inclusion - only add fields that have values and don't send "NA"
    if (dataset.query && dataset.query.toLowerCase() !== "na") {
      evalParams.query = dataset.query;
    }
    if (dataset.output && dataset.output.toLowerCase() !== "na") {
      evalParams.output = dataset.output;
    }
    if (dataset.context && dataset.context.length > 0) {
      // Filter out empty or "NA" context items
      const validContext = dataset.context.filter(
        ctx => ctx && typeof ctx === "string" && ctx.toLowerCase() !== "na"
      );
      if (validContext.length > 0) {
        evalParams.context = validContext;
      }
    }
    if (dataset.expected_output && dataset.expected_output.toLowerCase() !== "na") {
      evalParams.expected_output = dataset.expected_output;
    }

    try {
      console.log(`[Batch ${generatedBatchId}] Processing dataset ${datasetId} (${i + 1}/${datasets.length})...`);
      console.log(`  Metric: ${dataset.metric}`);
      console.log(`  Parameters:`, JSON.stringify(evalParams, null, 2));

      // Evaluate using the provided metric
      const evalResult = await evalWithFields(evalParams);

      results.push({
        dataset_id: datasetId,
        metric: dataset.metric,
        score: evalResult.score,
        verdict: evalResult.results?.[0]?.verdict || evalResult.verdict,
        explanation: evalResult.explanation,
        status: "success"
      });

      successful++;
      console.log(`  ✓ Success - Score: ${evalResult.score}, Verdict: ${evalResult.results?.[0]?.verdict || evalResult.verdict}`);

    } catch (error) {
      failed++;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`  ✗ Error - ${errorMessage}`);

      results.push({
        dataset_id: datasetId,
        metric: dataset.metric,
        error: errorMessage,
        status: "error"
      });
    }
  }

  // Calculate summary statistics
  const metricsUsed = [...new Set(datasets.map(d => d.metric))];
  const successfulResults = results.filter(r => r.status === "success");
  
  const averageScores: Record<string, number> = {};
  metricsUsed.forEach(metric => {
    const metricResults = successfulResults
      .filter(r => r.metric === metric && r.score !== undefined)
      .map(r => r.score as number);
    
    if (metricResults.length > 0) {
      averageScores[metric] = metricResults.reduce((a, b) => a + b, 0) / metricResults.length;
    }
  });

  const response: BatchEvaluationResponse = {
    batch_id: generatedBatchId,
    total_records: datasets.length,
    successful,
    failed,
    timestamp: new Date().toISOString(),
    results,
    summary: {
      metrics_used: metricsUsed,
      average_scores: Object.keys(averageScores).length > 0 ? averageScores : undefined,
      success_rate: datasets.length > 0 ? (successful / datasets.length) * 100 : 0
    }
  };

  console.log(`\n[Batch ${generatedBatchId}] Complete!`);
  console.log(`  Total: ${response.total_records}, Successful: ${successful}, Failed: ${failed}`);
  if (response.summary) {
    console.log(`  Success Rate: ${response.summary.success_rate.toFixed(2)}%`);
  }

  return response;
}
