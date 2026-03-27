import { Router, Request, Response, NextFunction } from "express";
import { callLLM } from "../services/llmClient.js";
import { evalWithMetric, evalWithFields, evalFaithfulness } from "../services/evalClient.js";
import { retrieveContext } from "../services/ragService.js";
import { ENV } from "../config/env.js";

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
 * POST /api/llm/eval
 * LLM-only evaluation endpoint
 *
 * Request body:
 * {
 *   prompt: string (required),
 *   model?: string (optional, defaults to llama-3.3-70b-versatile),
 *   temperature?: number (optional, defaults to 0.7),
 *   metric?: string (optional, defaults to 'answer_relevancy')
 * }
 *
 * Response:
 * {
 *   prompt: string,
 *   model: string,
 *   provider: string,
 *   llmResponse: string,
 *   evaluation: { metric, score, explanation }
 * }
 */
router.post(
  "/llm/eval",
  asyncHandler(async (req: Request, res: Response) => {
    const { prompt, model, temperature, metric } = req.body;

    // Validation
    if (!prompt) {
      return res.status(400).json({
        error: "Missing required field: prompt"
      });
    }

    // Validate temperature if provided
    if (temperature !== undefined && (typeof temperature !== 'number' || temperature < 0 || temperature > 2)) {
      return res.status(400).json({
        error: "Temperature must be a number between 0 and 2"
      });
    }

    // Determine effective parameters
    const effectiveModel = model || "llama-3.3-70b-versatile";
    const effectiveTemperature = temperature !== undefined ? temperature : 0.7;
    const effectiveMetric = metric || "answer_relevancy"; // Changed default from faithfulness

    // Call LLM
    const llmResponse = await callLLM(prompt, effectiveModel, effectiveTemperature);
    console.log("LLM Response:", llmResponse);

    // Determine provider based on model
    const provider = effectiveModel.startsWith("llama-") || effectiveModel.startsWith("mixtral-") || 
                     effectiveModel.startsWith("gemma") || effectiveModel.startsWith("qwen") ? "groq" : "openai";

    // Evaluate with DeepEval using specified metric
    // For LLM-only (no RAG), answer_relevancy makes most sense
    // query = prompt, output = llmResponse
    const evalResult = await evalWithFields({
      query: prompt,
      output: llmResponse,
      metric: effectiveMetric,
      provider
    });
    console.log("Evaluation Result:", evalResult);

    // Use legacy fields for backward compatibility (populated from first successful result)
    res.json({
      prompt,
      model: effectiveModel,
      temperature: effectiveTemperature,
      provider,
      llmResponse,
      evaluation: {
        metric: evalResult.metric_name,
        score: evalResult.score,
        explanation: evalResult.explanation,
        // Include results array if available for multi-metric support
        ...(evalResult.results && { results: evalResult.results })
      }
    });
  })
);

/**
 * POST /api/rag/eval
 * RAG + LLM evaluation endpoint
 *
 * Request body:
 * {
 *   query: string (required),
 *   model?: string (optional, defaults to llama-3.3-70b-versatile),
 *   temperature?: number (optional, defaults to 0.7),
 *   metric?: string (optional, defaults to 'faithfulness')
 * }
 *
 * Response:
 * {
 *   query: string,
 *   context: string,
 *   prompt: string,
 *   llmResponse: string,
 *   evaluation: { metric, score, explanation }
 * }
 */
router.post(
  "/rag/eval",
  asyncHandler(async (req: Request, res: Response) => {
    const { query, model, temperature, metric } = req.body;

    // Validation
    if (!query) {
      return res.status(400).json({
        error: "Missing required field: query"
      });
    }

    // Validate temperature if provided
    if (temperature !== undefined && (typeof temperature !== 'number' || temperature < 0 || temperature > 2)) {
      return res.status(400).json({
        error: "Temperature must be a number between 0 and 2"
      });
    }

    // Determine effective parameters
    const effectiveModel = model || "llama-3.3-70b-versatile";
    const effectiveTemperature = temperature !== undefined ? temperature : 0.7;
    const effectiveMetric = metric || "faithfulness";

    // 1. Retrieve context from RAG
    const contextStr = await retrieveContext(query);

    // 2. Build RAG prompt
    const ragPrompt = `You are a helpful QA assistant. Using ONLY the following context, answer the question as accurately as possible. If the context does not contain the answer, say "I don't have enough information to answer that."

CONTEXT:
${contextStr}

QUESTION:
${query}

ANSWER:`;

    // 3. Call LLM with RAG prompt
    const llmResponse = await callLLM(ragPrompt, effectiveModel, effectiveTemperature);

    // Determine provider based on model
    const provider = effectiveModel.startsWith("llama-") || effectiveModel.startsWith("mixtral-") || 
                     effectiveModel.startsWith("gemma") || effectiveModel.startsWith("qwen") ? "groq" : "openai";

    // 4. Evaluate using specified metric
    // For RAG, we have context (as array) and output
    const evalResult = await evalWithFields({
      context: [contextStr], // Convert string to array
      output: llmResponse,
      metric: effectiveMetric,
      provider
    });

    res.json({
      query,
      context: contextStr,
      prompt: ragPrompt,
      model: effectiveModel,
      temperature: effectiveTemperature,
      provider,
      llmResponse,
      evaluation: {
        metric: evalResult.metric_name,
        score: evalResult.score,
        explanation: evalResult.explanation,
        // Include results array if available for multi-metric support
        ...(evalResult.results && { results: evalResult.results })
      }
    });
  })
);

