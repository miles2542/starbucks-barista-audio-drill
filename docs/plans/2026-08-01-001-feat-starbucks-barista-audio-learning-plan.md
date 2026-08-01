---
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
product_contract_source: ce-brainstorm
---

# Starbucks Barista Recipe Audio Learning System

An audio-first, hands-free Progressive Web Application (PWA) built for rapid, high-confidence Starbucks recipe memorization and Store Manager (SM) level drill practice.

## Summary

The system provides two core modes: **Listen & Memorize Mode** (audio read-aloud of standard 4-step recipe sequence: Steam Milk $\rightarrow$ Queue Shots $\rightarrow$ Add Syrup $\rightarrow$ Finish & Connect) and **100% Hands-Free SRS Quiz Mode** (continuous audio loop with screen Wake Lock, Speech-End trigger word *"Over"*, 7s silence fallback, sub-second `gemini-3.5-flash-lite` strict SM evaluation, and cross-device JSON/QR sync).

---

## User & Design Requirements

### 1. Visual Aesthetics & Responsive Layout
- **Style Foundation:** Nordic Obsidian & Mint Focus (`#181A1B` obsidian background, `#222527` surface, `#059669` mint emerald accent, crisp SVG icons via `lucide-react`, NO emojis).
- **Spacing & Rhythm:** Balanced padding and gap hierarchy (`clamp()`, container queries) following `frontend-design-framework` and `responsive-craft` guidelines.
- **Logo:** Official Siren SVG extracted verbatim from `X:\Programming\Python\Projects\Web & SPAs\Starbucks BF30 Recipe v2\src\components\logo.js`.

### 2. Audio & Hands-Free Engine (Firefox & Cross-Browser)
- **Screen Wake Lock API:** Keeps phone display awake during practice.
- **Dual Trigger Listener:**
  - Real-time `SpeechRecognition` listening for trigger word **"Over"** + 7s silence auto-submit.
  - Firefox Fallback: `MediaRecorder` audio buffer capture with Web Speech API detection fallback.
- **Sub-Second Strict SM AI Grader:** `gemini-3.5-flash-lite` (0.85s response time) with zero soft filler, binary PASS/FAIL output, and direct error callouts.
- **Audio Output:** Web Speech Synthesis (`speechSynthesis`) for zero-latency local speech feedback.

### 3. Fast Adaptive SRS Engine & Sync
- Aggressive repetition for failed drinks (re-queues in 1-2 turns). Exponential spacing for mastered drinks.
- Cross-device sync via 1-click JSON Sync Link & QR Code generation.

---

## Proposed Changes & File Structure

### Project Root

#### [NEW] [package.json](file:///x:/Programming/Python/Projects/Web%20&%20SPAs/Starbucks%20BF30%20Recipe%20v3/package.json)
- React 19 + Vite 6 + TypeScript + Lucide React + QR Code library configuration.

#### [NEW] [vite.config.ts](file:///x:/Programming/Python/Projects/Web%20&%20SPAs/Starbucks%20BF30%20Recipe%20v3/vite.config.ts)
- Vite build configuration for PWA static deployment.

#### [NEW] [index.html](file:///x:/Programming/Python/Projects/Web%20&%20SPAs/Starbucks%20BF30%20Recipe%20v3/index.html)
- Main HTML file with PWA meta tags and Google Fonts.

#### [NEW] [src/index.css](file:///x:/Programming/Python/Projects/Web%20&%20SPAs/Starbucks%20BF30%20Recipe%20v3/src/index.css)
- Refined Nordic Obsidian CSS design system tokens, typography, and responsive utility classes.

### Application Components & Logic

#### [NEW] [src/types/recipe.ts](file:///x:/Programming/Python/Projects/Web%20&%20SPAs/Starbucks%20BF30%20Recipe%20v3/src/types/recipe.ts)
- TypeScript definitions for Recipes, Standard 4 Steps, SRS Items, Evaluation Results, and Settings.

#### [NEW] [src/data/recipes.json](file:///x:/Programming/Python/Projects/Web%20&%20SPAs/Starbucks%20BF30%20Recipe%20v3/src/data/recipes.json)
- Starbucks recipe data (Hot Latte, Iced Latte, Hot Cappuccino, Iced Cappuccino, Hot Americano, Iced Americano).

#### [NEW] [src/components/SirenLogo.tsx](file:///x:/Programming/Python/Projects/Web%20&%20SPAs/Starbucks%20BF30%20Recipe%20v3/src/components/SirenLogo.tsx)
- Official Starbucks Siren vector logo component using extracted SVG.

#### [NEW] [src/services/geminiGrader.ts](file:///x:/Programming/Python/Projects/Web%20&%20SPAs/Starbucks%20BF30%20Recipe%20v3/src/services/geminiGrader.ts)
- Strict Store Manager evaluation service using `gemini-3.5-flash-lite` API.

#### [NEW] [src/services/audioEngine.ts](file:///x:/Programming/Python/Projects/Web%20&%20SPAs/Starbucks%20BF30%20Recipe%20v3/src/services/audioEngine.ts)
- Dual-mode voice listener (`SpeechRecognition` + `MediaRecorder` fallback for Firefox) + `speechSynthesis` TTS.

#### [NEW] [src/services/srsEngine.ts](file:///x:/Programming/Python/Projects/Web%20&%20SPAs/Starbucks%20BF30%20Recipe%20v3/src/services/srsEngine.ts)
- Fast-adaptive SuperMemo algorithm with JSON/QR export-import.

#### [NEW] [src/components/Navbar.tsx](file:///x:/Programming/Python/Projects/Web%20&%20SPAs/Starbucks%20BF30%20Recipe%20v3/src/components/Navbar.tsx)
- Clean header navigation with SVG logo, mode toggles, and SRS status badge.

#### [NEW] [src/components/ListenMode.tsx](file:///x:/Programming/Python/Projects/Web%20&%20SPAs/Starbucks%20BF30%20Recipe%20v3/src/components/ListenMode.tsx)
- Audio read-aloud player for recipe memorization.

#### [NEW] [src/components/QuizMode.tsx](file:///x:/Programming/Python/Projects/Web%20&%20SPAs/Starbucks%20BF30%20Recipe%20v3/src/components/QuizMode.tsx)
- 100% hands-free voice quiz interface with live audio waveform, trigger feedback, manual override buttons, and SM evaluation output.

#### [NEW] [src/components/RecipeManager.tsx](file:///x:/Programming/Python/Projects/Web%20&%20SPAs/Starbucks%20BF30%20Recipe%20v3/src/components/RecipeManager.tsx)
- JSON recipe viewer & editor for adding future drinks.

#### [NEW] [src/components/SettingsModal.tsx](file:///x:/Programming/Python/Projects/Web%20&%20SPAs/Starbucks%20BF30%20Recipe%20v3/src/components/SettingsModal.tsx)
- API key configuration, speech rate controls, and QR/JSON cross-device sync.

#### [NEW] [src/App.tsx](file:///x:/Programming/Python/Projects/Web%20&%20SPAs/Starbucks%20BF30%20Recipe%20v3/src/App.tsx)
- Main application shell integrating all modules and state.

---

## Verification Plan

### Automated Build & Lint
- `pnpm install` and `pnpm build` to verify zero TypeScript or Vite bundle errors.

### Manual Verification
- Test `gemini-3.5-flash-lite` API strict SM evaluation.
- Test hands-free audio loop in Firefox and Chrome.
- Test "Over" keyword detection and 7-second silence auto-submit.
- Verify Siren SVG logo and Lucide icons across mobile and desktop viewports.
