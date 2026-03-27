import { Router, Request, Response, NextFunction } from "express";
import { evaluateBatch, BatchDataset } from "../services/batchEvalService.js";

const router = Router();

/**
 * Error handler middleware for async routes
 */
const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

/**
 * POST /api/batch/evaluate
 * Batch evaluation endpoint for evaluating multiple datasets
 * 
 * Request body:
 * {
 *   datasets: [
 *     {
 *       id?: string (optional, auto-generated if not provided),
 *       query?: string,
 *       output?: string,
 *       context?: string[],
 *       expected_output?: string,
 *       metric: string (required - evaluation metric name),
 *       provider?: string (optional, defaults to 'groq')
 *     },
 *     ...
 *   ]
 * }
 * 
 * Features:
 * - Smart field filtering: Automatically excludes "NA" values
 * - Graceful error handling: Continues evaluating if single record fails
 * - Batch tracking: Returns batch_id for correlating results
 * - Summary statistics: Provides success rate and average scores per metric
 * 
 * Response:
 * {
 *   batch_id: string,
 *   total_records: number,
 *   successful: number,
 *   failed: number,
 *   timestamp: string,
 *   results: [
 *     {
 *       dataset_id: string,
 *       metric: string,
 *       score?: number,
 *       verdict?: string,
 *       explanation?: string,
 *       error?: string,
 *       status: "success" | "error"
 *     },
 *     ...
 *   ],
 *   summary: {
 *     metrics_used: string[],
 *     average_scores: { [metric]: number },
 *     success_rate: number (0-100)
 *   }
 * }
 * 
 * Example Request:
 * POST /api/batch/evaluate
 * {
 *   "datasets": [
 *     {
 *       "id": "test-1",
 *       "query": "How to reset Salesforce password?",
 *       "output": "To reset your password, go to admin console and click reset",
 *       "context": [
 *         "Admin guide for password resets",
 *         "Salesforce security best practices"
 *       ],
 *       "expected_output": "Steps: 1) Go to admin console 2) Select users 3) Click reset password",
 *       "metric": "contextual_precision"
 *     },
 *     {
 *       "id": "test-2",
 *       "query": "Can you login to Salesforce?",
 *       "output": "Yes, I can help with login issues",
 *       "context": ["Salesforce login troubleshooting"],
 *       "expected_output": "Steps to resolve login: verify username, reset password, check SSO",
 *       "metric": "contextual_recall"
 *     }
 *   ]
 * }
 */
router.post(
  "/batch/evaluate",
  asyncHandler(async (req: Request, res: Response) => {
    const { datasets } = req.body;

    // Validation
    if (!datasets) {
      return res.status(400).json({
        error: "Missing required field: datasets",
        helpText: "datasets must be an array of evaluation datasets"
      });
    }

    if (!Array.isArray(datasets)) {
      return res.status(400).json({
        error: "Invalid field type: datasets",
        helpText: "datasets must be an array, not " + typeof datasets
      });
    }

    if (datasets.length === 0) {
      return res.status(400).json({
        error: "Empty datasets array",
        helpText: "datasets array must contain at least one dataset to evaluate"
      });
    }

    // Validate each dataset has required fields
    for (let i = 0; i < datasets.length; i++) {
      const dataset = datasets[i];
      
      if (!dataset.metric) {
        return res.status(400).json({
          error: `Missing required field 'metric' in dataset at index ${i}`,
          helpText: `Each dataset must specify a metric (e.g., 'faithfulness', 'contextual_precision')`
        });
      }

      // Verify dataset is an object
      if (typeof dataset !== "object" || dataset === null) {
        return res.status(400).json({
          error: `Invalid dataset at index ${i}`,
          helpText: "Each dataset must be a valid object"
        });
      }
    }

    // Validate total request size (prevent abuse)
    const totalSize = JSON.stringify(datasets).length;
    const maxSize = 10 * 1024 * 1024; // 10MB limit
    if (totalSize > maxSize) {
      return res.status(413).json({
        error: "Request payload too large",
        helpText: `Total request size ${(totalSize / 1024 / 1024).toFixed(2)}MB exceeds ${(maxSize / 1024 / 1024).toFixed(2)}MB limit`
      });
    }

    try {
      console.log(`\n🚀 Starting batch evaluation with ${datasets.length} datasets...`);
      
      // Perform batch evaluation
      const batchResult = await evaluateBatch(datasets);

      console.log(`\n✅ Batch evaluation complete`);
      res.json(batchResult);

    } catch (error) {
      console.error("❌ Batch evaluation error:", error);
      res.status(500).json({
        error: "Batch evaluation failed",
        details: error instanceof Error ? error.message : "Unknown error",
        helpText: "Check that all required fields are present and the DeepEval service is running"
      });
    }
  })
);

/**
 * GET /api/batch/health
 * Health check endpoint for batch API
 */
router.get("/batch/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "batch-evaluation",
    timestamp: new Date().toISOString()
  });
});

export default router;
