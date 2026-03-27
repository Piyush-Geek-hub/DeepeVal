/**
 * Batch Evaluation API Client
 * 
 * Handles communication with the backend batch evaluation endpoint
 */

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

const API_BASE_URL = "/api";

/**
 * Submit a batch evaluation request
 * @param datasets Array of datasets to evaluate
 * @returns Promise with batch evaluation results
 */
export async function submitBatchEvaluation(
  datasets: BatchDataset[]
): Promise<BatchEvaluationResponse> {
  const response = await fetch(`${API_BASE_URL}/batch/evaluate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ datasets }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      errorData.details || errorData.error || `Batch evaluation failed with status ${response.status}`
    );
  }

  return response.json();
}

/**
 * Check batch API health
 */
export async function checkBatchHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/batch/health`);
    return response.ok;
  } catch {
    return false;
  }
}