/**
 * GET /health
 * Health check endpoint
 */
router.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /eval-only
 * DeepEval evaluation endpoint (same format as RAGAS)
 * 
 * SUPPORTED METRICS WITH REQUIREMENTS:
 * 
 * ✓ faithfulness
 *   - Field requirements: query, output, context(retrieval_context)
 *   - Use case: RAG systems - verify output is faithfully derived from context
 * 
 * ✓ answer_relevancy
 *   - Field requirements: query, output
 *   - Use case: QA systems - verify answer addresses the question
 * 
 * ✓ contextual_precision
 *   - Field requirements: query, expected_output, context(retrieval_context)
 *   - Use case: After retrieval - verify retrieved docs relevant to query
 *   - Note: output NOT required (evaluates context quality, not LLM output)
 * 
 * ✓ contextual_recall [NEW]
 *   - Field requirements: expected_output, context(retrieval_context)
 *   - Use case: After retrieval - verify retrieved docs have all info needed for expected answer
 *   - Note: output NOT required (evaluates context completeness, not LLM output)
 *   - Optional: query (beneficial for context)
 *   - Example: User asks about Salesforce login-See expected_output below
 * 
 * ✓ pii_leakage
 *   - Field requirements: query, output
 *   - Use case: Privacy - detect PII in LLM outputs
 * 
 * ✓ bias
 *   - Field requirements: query, output
 *   - Use case: Fairness - detect bias in outputs
 * 
 * ✓ hallucination
 *   - Field requirements: query, output, context(retrieval_context)
 *   - Use case: Accuracy - detect hallucinations by comparing with context
 * 
 * ✓ ragas [COMPOSITE METRIC]
 *   - Field requirements: query, output, expected_output, context(retrieval_context)
 *   - Use case: End-to-end RAG - combines faithfulness, contextual_precision, contextual_recall
 *   - Returns: Overall RAGAS score + component breakdown
 *   - Note: All fields are REQUIRED for RAGAS
 * 
 * Request body:
 * {
 *   metric: string (required) - evaluation metric name
 *   query?: string - the input question (required for most metrics)
 *   output?: string - LLM response (NOT required for contextual_precision/contextual_recall)
 *   context?: string[] - retrieval_context (required for context-based metrics)
 *   expected_output?: string - reference/expected answer (required for contextual_precision and contextual_recall)
 *   provider?: string - LLM provider (optional, defaults to 'groq')
 * }
 *
 * Response:
 * {
 *   metric: string,
 *   score: number (0-1),
 *   verdict: string (e.g., FAITHFUL, RELEVANT, HIGH_RECALL, HIGH_PRECISION, etc.),
 *   explanation: string (detailed reasoning with strict_mode=False for natural LLM judgment),
 *   query?: string,
 *   output?: string (not included for contextual metrics),
 *   context?: string[] (included when provided)
 * }
 * 
 * EXAMPLE: Contextual Recall
 * ---
 * POST /api/eval-only
 * {
 *   "metric": "contextual_recall",
 *   "query": "Salesforce login troubleshooting Steps",
 *   "expected_output": "Steps to resolve Salesforce login issues: verify username, reset password, check SSO/SAML, network/allowlist, lockout, MFA.",
 *   "context": [
 *     "Salesforce login error codes and fixes (invalid username/password, lockout, SSO).",
 *     "Admin guide: Resetting user passwords and unlocking users in Salesforce.",
 *     "Troubleshooting MFA login failures for Salesforce.",
 *     "Network & allowlist: Salesforce trust domains, firewall/proxy, TLS/cipher requirements."
 *   ]
 * }
 * 
 * Response:
 * {
 *   "metric": "contextual_recall",
 *   "score": 0.92,
 *   "verdict": "HIGH_RECALL",
 *   "explanation": "The retrieved context contains comprehensive information addressing all key points in the expected output...",
 *   "context": [...]
 * }
 */
