---
title: "Customized SuperMemo SM-2 SRS Engine & Base64 QR Decoder"
category: "algorithm"
problem_type: "srs_algorithm_and_qr_import"
component: "srsEngine.ts"
tags: ["supermemo-sm2", "srs", "spaced-repetition", "qr-code", "base64"]
date: "2026-08-05"
---

# Customized SuperMemo SM-2 SRS Engine & Base64 QR Decoder

## Problem
1. **Standard SM-2 Misalignment:** Standard SuperMemo SM-2 spaced repetition intervals delay failed items too far into the future (e.g. 1 day minimum), which breaks rapid barista audio drill sessions where failed drinks must be re-tested almost immediately.
2. **Base64 QR Export Parsing Error:** Pasting legacy QR code export strings into the import modal threw `Invalid JSON string format` because raw QR payloads were Base64-encoded strings (`ey...`).

## Solution

### 1. Fast-Repetition Penalty SM-2 Customization (`srsEngine.ts`)
* **On PASS (`grade === true`):**
  * `repetition = repetition + 1`
  * `easinessFactor = easinessFactor + 0.1` (capped at 2.5)
  * `interval = repetition === 1 ? 1 : Math.round(interval * easinessFactor)`
  * `turnsSinceLastGraded = 0`
* **On FAIL (`grade === false`):**
  * `repetition = 0` (resets streak)
  * `easinessFactor = Math.max(1.3, easinessFactor - 0.2)`
  * `interval = 0` (queue immediately)
  * `weight = 90` (high weight priority)
  * Re-queues the failed drink within **1–2 turns** in the active session queue.

### 2. Robust Base64 `atob` QR Decoder
* `SRSEngine.importJSON(inputStr)` checks if `inputStr` is raw JSON or Base64 encoded:
  ```typescript
  let cleanJsonStr = inputStr.trim();
  if (!cleanJsonStr.startsWith('{') && !cleanJsonStr.startsWith('[')) {
    try {
      cleanJsonStr = atob(cleanJsonStr);
    } catch (e) {
      // Keep original string if atob fails
    }
  }
  ```
* Seamlessly handles legacy QR export strings (`ey...`), decoding them into valid JSON objects before updating local state.

## Key Learnings & Error Avoidance
* **Tailor SRS algorithms to session context:** Rapid skill drills require aggressive failure re-queuing compared to long-term vocabulary learning.
* **Auto-detect Base64 strings on import:** Never assume user input is raw JSON string text; apply safe `atob` fallback decoding.
