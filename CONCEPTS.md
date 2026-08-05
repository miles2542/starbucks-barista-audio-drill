# Starbucks Barista SRS Drill — Project Architecture Concepts & Vocabulary

This document serves as the authoritative vocabulary map and architectural concept reference for the **Starbucks Barista SRS Drill App** (`miles2542/starbucks-barista-audio-drill`).

---

## 1. Domain Terminology & Concepts

### 🎓 **Store Manager Grader (`geminiGrader.ts`)**
* **Definition:** An AI evaluator powered by Gemini 3.5 Flash-Lite (or auto-rotated fallback models) adopting a strict, zero-fluff Starbucks Store Manager persona.
* **Key Contract:** Evaluates trainee spoken recipe recitations strictly against an injected `groundTruthRecipe` object. Uses binary PASS/FAIL logic and structured Markdown feedback.
* **Ground Truth Superiority:** Overrides LLM pre-trained general knowledge with explicit custom recipe steps (e.g. Hot Caramel Macchiato requiring both Vanilla 1 2 3 4 AND Classic 1 2 3 4).

### 🌐 **Master Index Blob (`srsEngine.ts`)**
* **Definition:** A permanent, deterministic coordinator JSONBlob (`019fcd83-3d4a-7924-a444-3f85f9cdc26c`) hosted on `jsonblob.com`.
* **Purpose:** Maps user-friendly 6-character sync codes (e.g., `BANANA`, `SBX999`) to individual JSONBlob storage IDs. Enables instant, multi-device auto-sync without requiring user database accounts or API key setup.

### 🧠 **Adaptive SRS Engine (`srsEngine.ts`)**
* **Definition:** A customized SuperMemo SM-2 spaced repetition algorithm tailored for rapid barista drill sessions.
* **Key Behavior:** Offline-first state persistence in `localStorage`. Applies a fast-repetition penalty for failed drinks (re-queuing them within 1–2 turns) while expanding interval days ($I_n = I_{n-1} \times E_F$) for mastered drinks.
* **Merge Rule:** Synchronizes cross-device progress by comparing `lastGradedTimestamp` per recipe ID and keeping whichever drill timestamp is newest.

### 🎙️ **Dual Voice Listener (`audioEngine.ts`)**
* **Definition:** Web Speech API audio listener engine designed for hands-free lying-down or walking practice.
* **Trigger Mechanisms:**
  1. **Spoken Trigger Word:** Listens for the spoken word `"Over"` to immediately stop recording and submit speech.
  2. **7-Second Silence Fallback:** Resets a 7-second timer on every spoken word chunk. Auto-submits if silence reaches 7 seconds.
  3. **Firefox/Fallback Handler:** Falls back to `MediaRecorder` audio recording when native SpeechRecognition is unavailable.

### 📱 **Nordic Obsidian Design System & 4-Tab Mobile Layout (`index.css`, `Navbar.tsx`)**
* **Definition:** A sleek dark-mode visual hierarchy using HSL tokens (`--bg-primary: #181A1B`, `--accent-mint: #059669`, `--status-fail: #EF4444`).
* **Layout Structure:** 4 core tabs — **Quiz** (Tab #1, primary hands-free drill), **SRS Metrics** (Tab #2), **Recipes** (Tab #3, quick-read + listen merged view), **Settings** (Tab #4).
* **Mobile Responsiveness:** Fixed mobile bottom navigation bar on viewports $<768\text{px}$, responsive card list dashboard (`.srs-card-view`), and $\ge 44\text{px}$ touch targets.

---

## 2. Documented Solutions Index

Detailed solution write-ups located in `docs/solutions/`:

* [`jsonblob-master-index-cloud-sync.md`](file:///x:/Programming/Python/Projects/Web%20&%20SPAs/Starbucks%20BF30%20Recipe%20v3/docs/solutions/jsonblob-master-index-cloud-sync.md) — Multi-tier JsonBlob REST storage engine, master index mapping, and pre-sync local backup safeguards.
* [`multimodal-voice-grader-evaluation.md`](file:///x:/Programming/Python/Projects/Web%20&%20SPAs/Starbucks%20BF30%20Recipe%20v3/docs/solutions/multimodal-voice-grader-evaluation.md) — Ground Truth Schema injection, size array contracts, system prompt voice preservation, and HTTP 429 auto-rotation.
* [`supermemo-sm2-srs-engine.md`](file:///x:/Programming/Python/Projects/Web%20&%20SPAs/Starbucks%20BF30%20Recipe%20v3/docs/solutions/supermemo-sm2-srs-engine.md) — Fast-repetition SM-2 interval customization and Base64 QR code import decoder.
* [`mobile-bottom-nav-responsive-craft.md`](file:///x:/Programming/Python/Projects/Web%20&%20SPAs/Starbucks%20BF30%20Recipe%20v3/docs/solutions/mobile-bottom-nav-responsive-craft.md) — Fixed mobile bottom navigation, mobile card dashboard layout, fluid `clamp()` typography, and touch target optimization.