router.post(
  "/eval-only",
  asyncHandler(async (req: Request, res: Response) => {
    const { query, output, context, metric, expected_output } = req.body;

    // Validation
    // Output is NOT required for contextual_precision and contextual_recall (context quality metrics)
    const effectiveMetric = metric || "answer_relevancy";
    const metricsNotRequiringOutput = ["contextual_precision", "contextual_recall"];
    
    if (!metricsNotRequiringOutput.includes(effectiveMetric) && !output) {
      return res.status(400).json({
        error: "Missing required field: output",
        helpText: `The '${effectiveMetric}' metric requires an 'output' field (LLM response). Exception: contextual_precision and contextual_recall do not require output.`,
        metric: effectiveMetric
      });
    }

    // ========== CONTEXTUAL RECALL SPECIFIC VALIDATION ==========
    if (effectiveMetric === "contextual_recall") {
      if (!expected_output) {
        return res.status(400).json({
          error: "Missing required field: expected_output",
          helpText: "contextual_recall metric requires 'expected_output' (the expected/reference answer) to evaluate if retrieved context contains all necessary information",
          example: {
            metric: "contextual_recall",
            expected_output: "Steps to resolve Salesforce login issues: verify username, reset password, check SSO/SAML, network/allowlist, lockout, MFA.",
            context: ["Salesforce login error codes..."]
          },
          metric: "contextual_recall"
        });
      }
      if (!context) {
        return res.status(400).json({
          error: "Missing required field: context",
          helpText: "contextual_recall metric requires 'context' (retrieval_context array) - list of retrieved documents to evaluate",
          metric: "contextual_recall"
        });
      }
      if (Array.isArray(context) && context.length === 0) {
        return res.status(400).json({
          error: "Context cannot be empty",
          helpText: "contextual_recall requires at least one context item in the 'context' array",
          metric: "contextual_recall"
        });
      }
    }

    // ========== CONTEXTUAL PRECISION SPECIFIC VALIDATION ==========
    if (effectiveMetric === "contextual_precision") {
      if (!query) {
        return res.status(400).json({
          error: "Missing required field: query",
          helpText: "contextual_precision metric requires 'query' (the user's question) to evaluate if retrieved documents are relevant to the question",
          metric: "contextual_precision"
        });
      }
      if (!expected_output) {
        return res.status(400).json({
          error: "Missing required field: expected_output",
          helpText: "contextual_precision metric requires 'expected_output' (the expected/reference answer) to evaluate context precision",
          metric: "contextual_precision"
        });
      }
      if (!context) {
        return res.status(400).json({
          error: "Missing required field: context",
          helpText: "contextual_precision metric requires 'context' (retrieval_context array) - list of retrieved documents to evaluate",
          metric: "contextual_precision"
        });
      }
      if (Array.isArray(context) && context.length === 0) {
        return res.status(400).json({
          error: "Context cannot be empty",
          helpText: "contextual_precision requires at least one context item in the 'context' array",
          metric: "contextual_precision"
        });
      }
    }

    // ========== RAGAS SPECIFIC VALIDATION ==========
    if (effectiveMetric === "ragas") {
      if (!query) {
        return res.status(400).json({
          error: "Missing required field: query",
          helpText: "RAGAS metric requires 'query' (the user's question) - composite RAG metric needs all components",
          metric: "ragas"
        });
      }
      if (!output) {
        return res.status(400).json({
          error: "Missing required field: output",
          helpText: "RAGAS metric requires 'output' (LLM response) for faithfulness evaluation",
          metric: "ragas"
        });
      }
      if (!context) {
        return res.status(400).json({
          error: "Missing required field: context",
          helpText: "RAGAS metric requires 'context' (retrieval_context array) for precision and recall evaluation",
          metric: "ragas"
        });
      }
      if (Array.isArray(context) && context.length === 0) {
        return res.status(400).json({
          error: "Context cannot be empty",
          helpText: "RAGAS metric requires at least one context item in the 'context' array",
          metric: "ragas"
        });
      }
      if (!expected_output) {
        return res.status(400).json({
          error: "Missing required field: expected_output",
          helpText: "RAGAS metric requires 'expected_output' (reference/ground truth answer) for all component metrics",
          example: {
            metric: "ragas",
            query: "How to reset Salesforce password?",
            expected_output: "Steps: 1) Login to admin console 2) Navigate to users 3) Click reset password",
            output: "To reset a Salesforce password, go to admin console and use password reset",
            context: ["Admin guide for Salesforce..."]
          },
          metric: "ragas"
        });
      }
    }

    if (effectiveMetric === "pii_leakage" && !query) {
      return res.status(400).json({
        error: "Missing required field: query (required for pii_leakage metric)",
        metric: "pii_leakage"
      });
    }
    if (effectiveMetric === "bias" && !query) {
      return res.status(400).json({
        error: "Missing required field: query (required for bias metric)",
        metric: "bias"
      });
    }
    if (effectiveMetric === "hallucination" && !query) {
      return res.status(400).json({
        error: "Missing required field: query (required for hallucination metric)",
        metric: "hallucination"
      });
    }
    if (effectiveMetric === "hallucination" && !context) {
      return res.status(400).json({
        error: "Missing required field: context (required for hallucination metric)",
        metric: "hallucination"
      });
    }
    if (effectiveMetric === "hallucination" && Array.isArray(context) && context.length === 0) {
      return res.status(400).json({
        error: "Context cannot be empty for hallucination metric (requires at least one context item)",
        metric: "hallucination"
      });
    }

    try {
      // Build evaluation parameters
      const evalParams: any = {
        metric: effectiveMetric,
        provider: req.body.provider || "groq",  // Use provider from request, default to groq
      };

      // Only include output if not a context-quality metric (contextual_precision, contextual_recall)
      if (!metricsNotRequiringOutput.includes(effectiveMetric) && output) {
        evalParams.output = output;
      }

      if (query) evalParams.query = query;
      if (context) evalParams.context = Array.isArray(context) ? context : [context];
      if (expected_output) evalParams.expected_output = expected_output;

      console.log(`🔍 DeepEval Evaluation Starting`);
      console.log(`📊 Metric: ${effectiveMetric}`);
      console.log(`📋 Full evalParams:`, JSON.stringify(evalParams, null, 2));
      if (query) console.log(`❓ Query: ${query.substring(0, 80)}...`);
      if (output) console.log(`💬 Output: ${output.substring(0, 80)}...`);
      if (expected_output) console.log(`✅ Expected Output: ${expected_output.substring(0, 80)}...`);
      if (context) {
        const contextArray = Array.isArray(context) ? context : [context];
        console.log(`📚 Context Items: ${contextArray.length}`);
        contextArray.forEach((ctx, idx) => {
          console.log(`   [${idx + 1}] ${ctx.substring(0, 60)}...`);
        });
      }

      // Evaluate using DeepEval service
      const evalResult = await evalWithFields(evalParams);

      console.log("✅ DeepEval Raw Response:", JSON.stringify(evalResult, null, 2));

      // Extract verdict from results array
      let verdict: string | undefined = undefined;
      
      if (evalResult.results && Array.isArray(evalResult.results) && evalResult.results.length > 0) {
        const firstResult = evalResult.results[0];
        verdict = firstResult.verdict;
        console.log("✓ Extracted verdict from results[0]:", verdict);
      }

      // Return in same format as RAGAS for frontend consistency
      const response: any = {
        metric: evalResult.metric_name || effectiveMetric,
        score: evalResult.score,
        verdict: verdict,  // Include verdict from results array
        explanation: evalResult.explanation,
      };

      // Include output only if it was provided and it's not a context-quality metric
      if (output && !metricsNotRequiringOutput.includes(effectiveMetric)) {
        response.output = output;
      }

      if (query) response.query = query;
      if (evalParams.context) response.context = evalParams.context;

      console.log("📤 Backend Response being sent to frontend:", JSON.stringify(response, null, 2));
      res.json(response);

    } catch (error) {
      console.error("❌ DeepEval evaluation error:", error);
      res.status(500).json({
        error: "DeepEval evaluation failed",
        details: error instanceof Error ? error.message : "Unknown error",
        metric: effectiveMetric,
        helpText: "Check that required fields are present for the selected metric and the DeepEval service is running"
      });
    }
  })
);



/**
 * GET /metrics
 * Get available evaluation metrics for training
 */
router.get("/metrics", async (req: Request, res: Response) => {
  try {
    // Fetch metrics info from Deepeval service
    const response = await fetch(`${ENV.DEEPEVAL_URL.replace('/eval', '/metrics-info')}`);
    const metricsInfo = await response.json();
    
    res.json({
      ...metricsInfo,
      usage_examples: {
        faithfulness: "Measures alignment with provided context - ideal for RAG systems",
        answer_relevancy: "Measures how well the answer addresses the question - good for QA systems"
      }
    });
  } catch (error) {
    res.status(500).json({
      error: "Could not fetch metrics information",
      available_metrics: ["faithfulness", "answer_relevancy"]
    });
  }
});

export default router;
