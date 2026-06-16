<div align="center">
  <img src="public/logo.png" alt="Prept Logo" width="120" />
  <h1>Prept</h1>
  <p><strong>The High-Fidelity AI Interview Simulation Platform</strong></p>
  <p><em>Train for your next career move in an adaptive, high-pressure, architecturally rigorous environment.</em></p>
</div>

---

## 🚀 What is Prept?

**Prept** is not just another list of coding questions. It is a highly interactive, real-time interview simulator designed specifically for top-tier engineering candidates (FAANG level). It bridges the gap between practicing algorithms in isolation and actually communicating them effectively under pressure.

Through adaptive AI, live voice interactions, real-time code execution, and deep performance analytics, Prept mimics the intensity and dynamic nature of a real technical interview. 

---

## ⚡ The Core Experience

### 1. Live Interactive Coding
A built-in Monaco Editor allows you to write, execute, and debug code directly in the browser. The system validates your logic in real-time, just like a real coding environment.

### 2. Adaptive AI Voice & Conversational Dynamics
The interview isn't static text. An advanced AI voice engine listens to your explanations, analyzes your filler words ("um", "uh"), and dynamically interrupts you to ask architectural follow-up questions or push for complexity optimizations (e.g., "Can we achieve this in O(log N) instead?").

### 3. Resume-Driven System Design
Upload your PDF resume and the platform parses your specific background. It tailors high-level system design questions (e.g., load balancing, sharding, distributed caching) based on the technologies and scale you've previously worked with.

### 4. Behavioral & STAR Framework Mastery
The AI conducts deep behavioral interviews, probing for leadership principles and ensuring your answers follow the strict Situation-Task-Action-Result (STAR) methodology.

### 5. Deep Post-Interview Analytics
After every session, you receive a comprehensive "Actionable Feedback Report". This includes:
- Dimensional scores on **Communication**, **Technical Depth**, and **Confidence**.
- A timeline of your interview with diff-style refactor suggestions.
- Emotion tracking and filler word counts to improve verbal clarity.

---

## 📐 The Brutalist Blueprint Design System

Prept is built with a custom design language called the **Brutalist Blueprint**.
- **Focus over Flash**: We eliminated soft gradients, rounded corners, and drop shadows. 
- **Architectural Aesthetic**: The UI relies on sharp 1px borders, high-contrast monochrome layouts, monospace typography, and a distinct indigo accent (`#5B5BFF`).
- **Living Systems**: The interface feels like a technical HUD. Features like the falling Tetris foundation blocks, bouncing audio wave visualizers, and blueprint grid backgrounds reinforce the engineering mindset.

---

## 🛠️ Architecture & Technologies

Prept is a modern full-stack web application built for speed and AI integration.

- **Frontend Core**: [Next.js 14](https://nextjs.org/) (App Router), React, TypeScript
- **State Management**: Zustand
- **Styling**: Tailwind CSS & Vanilla CSS (for complex keyframe animations)
- **Code Editor**: Monaco Editor (`@monaco-editor/react`)
- **Voice & Audio**: Web Speech API, Web Audio API, `lucide-react` for iconography
- **Database**: Prisma ORM (SQLite / PostgreSQL)
- **AI Integrations**: Gemini API (for logic, adaptive questioning, and feedback parsing)

---

## 💻 Local Development Setup

To get this project running on your local machine:

**1. Clone the repository**
```bash
git clone https://github.com/AG0606/Prept.git
cd Prept
```

**2. Install dependencies**
```bash
npm install
```

**3. Set up environment variables**
Create a `.env` file in the root directory and add your API keys (e.g., Gemini API key, Auth secrets). *See `.env.example` if available.*

**4. Run the development server**
```bash
npm run dev
```

**5. Start Training**
Open [http://localhost:3000](http://localhost:3000) in your browser and start your first simulation!

---
<div align="center">
  <em>© Prept Systems // Built for Engineers, by Engineers</em>
</div>
