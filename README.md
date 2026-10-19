# 🌿 AyuSaarthi (आयुसारथी)

### Intelligent RAG-Powered AI Assistant for AYUSH & Traditional Knowledge Systems

**AyuSaarthi** is a full-stack, AI-powered Retrieval-Augmented Generation (RAG) platform designed for the AYUSH ecosystem — Ayurveda, Yoga & Naturopathy, Unani, Siddha, and Homoeopathy.

It delivers context-aware, source-attributed answers using a multilingual retrieval pipeline and large language models, helping researchers, students, practitioners, and regulatory professionals explore traditional knowledge, clinical guidelines, regulatory frameworks, and patent prior art.

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Technology Stack](#-technology-stack)
- [System Architecture](#️-system-architecture)
- [Prerequisites](#-prerequisites)
- [Installation and Setup](#-installation-and-setup)
- [Environment Variables](#-environment-variables)
- [Project Structure](#-project-structure)
- [GitHub Deployment](#-uploading-the-project-to-github)
- [Security Best Practices](#-security-best-practices)
- [Disclaimer](#️-disclaimer)

---

## 🌟 Overview

AyuSaarthi combines semantic search, multilingual embeddings, vector database retrieval, and LLM-based response generation to provide grounded answers from a specialized knowledge base.

The platform is designed to support:

- AYUSH research and traditional knowledge exploration.
- Retrieval of relevant regulatory provisions and guidelines.
- Research paper and patent document analysis.
- Source-backed question answering with relevant document passages.
- Multilingual interaction across Indian languages.
- Knowledge discovery for research and intellectual property protection.

## ✨ Key Features

### 🌐 1. Multilingual AI Assistant

Supports queries and responses in:

- English
- हिन्दी (Hindi)
- संस्कृतम् (Sanskrit)
- தமிழ் (Tamil)
- తెలుగు (Telugu)
- मराठी (Marathi)
- বাংলা (Bengali)

The system is designed for automatic language detection and multilingual retrieval.

### 🔎 2. High-Precision RAG Engine

- Semantic vector search using [Qdrant Cloud](https://qdrant.tech/).
- Multilingual embeddings powered by `BAAI/bge-m3`.
- Context retrieval from indexed knowledge-base chunks.
- Configurable retrieval parameters, including `RAG_TOP_K` and `RAG_MIN_SCORE`.

### 📚 3. Source Attribution and Grounded Responses

- Relevant retrieved passages for answer generation.
- Source references and document metadata.
- Domain categorization and section-level references when available.
- Similarity scores for retrieved passages.
- Simplified explanations of technical and regulatory content.

### 📄 4. Custom Document Analysis

Upload supported external documents for contextual analysis:

- PDF (`.pdf`)
- Microsoft Word (`.docx`)

The upload pipeline extracts document text for analysis. Support for indexing uploaded documents into the persistent knowledge base depends on the implemented ingestion workflow.

### 🧠 5. Advanced LLM Integration

Supports integration with:

- NVIDIA NIM — `openai/gpt-oss-20b`
- OpenRouter
- Google Gemini

Provider selection and fallback behavior depend on the configured integration logic.

### 📤 6. Export and Sharing

Export chat sessions and research summaries into:

- Markdown (`.md`)
- Microsoft Word (`.docx`)

### 🛡️ 7. Application Controls

- In-memory sliding-window rate limiting.
- Domain filtering for retrieval.
- Configurable retrieval thresholds.
- Environment-based API credential management.

---

## 🧰 Technology Stack

| Component | Technology |
|---|---|
| Frontend | Next.js 16, React 19 |
| Language | TypeScript, Python |
| Styling | CSS |
| Backend API | Next.js Route Handlers |
| Embedding Service | FastAPI |
| Embedding Model | `BAAI/bge-m3` |
| Vector Database | Qdrant Cloud |
| LLM Inference | NVIDIA NIM |
| Alternative LLM Providers | OpenRouter, Google Gemini |
| Document Processing | PDF and DOCX parsing |
| Package Management | npm, pip |
| Version Control | Git and GitHub |

---

## 🏗️ System Architecture

```text
                  ┌──────────────────────────┐
                  │     User / Browser       │
                  └────────────┬─────────────┘
                               │
                               ▼
                  ┌──────────────────────────┐
                  │ Next.js 16 + React 19    │
                  │ Frontend (Port 3000)     │
                  └────────────┬─────────────┘
                               │
                   ┌───────────┴───────────┐
                   │                       │
                   ▼                       ▼
          ┌─────────────────┐    ┌──────────────────┐
          │  /api/upload    │    │    /api/rag      │
          │  PDF/DOCX Parse │    │ Query Processing │
          └─────────────────┘    └────────┬─────────┘
                                          │
                              ┌───────────┴──────────┐
                              │                      │
                              ▼                      ▼
                    ┌─────────────────┐    ┌─────────────────┐
                    │ FastAPI          │    │ Qdrant Cloud    │
                    │ Embedding Server │    │ Vector Database │
                    │ Port 8001        │    │                 │
                    └─────────────────┘    └─────────────────┘
                                                   │
                                                   ▼
                                        ┌────────────────────┐
                                        │ Retrieved Context   │
                                        └─────────┬──────────┘
                                                  │
                                                  ▼
                                        ┌────────────────────┐
                                        │ NVIDIA NIM / LLM   │
                                        │ Response Generation│
                                        └─────────┬──────────┘
                                                  │
                                                  ▼
                                        ┌────────────────────┐
                                        │ Grounded Response  │
                                        │ + Source References│
                                        └────────────────────┘
```

### RAG Workflow

1. **User Query:** The user submits a question through the web interface.
2. **Embedding Generation:** The embedding service converts the query into a vector using the configured embedding model.
3. **Semantic Retrieval:** Qdrant searches the indexed knowledge base for relevant document chunks.
4. **Context Preparation:** Retrieved passages and available metadata are assembled into the LLM context.
5. **Answer Generation:** The configured LLM generates a response grounded in the retrieved context.
6. **Source Attribution:** Relevant source references and metadata are returned to the frontend.

---

## 📋 Prerequisites

Install or obtain the following before running the application:

- **Node.js:** Version 20 or later recommended.
- **npm:** Version 9 or later.
- **Python:** Version 3.10 or 3.11.
- **Qdrant Cloud:** Cluster URL and API key.
- **NVIDIA API Key:** Obtain access through [NVIDIA Build](https://build.nvidia.com/), or configure an alternative supported LLM provider.
- **Git:** Required for version control and GitHub publishing.

> **Note:** Verify that your installed Node.js version satisfies the requirements of your project's Next.js version.

---

## 🚀 Installation and Setup

### Step 1: Navigate to the Project

Open a terminal in your project directory:

```bash
cd ayusaarthi-app
```

### Step 2: Set Up the Python Embedding Server

#### 2.1 Create a virtual environment

**Windows PowerShell**

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

If PowerShell blocks activation, review your execution policy or activate the environment using an alternative supported method.

**Linux / macOS**

```bash
python3 -m venv venv
source venv/bin/activate
```

#### 2.2 Install Python dependencies

```bash
pip install -r requirements.txt
```

#### 2.3 Start the embedding server

```bash
python -m uvicorn embed_server:app --port 8001
```

The service should be available at:

```text
http://localhost:8001
```

Keep this terminal running while using the application.

### Step 3: Configure Environment Variables

Create your local environment file.

**Windows PowerShell**

```powershell
Copy-Item .env.example .env.local
```

**Linux / macOS**

```bash
cp .env.example .env.local
```

Open `.env.local` and configure the required values:

```dotenv
# Qdrant Cloud
QDRANT_URL=https://<your-cluster-id>.<region>.gcp.cloud.qdrant.io:6333
QDRANT_API_KEY=your_qdrant_api_key_here
COLLECTION_NAME=ayusaarthi_chunks_v2

# Local Embedding Server
EMBEDDING_API_URL=http://localhost:8001/v1/embeddings
EMBEDDING_API_KEY=local
EMBEDDING_MODEL=BAAI/bge-m3

# LLM Provider: NVIDIA NIM
NVIDIA_API_KEY=your_nvidia_api_key_here
NVIDIA_FAST_MODELS=openai/gpt-oss-20b
```

Replace all example credentials and the Qdrant endpoint with your actual configuration.

**Important:** The embedding endpoint and model configuration must match the implementation in `embed_server.py` and `src/lib/embeddings.ts`.

### Step 4: Install Frontend Dependencies

Open a second terminal in the project root and run:

```bash
npm install
```

### Step 5: Start the Next.js Application

```bash
npm run dev
```

Open your browser and navigate to:

**http://localhost:3000**

Both the Next.js application and the Python embedding server must be running for functionality that depends on them.

---

## 🔐 Environment Variables

| Variable | Purpose |
|---|---|
| `QDRANT_URL` | Qdrant Cloud cluster endpoint |
| `QDRANT_API_KEY` | Authentication for Qdrant |
| `COLLECTION_NAME` | Name of the vector collection |
| `EMBEDDING_API_URL` | Embedding service endpoint |
| `EMBEDDING_API_KEY` | Credential expected by the embedding client |
| `EMBEDDING_MODEL` | Embedding model identifier |
| `NVIDIA_API_KEY` | NVIDIA NIM authentication |
| `NVIDIA_FAST_MODELS` | Configured model identifier |

Optional settings may include:

- `RAG_TOP_K` — Maximum number of retrieved chunks.
- `RAG_MIN_SCORE` — Minimum retrieval similarity threshold.

Configure optional variables only if they are supported by your application code.

---

## 📁 Project Structure

```text
ayusaarthi-app/
│
├── embed_server.py
├── requirements.txt
├── package.json
├── .env.example
├── .gitignore
│
├── public/
│   └── Static assets and icons
│
└── src/
    ├── app/
    │   ├── api/
    │   │   ├── rag/
    │   │   │   └── RAG query processing
    │   │   ├── upload/
    │   │   │   └── PDF and DOCX parsing
    │   │   ├── export/
    │   │   │   └── Markdown and DOCX export
    │   │   ├── domains/
    │   │   │   └── Knowledge domain endpoints
    │   │   └── clean/
    │   │       └── Formatting and post-processing
    │   │
    │   ├── layout.tsx
    │   └── page.tsx
    │
    ├── components/
    │   ├── Chat.tsx
    │   └── chat.css
    │
    └── lib/
        ├── embeddings.ts
        ├── nvidia.ts
        ├── qdrant.ts
        └── ratelimit.ts
```

*The tree describes the intended project layout; adjust it to match the files actually present in your repository.*

---

## 🐙 Uploading the Project to GitHub

### Step 1: Verify `.gitignore`

Ensure your `.gitignore` excludes private credentials, virtual environments, and build artifacts.

```gitignore
node_modules/
.next/
venv/
__pycache__/
*.py[cod]
.env
.env.*
!.env.example
dist/
build/
```

If your project requires other environment files, adjust these rules carefully. Never commit real credentials.

Check the current repository status:

```bash
git status
```

Confirm that `.env.local`, API keys, and the `venv/` directory are not staged for publication.

### Step 2: Initialize Git

Run these commands from the project root:

```bash
git init
git add .
git status
git commit -m "Initial commit: AyuSaarthi AYUSH RAG platform"
```

Review the staged files before committing.

### Step 3: Create a GitHub Repository

1. Visit [GitHub — Create a New Repository](https://github.com/new).
2. Enter `ayusaarthi-app` as the repository name.
3. Choose **Public** or **Private** visibility.
4. If the project already contains a README, `.gitignore`, and license, leave the corresponding initialization options unchecked.
5. Create the repository.

### Step 4: Connect the Remote Repository

Replace the placeholders with your actual GitHub username and repository name:

```bash
git branch -M main
git remote add origin https://github.com/<YOUR-USERNAME>/<YOUR-REPO>.git
git push -u origin main
```

If an `origin` remote already exists, inspect it using `git remote -v` before adding another.

---

## 🔒 Security Best Practices

- **Protect API keys:** Never commit `.env.local` or other files containing real credentials.
- **Use environment variables:** Store production secrets in your deployment provider's secret-management settings.
- **Secure uploads:** Validate file types and sizes, handle parsing errors, and avoid trusting uploaded document content.
- **Apply server-side controls:** Enforce authentication and authorization if the platform handles private or sensitive documents.
- **Review rate limiting:** In-memory rate limits may reset on restart and may not be shared across multiple server instances.
- **Protect sensitive research:** Define appropriate access controls, retention policies, and deletion procedures for uploaded documents.
- **Use HTTPS in production:** Secure traffic between the frontend, embedding service, database, and inference provider.
- **Rotate exposed credentials:** If a secret is accidentally published, revoke or rotate it immediately.

---

## 🗺️ Future Enhancements

Potential directions for future development include:

- Graph-based knowledge retrieval using Neo4j.
- Hybrid search combining dense vectors and keyword retrieval.
- Improved reranking and retrieval evaluation.
- Document ingestion pipelines with provenance tracking.
- Role-based access control and user authentication.
- Audit logs and administrative analytics.
- Expanded multilingual evaluation and response-quality testing.
- Deployment using Docker and cloud infrastructure.

These are potential enhancements, not claims that the features are already implemented.

---

## ⚖️ Disclaimer

AyuSaarthi is an AI-powered knowledge retrieval and decision-support platform intended for educational, research, and informational use in AYUSH sciences, traditional knowledge, and regulatory frameworks.

It does not replace professional medical advice, clinical diagnosis, treatment decisions, or qualified legal counsel. AI-generated responses may contain errors or incomplete information. Users should verify important claims against authoritative source documents and consult qualified professionals where appropriate.

**Traditional knowledge, clinical information, and regulatory interpretations should always be validated against their original sources.**

---

## 📄 License

A license has not been specified yet. Add a `LICENSE` file before distributing the project publicly, and select a license appropriate to your intended use and ownership.

---

**AyuSaarthi — Bridging Traditional Knowledge and Modern AI.** 🌿
