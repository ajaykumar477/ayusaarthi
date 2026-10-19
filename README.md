# 🌿 AyuSaarthi (आयुसारथी)

> **Intelligent RAG-Powered AI Assistant for AYUSH & Traditional Knowledge Systems**

AyuSaarthi is a full-stack, enterprise-grade Retrieval-Augmented Generation (RAG) platform tailored for the **AYUSH** ecosystem (*Ayurveda, Yoga & Naturopathy, Unani, Siddha, and Homoeopathy*). It provides grounded, source-attributed answers on Ayurvedic formulations, clinical guidelines, regulatory frameworks, Traditional Knowledge Digital Library (TKDL) references, and patent prior-art protection.

---

## 🌟 Key Features

- **Multilingual Support**: Query and receive verified responses in English, हिन्दी (Hindi), संस्कृतम् (Sanskrit), தமிழ் (Tamil), తెలుగు (Telugu), मराठी (Marathi), and বাংলা (Bengali), with intelligent auto-detection.
- **High-Precision RAG Engine**: Semantic vector search backed by [Qdrant Cloud](https://qdrant.tech/) and dense multilingual embeddings (`BAAI/bge-m3`).
- **Verified Source Attribution**: Direct citations with domain categorization, section references, provisions, similarity scores, and plain-language passage rewrites.
- **Custom Document Analysis**: Upload external research papers, patents, or clinical records (`.pdf`, `.docx`) for instant grounded analysis.
- **Advanced LLM Reasoning**: Integrated with NVIDIA NIM inference (`openai/gpt-oss-20b`), with fallbacks for OpenRouter and Google Gemini.
- **Export & Sharing**: One-click export of chat sessions and research summaries into formatted **Markdown** or Microsoft **Word (.docx)** documents.
- **Enterprise Controls**: In-memory sliding-window rate limiting, domain filtering, and customizable retrieval thresholds (`RAG_TOP_K`, `RAG_MIN_SCORE`).

---

## 🏗️ System Architecture

```text
[ User / Web Browser ]
         │
         ▼
[ Next.js 16 + React 19 Frontend ] (Port 3000)
    │                       │
    ▼                       ▼
[/api/upload]         [/api/rag] ──────────► [NVIDIA NIM / LLM API]
 (PDF/DOCX Parser)          │
                            ▼
          ┌─────────────────┴─────────────────┐
          │                                   │
          ▼                                   ▼
 [FastAPI Embedding Server]         [Qdrant Vector DB]
  (BAAI/bge-m3 on Port 8001)         (ayusaarthi_chunks_v2)
```

---

## 📋 Prerequisites

Before running the application, make sure you have the following installed:

- **Node.js**: `v18.18.0` or later (Node 20+ recommended)
- **npm**: `v9.0.0` or later
- **Python**: `3.10` or `3.11`
- **Qdrant Cloud Account**: Cluster URL and API key
- **NVIDIA API Key**: From [NVIDIA NIM / Build](https://build.nvidia.com) (or OpenRouter / Gemini API key)

---

## 🚀 How to Run the Application Locally

Follow these steps to get both the Python embedding backend and the Next.js frontend running.

### Step 1: Clone or Navigate to the Project

```bash
cd ayusaarthi-app
```

### Step 2: Set Up & Run the Python Embedding Server

The application uses `BAAI/bge-m3` via FastAPI to generate dense vector embeddings matching the Qdrant index.

1. **Create and activate a virtual environment:**
   - **Windows (PowerShell):**
     ```powershell
     python -m venv venv
     .\venv\Scripts\Activate.ps1
     ```
   - **Linux / macOS:**
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

2. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Start the embedding server:**
   ```bash
   python -m uvicorn embed_server:app --port 8001
   ```
   *The server will start at `http://localhost:8001`.* Keep this terminal window running.

---

### Step 3: Configure Environment Variables

1. Copy the sample environment file:
   - **Windows:**
     ```powershell
     copy .env.example .env.local
     ```
   - **Linux / macOS:**
     ```bash
     cp .env.example .env.local
     ```

2. Open `.env.local` and provide your credentials:
   ```env
   # Qdrant Cloud
   QDRANT_URL=https://<your-cluster-id>.<region>.gcp.cloud.qdrant.io:6333
   QDRANT_API_KEY=your_qdrant_api_key_here
   COLLECTION_NAME=ayusaarthi_chunks_v2

   # Local Embedding Server
   EMBEDDING_API_URL=http://localhost:8001/v1/embeddings
   EMBEDDING_API_KEY=local
   EMBEDDING_MODEL=BAAI/bge-m3

   # LLM Reasoning (NVIDIA NIM)
   NVIDIA_API_KEY=nvapi-your-key-here
   NVIDIA_FAST_MODELS=openai/gpt-oss-20b
   ```

---

### Step 4: Install Dependencies & Run the Next.js App

Open a **new terminal window** in the project root:

1. **Install Node.js packages:**
   ```bash
   npm install
   ```

2. **Run the development server:**
   ```bash
   npm run dev
   ```

3. **Open the application:**
   Navigate to [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 📁 Project Structure

```text
ayusaarthi-app/
├── embed_server.py          # FastAPI service hosting BAAI/bge-m3 embeddings
├── requirements.txt         # Python dependencies for the embedding server
├── package.json             # Next.js dependencies & scripts
├── .env.example             # Template for required environment variables
├── .gitignore               # Configured to protect secrets, venv, and builds
├── public/                  # Static assets and icons
└── src/
    ├── app/
    │   ├── api/
    │   │   ├── rag/         # RAG query processing & LLM streaming
    │   │   ├── upload/      # PDF & DOCX text extraction
    │   │   ├── export/      # Document export (Markdown & DOCX)
    │   │   ├── domains/     # Knowledge domain endpoints
    │   │   └── clean/       # Formatting & post-processing
    │   ├── layout.tsx       # Root layout & metadata
    │   └── page.tsx         # Main application entry
    ├── components/
    │   ├── Chat.tsx         # Interactive multilingual chat interface
    │   └── chat.css         # Custom UI styles and transitions
    └── lib/
        ├── embeddings.ts    # Client for embedding generation
        ├── nvidia.ts        # NVIDIA NIM / LLM integration logic
        ├── qdrant.ts        # Qdrant vector search & payload mapping
        └── ratelimit.ts     # Request rate limiter
```

---

## 📤 Steps to Upload this Project to GitHub

Here is the complete guide to initialize git and publish your repository to GitHub.

### Step 1: Verify `.gitignore`
Make sure `.env*.local` and your virtual environment folder (`venv/`) are ignored so your private API keys are **never** committed:
```bash
git status
```
*(Files like `.env.local` and `venv/` should NOT appear in untracked files).*

### Step 2: Initialize Git & Commit Files
Run the following commands in the project root directory:

```bash
# 1. Initialize git
git init

# 2. Add all project files
git add .

# 3. Create initial commit
git commit -m "Initial commit: AyuSaarthi AYUSH RAG platform"
```

### Step 3: Create a Repository on GitHub
1. Go to [GitHub](https://github.com/new).
2. Enter a repository name (e.g., `ayusaarthi-app`).
3. Set visibility to **Public** or **Private**.
4. **Do NOT** check "Add a README file", ".gitignore", or "Choose a license" (we already have them).
5. Click **Create repository**.

### Step 4: Link Remote & Push to GitHub
Copy your repository URL from GitHub (replace `<YOUR-USERNAME>` and `<YOUR-REPO>` below) and run:

```bash
# 1. Rename the default branch to main
git branch -M main

# 2. Add your GitHub repository as remote origin
git remote add origin https://github.com/<YOUR-USERNAME>/<YOUR-REPO>.git

# 3. Push your code to GitHub
git push -u origin main
```

---

## 🔒 Security Best Practices

- **Never push `.env.local`**: It contains sensitive credentials (`QDRANT_API_KEY`, `NVIDIA_API_KEY`). Only `.env.example` should be committed.
- **Production Deployment**: If deploying to Vercel or cloud providers, set the environment variables in the provider's project settings dashboard.

---

## ⚖️ Disclaimer

AyuSaarthi is an AI-powered decision-support and knowledge-retrieval tool. It is intended for educational, research, and informational reference in AYUSH sciences and regulatory frameworks. It does not substitute professional medical advice, clinical diagnosis, or certified legal counsel.#   a y u s a a r t h i  
 