# 🚀 RAGAS Evaluation System

Multi-tier RAG evaluation system with React frontend, Node.js backend, and Python RAGAS server.

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────┐
│  React Frontend (Vite)                                  │
│  http://localhost:5174                                  │
│  - Testleaf-themed UI                                   │
│  - Metric selection (faithfulness, context_precision,   │
│    context_recall)                                      │
│  - Query, Output, Context inputs                        │
│  - Response display panel                               │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ↓ POST /ragas/eval-only
┌─────────────────────────────────────────────────────────┐
│  Node.js Backend (Express + TypeScript)                 │
│  http://localhost:5174/api                              │
│  - Routes RAGAS evaluation requests                     │
│  - Forwards to Python RAGAS server                      │
│  - CORS enabled                                         │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ↓ Forward to RAGAS server
┌─────────────────────────────────────────────────────────┐
│  Python RAGAS Server (FastAPI)                          │
│  http://localhost:8001                                  │
│  - Runs RAGAS metrics evaluation                        │
│  - Uses Groq/OpenAI LLM                                 │
│  - Returns scores and verdicts                          │
└─────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
RAGAS/
├── frontend/                    # React + Vite (Port 5174)
│   ├── src/
│   │   ├── App.tsx
│   │   ├── index.tsx
│   │   ├── pages/
│   │   │   └── RagasEvalPage.tsx
│   │   ├── components/
│   │   │   └── Ragaseval/
│   │   │       ├── RagasEvalForm.tsx
│   │   │       ├── ContextList.tsx
│   │   │       ├── ResponsePanel.tsx
│   │   │       └── types.ts
│   │   └── styles/
│   │       └── testleaf-theme.css
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                     # Node.js + Express (Port 5174)
│   ├── src/
│   │   ├── index.ts            # Main server
│   │   ├── routes/             # API routes
│   │   ├── services/           # Business logic
│   │   └── config/             # Configuration
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
│
├── python/                      # FastAPI + RAGAS (Port 8001)
│   ├── ragas_server_updated.py  # RAGAS evaluation endpoint
│   ├── requirements.txt
│   └── .env
│
├── package.json                 # Root - orchestration
├── .env.example                 # Environment template
└── README.md                    # This file
```

## 🚀 Quick Start

### 1️⃣ Install All Dependencies

```bash
npm run install:all
```

This installs dependencies for:
- Root (concurrently)
- Frontend
- Backend
- Python RAGAS

### 2️⃣ Setup Environment Variables

Copy the template:
```bash
cp .env.example backend/.env
cp .env.example python/.env
```

Edit `backend/.env` and `python/.env`:
```env
# backend/.env
PORT=5174
RAGAS_URL=http://localhost:8001

# python/.env
GROQ_API_KEY=your_actual_key_here
EVAL_MODEL=mixtral-8x7b-32768
```

### 3️⃣ Run Everything Together

```bash
npm run dev
```

This starts all three services concurrently:
- ✅ Frontend (http://localhost:5174)
- ✅ Backend (routes to /api)
- ✅ Python RAGAS (http://localhost:8001)

---

## 📡 Commands

### Development

| Command | What it does |
|---------|-------------|
| `npm run install:all` | Install deps for all 3 services |
| `npm run dev` | Start frontend + backend + python |
| `npm run dev:frontend` | Frontend only |
| `npm run dev:backend` | Backend only |
| `npm run dev:python` | Python RAGAS only |

### Production

| Command | What it does |
|---------|-------------|
| `npm run build` | Build frontend + backend |
| `npm run build:frontend` | Build frontend only |
| `npm run build:backend` | Build backend only |
| `npm start` | Start backend + python |
| `npm run start:frontend` | Start frontend preview |

### Individual Services

```bash
# Frontend
cd frontend && npm run dev

# Backend
cd backend && npm run dev

