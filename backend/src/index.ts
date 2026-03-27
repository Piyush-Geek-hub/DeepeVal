import express, { Request, Response, NextFunction } from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import evalRoutes from "./routes/evalRoutes.js";
import batchRoutes from "./routes/batchRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load .env from root directory
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = express();

// Configuration from .env
const PORT = process.env.PORT || 5174;
const RAGAS_URL = process.env.RAGAS_URL || "http://localhost:8001";
const NODE_ENV = process.env.NODE_ENV || "development";

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Mount evaluation routes (from evalRoutes.ts)
app.use("/api", evalRoutes);

// Mount batch evaluation routes (from batchRoutes.ts)
app.use("/api", batchRoutes);

// ============================================
// HEALTH CHECK
// ============================================
app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "healthy",
    service: "Testleaf LLM Evaluation Framework",
    message: "Multi-provider evaluation API is running",
    version: "1.0.0",
    environment: NODE_ENV,
    providers: {
      ragas: {
        status: "active",
        metrics: ["faithfulness", "context_precision", "context_recall"],
        endpoint: "/api/ragas/eval-only"
      },
      deepeval: {
        status: "active",
        metrics: ["faithfulness", "answer_relevancy", "contextual_precision", "contextual_recall", "pii_leakage", "bias", "hallucination", "ragas"],
        endpoint: "/api/eval-only"
      }
    },
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// RAGAS EVALUATION ENDPOINT
// ============================================
// LLM Evaluation using RAGAS provider
app.post("/api/ragas/eval-only", async (req: Request, res: Response) => {
  try {
    console.log("📊 [RAGAS] Evaluation Request:", {
      metric: req.body.metric,
      query: req.body.query?.substring(0, 50) + "...",
      contextCount: req.body.context?.length,
    });

    // Validate request
    if (!req.body.metric || !req.body.query || !req.body.output || !req.body.context) {
      console.warn("⚠️ [RAGAS] Missing required fields");
      return res.status(400).json({
        error: "Validation Error",
        message: "Missing required fields for RAGAS evaluation",
        required: ["metric", "query", "output", "context"],
        provider: "ragas"
      });
    }

    // Forward to Python RAGAS server
    const response = await axios.post(
      `${RAGAS_URL}/ragas/eval-only`,
      req.body,
      {
        timeout: 60000, // 60 second timeout
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ [RAGAS] Evaluation completed successfully");
    console.log(`   └─ Metric: ${response.data.metric}, Score: ${response.data.score}`);

    res.json({
      ...response.data,
      provider: "ragas",
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("❌ [RAGAS] Evaluation failed:", error.message);

    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.details || error.message;

    res.status(statusCode).json({
      error: "RAGAS Evaluation Failed",
      message: "Failed to evaluate using RAGAS provider",
      details: errorMessage,
      provider: "ragas",
      ragas_url: RAGAS_URL,
    });
  }
});

// ============================================
// GET AVAILABLE METRICS
// ============================================
app.get("/api/ragas/metrics", async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${RAGAS_URL}/ragas/metrics`);
    res.json(response.data);
  } catch (error: any) {
    console.error("❌ Failed to fetch metrics:", error.message);
    res.status(500).json({
      error: "Failed to fetch metrics",
      details: error.message,
      available_metrics: ["faithfulness", "context_precision", "context_recall"],
    });
  }
});

// ============================================
// BACKEND STATUS
// ============================================
app.get("/api/status", (req: Request, res: Response) => {
  res.json({
    service: "Testleaf LLM Evaluation Framework",
    version: "1.0.0",
    backend: {
      status: "running",
      port: PORT,
      environment: NODE_ENV,
    },
    providers: {
      ragas: {
        url: RAGAS_URL,
        status: "configured",
        metrics: ["faithfulness", "context_precision", "context_recall"]
      },
      deepeval: {
        status: "configured",
        metrics: ["faithfulness", "answer_relevancy", "contextual_precision", "contextual_recall", "pii_leakage", "bias", "hallucination", "ragas"]
      }
    },
    endpoints: {
      health: "GET /health",
      ragas: "POST /api/ragas/eval-only",
      deepeval: "POST /api/eval-only",
      metrics: "GET /api/ragas/metrics",
      status: "GET /api/status",
    },
  });
});

// ============================================
// 404 HANDLER
// ============================================
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: "Endpoint not found",
    path: req.path,
    method: req.method,
    availableEndpoints: {
      health: "GET /health",
      deepeval: "POST /api/eval-only",
      evaluate: "POST /api/ragas/eval-only",
      metrics: "GET /api/ragas/metrics",
      status: "GET /api/status",
    },
  });
});

// ============================================
// GLOBAL ERROR HANDLER
// ============================================
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  console.error("[ERROR]", err);

  const error = err as Error & { status?: number };
  const status = error.status || 500;
  const message = error.message || "Internal Server Error";

  res.status(status).json({
    error: message,
    status,
    environment: NODE_ENV,
    ...(NODE_ENV === "development" && { stack: error.stack }),
  });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log('🚀 ═══════════════════════════════════════════════════');
  console.log('🤖 Testleaf LLM Evaluation Framework Backend');
  console.log('🚀 ═══════════════════════════════════════════════════');
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log('📊 Available Providers:');
  console.log(`   ├─ RAGAS: http://localhost:${PORT}/api/ragas/eval-only`);
  console.log(`   └─ DeepEval: http://localhost:${PORT}/api/eval-only`);
  console.log('🚀 ═══════════════════════════════════════════════════');
});

export default app;