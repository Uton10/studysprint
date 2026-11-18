# StudySprint ⚡ — Hybrid AI Study Assistant

**Paste any text. Learn it in minutes. AI runs on your device when it can — and in the cloud when it needs to.**

StudySprint turns lecture notes, articles, chapters, and meeting notes into a **summary, key points, flashcards, a practice quiz, a plain-English explanation, a translation, or an action-item list**. What makes it different is *where* the AI runs: StudySprint is a **hybrid inference** app built on **Firebase AI Logic**. Short, everyday tasks are answered by **Gemini Nano on-device** (instant, free, offline, private — your text never leaves your laptop). Long documents and heavy generation are escalated to **cloud Gemini**. Every answer carries a badge showing **which engine produced it, why it was routed there, and how long it took**.

Built for the **#BuildHybridAI 2026** hackathon (Web/Chrome platform).

---

## Why hybrid? The problem this solves

Students and professionals are drowning in long readings — and most AI study tools send *everything* to the cloud. That means every summary costs money, needs internet, and ships private notes (unpublished research, internal meeting minutes, medical or legal study material) to a server. But on-device-only AI has the opposite problem: not every device has a local model, and small models struggle with long documents and complex structured output.

StudySprint treats **routing itself as the product feature**:

| Task | Route | Why |
|---|---|---|
| TL;DR of short notes, ELI5, translation of a short text, action items | **On-device** (Gemini Nano) | Instant, free, offline, and private |
| Long documents (> 6,000 chars), flashcard decks, quizzes | **Cloud** (Gemini via Firebase AI Logic) | Bigger context window, most reliable structured JSON |
| Anything, when you flip the switch | **Your choice** | Force On-device only (privacy) or Cloud only (max quality) |

## Features

- 📝 **Summarize** — TL;DR + key points + the one takeaway to remember
- 🃏 **Flashcards** — an 8-card flip deck generated from your text
- ❓ **Quiz me** — 5 interactive multiple-choice questions with explanations
- 🧒 **Explain simply** — ELI5 with an everyday analogy
- 🌐 **Translate** — into Indonesian, Spanish, French, German, Japanese, or English
- ✅ **Action items** — commitments and deadlines extracted from meeting notes
- 🧭 **Visible hybrid routing** — per-answer engine badge, routing reason, latency, and a live routing log
- 🔒 **Private by design** — sessions are stored only in your browser (localStorage); on-device tasks never transmit your text
- 📶 **Works offline** for on-device tasks once Chrome has downloaded Gemini Nano

## How it works (architecture)

```
                ┌─────────────────────────────────────────────┐
   user task ──▶│  Hybrid Router (hybrid.js)                  │
                │  decides per task: device / cloud / forced  │
                └──────────────┬──────────────────────────────┘
                               │ InferenceMode
              ┌────────────────┴─────────────────┐
              ▼                                  ▼
   Firebase AI Logic model              Firebase AI Logic model
   PREFER_ON_DEVICE / ONLY_ON_DEVICE    PREFER_IN_CLOUD / ONLY_IN_CLOUD
              │                                  │
              ▼                                  ▼
   Gemini Nano in Chrome               Gemini in the cloud
   (via the Prompt API)                (Gemini Developer API backend)
```

- The router creates `GenerativeModel` instances through **Firebase AI Logic** with explicit `InferenceMode`s (`PREFER_ON_DEVICE`, `PREFER_IN_CLOUD`, `ONLY_ON_DEVICE`, `ONLY_IN_CLOUD`) and calls `model.generateContent()` — with `PREFER_ON_DEVICE`, the SDK itself serves the request on-device when Gemini Nano is available and transparently falls back to the cloud when it is not.
- Before the first request, the app calls `model.initializeDeviceModel()` (after a user interaction, as the API requires) and surfaces model-download progress in the UI.
- The engine behind each answer is shown in the UI: read from the SDK response when annotated, otherwise derived from the routing mode plus a live `LanguageModel.availability()` probe — and the UI says which.
- **Demo mode:** if no Firebase config is present, on-device tasks call Chrome's Prompt API directly (the same engine Firebase AI Logic uses on the web), and cloud-bound tasks degrade to a **clearly-labelled local extractive fallback** — the app never presents a non-AI answer as an AI answer.

## Run it locally

No build step. You need any static file server and (for on-device inference) **Chrome 139+ on desktop**.

```bash
cd app
python3 -m http.server 8080
# open http://localhost:8080 in Chrome
```

Enable the on-device model in Chrome:

1. Go to `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`, set it to **Enabled**, and restart Chrome.
2. On first on-device use, Chrome downloads Gemini Nano automatically (watch the routing log for progress). The app works without it too — tasks simply route to the cloud/fallback.

## Connect a real Firebase project (activates cloud routing)

Full instructions are commented at the top of [`firebase-config.js`](firebase-config.js). In short:

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. **Build → AI Logic → Get started**, choose the **Gemini Developer API** provider (free tier). The guided flow enables the APIs and enforces App Check.
3. Register a Web app and paste its `firebaseConfig` into `firebase-config.js`, replacing every `YOUR_...` value.
4. App Check: run the app once, copy the debug token from the devtools console, and safelist it under **App Check → Apps → Manage debug tokens** (debug tokens are accepted for this hackathon; use reCAPTCHA in production).
5. Reload — the status pill switches to "Firebase connected" and cloud escalation is live.

> ⚠️ Never commit a production config with unrestricted keys; the config in this repo is a placeholder. The rules also prohibit including production API keys/secrets in the submission repository.

## Project structure

```
app/
├── index.html          # UI shell
├── styles.css          # All styling (no framework)
├── app.js              # UI logic: prompts, rendering, library, log
├── hybrid.js           # The hybrid engine: router + Firebase AI Logic + Prompt API + fallback
├── firebase-config.js  # ← paste your Firebase config here (placeholder committed)
└── README.md
```

## Tech used

- **Firebase AI Logic** (Web SDK v12.5.0+, hybrid inference) — `getAI`, `getGenerativeModel`, `GoogleAIBackend`, `InferenceMode`
- **Gemini Nano** via Chrome's **Prompt API** (`LanguageModel`) for on-device inference
- **Cloud Gemini** (`gemini-2.5-flash`) via the Gemini Developer API backend
- **Firebase App Check** (debug provider locally)
- Vanilla HTML/CSS/JS ES modules — zero build tooling, zero runtime dependencies beyond the Firebase CDN modules

## License

MIT — see [LICENSE](LICENSE).
