# Prept AI Interview Preparation Platform

Prept is an intelligent, low-latency, and cost-optimized AI interview simulation platform. It bridges the gap between passive algorithmic practice and high-stakes technical communication through dynamic resume deep-dives, real-time vocal and emotional telemetry, structured behavioral and technical tracks, and comprehensive post-session evaluation reports.

---

## Live Deployment & Preview

* **Production URL**: [https://prept-coach.vercel.app](https://prept-coach.vercel.app)
* **GitHub Repository**: [https://github.com/AG0606/Prept](https://github.com/AG0606/Prept)
* **Release Version**: `v1.0.0`

---

## Core Capabilities

### 1. Resume Deep-Dive & Question Caching
* **Structured PDF Parsing**: Extracts work experience, technical competencies, education, and open source projects from uploaded candidate resumes.
* **Instant Extraction HUD**: Real-time evaluation rating badge, top skill chips, and actionable highlight recommendations immediately after upload.
* **Persistent Question Bank (`/api/resume-questions`)**: Pre-generates 5 to 8 deep-probing questions per resume and target role. These questions are cached in SQLite/Prisma to eliminate redundant LLM generation calls across repeat practice sessions.

### 2. Low-Token Unified Agent Orchestrator (`/api/agent-turn`)
* **Single-Inference Turn Architecture**: Merges candidate response scoring, sentiment analysis, and next question generation into 1 single LLM call per turn.
* **Cost & Latency Reduction**: Reduces per-turn external API calls from 5 to 3 (`transcribe` -> `agent-turn` -> `tts`), cutting token consumption by ~40% and response latency by ~50%.
* **Zero-Cost Local Telemetry**: Speech pace (WPM), audio loudness (dB), and filler word densities are processed locally in real time via the Web Audio API and Web Speech API.

### 3. Multi-Tier Dynamic Load Balancer (`lib/loadBalancer.ts`)
* **Automated Rate Tracking**: Monitors rolling requests-per-minute (RPM) and requests-per-day (RPD) across providers.
* **Intelligent Failover**: Prioritizes Groq Cloud (`llama-3.3-70b-versatile`) for sub-second responses, seamlessly falling back to Google Gemini (`gemini-flash-latest`) when approaching quotas or during upstream service spikes.

### 4. Real-Time Telemetry & Facial Expression HUD
* **Vocal Pace & Volume Tracking**: Visual audio waveform and speaking rate indicators updated every 500ms.
* **Facial Emotion Recognition**: Browser-native webcam tracking powered by `face-api.js` to detect composure, engagement, and confidence.
* **STAR Framework Alignment**: Real-time evaluation of Situation, Task, Action, and Result structured communication.

### 5. Actionable Post-Session Evaluation Reports
* **Comprehensive Performance Breakdown**: Overall score, turn-by-turn question summaries, key strengths, gap analysis, and tailored recommendations.
* **Historical Tracking**: Stores completed sessions in the database for candidate progress analysis over time.

---

## System Architecture & Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Core** | Next.js 14 (App Router), React 18, TypeScript |
| **Styling & Theme** | Tailwind CSS, CSS Custom Properties (Strict Brutalist Design System), Framer Motion |
| **AI Orchestration** | Groq Cloud (`llama-3.3-70b-versatile`), Google Gemini (`gemini-flash-latest`) |
| **Speech-to-Text (STT)** | Groq Cloud Hosted Whisper (`whisper-large-v3`), Web Speech API fallback |
| **Text-to-Speech (TTS)** | Microsoft Edge Neural TTS (`node-edge-tts`), SpeechSynthesis fallback |
| **Computer Vision** | `face-api.js` (Client-side TensorFlow models) |
| **Database & Auth** | Prisma ORM (SQLite / PostgreSQL), NextAuth.js (Google OAuth & Demo Credentials) |

---

## Design System: The Brutalist Blueprint

Prept adheres to a functional, high-contrast engineering aesthetic:
* **Zero Radius**: `0px` border-radius across all containers, cards, inputs, and modals.
* **Curated Palette**: Monochrome surface layers with high-contrast text and a distinct technical accent (`#5B5BFF`).
* **Monospace Data Display**: Telemetry readouts, metrics, and question IDs rendered in clean monospace typography.
* **No Arbitrary Decorations**: Visual elements serve strict functional utility without decorative gradients or unnecessary icon clutter.

---

## Repository Branches

* **`main`**: Production edition focused on Technical and Behavioral/HR interview tracks without code editor dependencies (deployed on Vercel).
* **`with-coding`**: Preserved feature branch containing the in-browser JavaScript/TypeScript Code Playground (`CodePlayground.tsx`), sandbox test-case runner, and 3-way distribution controls.

---

## Getting Started (Local Development)

### 1. Clone the Repository
```bash
git clone https://github.com/AG0606/Prept.git
cd Prept
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory (refer to `.env.example`):
```env
# Google Gemini API Key
GEMINI_API_KEY="your_gemini_api_key"

# Groq Cloud API Key (Llama 3.3 & Whisper STT)
GROQ_API_KEY="your_groq_api_key"

# NextAuth Configuration
NEXTAUTH_SECRET="your_32_character_secret_key"
NEXTAUTH_URL="http://localhost:3000"

# Database Configuration
DATABASE_URL="file:./prisma/dev.db"

# Optional: Google OAuth 2.0 (For 1-click Google Sign-In)
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
```

### 4. Initialize Database
```bash
npx prisma db push
```

### 5. Start Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Production Deployment (Vercel)

1. Push your changes to GitHub.
2. Import the repository on [Vercel](https://vercel.com).
3. Set your production Environment Variables (`GEMINI_API_KEY`, `GROQ_API_KEY`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `DATABASE_URL`).
4. Vercel automatically runs `prisma generate && prisma db push --accept-data-loss && next build` and deploys your application.

---

## License

Built for engineers, by engineers. Released under the MIT License.