# Python
cd python && python ragas_server_updated.py
```

---

## 📋 API Endpoints

### Frontend → Backend

**POST `/ragas/eval-only`**

Request:
```json
{
  "metric": "faithfulness|context_precision|context_recall",
  "query": "Your question?",
  "output": "LLM generated answer",
  "context": [
    "Retrieved document 1",
    "Retrieved document 2"
  ],
  "reference": "Optional ground truth answer"
}
```

Response:
```json
{
  "metric": "faithfulness",
  "score": 0.85,
  "verdict": "FAITHFUL",
  "explanation": "Output is faithful to context...",
  "reference_used": "..."
}
```

### Backend → Python RAGAS

Backend forwards the same request to:
```
POST http://localhost:8001/ragas/eval-only
```

---

## ⚙️ Configuration

### Frontend (.env)
```env
VITE_API_URL=http://localhost:5174  # Backend URL
```

### Backend (.env)
```env
PORT=5174                           # Backend port
RAGAS_URL=http://localhost:8001     # Python RAGAS server
NODE_ENV=development
```

### Python (.env)
```env
RAGAS_PORT=8001                     # Python server port
GROQ_API_KEY=your_key              # Groq LLM API key
EVAL_MODEL=mixtral-8x7b-32768      # Model to use
```

---

## 🎨 UI Features

### Testleaf Theme
- Green gradient header
- Subtle radial background
- White cards with soft shadows
- Clean input styling
- Responsive layout

### Form Controls
- **Metric Dropdown**: faithfulness, context_precision, context_recall
- **Query Input**: User's question
- **Output Textarea**: LLM generated answer
- **Context Manager**: Add/delete multiple context chunks
- **Evaluate Button**: Trigger evaluation
- **Response Panel**: Display results

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Check what's using port 5174
lsof -i :5174

# Kill the process
kill -9 <PID>
```

### RAGAS Server Not Connecting
1. Ensure Python is running: `python ragas_server_updated.py`
2. Check `RAGAS_URL` in `backend/.env`
3. Verify Python dependencies: `pip install -r python/requirements.txt`

### Dependencies Not Installing
```bash
# Clear cache
rm -rf node_modules package-lock.json
cd frontend && rm -rf node_modules package-lock.json
cd ../backend && rm -rf node_modules package-lock.json

# Reinstall
npm run install:all
```

### Frontend Can't Connect to Backend
1. Ensure backend is running: `npm run dev:backend`
2. Check `VITE_API_URL` in frontend `.env`
3. Verify backend is on port 5174

---

## 📦 Dependencies

### Frontend
- React 18
- TypeScript 5
- Vite 5
- Axios (API calls)

### Backend
- Express 4
- TypeScript 5
- Axios (RAGAS forwarding)
- CORS (cross-origin support)

### Python
- FastAPI (web server)
- RAGAS (evaluation metrics)
- LangChain (LLM integration)
- Groq/OpenAI (LLM providers)

---

## 🔄 Data Flow

1. **Frontend Form** → User enters query, output, context
2. **Frontend State** → `RagasEvalForm` manages form state
3. **API Call** → Axios POST to `http://localhost:5174/ragas/eval-only`
4. **Backend Route** → Express receives request
5. **RAGAS Forward** → Backend forwards to `http://localhost:8001/ragas/eval-only`
6. **Python Evaluation** → RAGAS metrics calculated
7. **Response** → Results returned through backend to frontend
8. **Display** → `ResponsePanel` renders scores and verdict

---

## 📝 Notes

- **Frontend**: Port 5174 (Vite dev server)
- **Backend**: Port 5174 (serves via Express)
- **Python**: Port 8001 (FastAPI server)
- **API**: Mounted at `/ragas/eval-only`
- **LLM**: Defaults to Groq (faster, free tier available)

---

## ✨ Next Steps

- [x] STEP-1: Build UI + Testleaf theme
- [ ] STEP-2: Wire API calls (Axios integration)
- [ ] STEP-3: Add reference/expected output support
- [ ] STEP-4: Error handling & loading states
- [ ] STEP-5: Production deployment

---

## 📞 Support

If services won't start:
1. Check all `.env` files exist and have correct values
2. Ensure ports 5174 and 8001 are free
3. Verify Python 3.10+ and Node.js 18+ installed
4. Run `npm run install:all` to ensure all deps installed

---

**Happy evaluating! 🎉**
