---
title: "Ground Truth Schema Injection & System Prompt Alignment for LLM Grader"
category: "ai_evaluation"
problem_type: "llm_grader_hallucination"
component: "geminiGrader.ts"
tags: ["gemini", "system-prompt", "ground-truth", "voice-evaluation", "size-contract"]
date: "2026-08-05"
---

# Ground Truth Schema Injection & System Prompt Alignment for LLM Grader

## Problem
1. **False Negative on Iced Drinks:** LLM Store Manager Grader failed Iced Mocha recitations because `QuizMode.tsx` hardcoded `size: 'Short / Tall / Grande / Venti'` in context for all drinks, causing the LLM to demand a Short size for an 3-size Iced drink.
2. **False Negative on Custom Recipes:** The LLM rejected Hot Caramel Macchiato recitations that included both Vanilla and Classic syrup because standard worldwide Starbucks recipes use Vanilla only, ignoring custom recipe specifications (`Vanilla 1 2 3 4 AND Classic 1 2 3 4`).
3. **Loss of User Prompt Style:** Over-writing the system prompt during fixes erased custom user-authored rules (e.g. `giảm size` pitcher rules, `don't pour foam` for Hot Mocha, `SCDE cinnamon sprinkles`).

## Solution

### 1. Explicit `sizes` Data Contract (`recipes.json` & `recipe.ts`)
* Added explicit `sizes: string[]` to every recipe entry in `recipes.json`:
  * **Hot Drinks (4 sizes):** `["Short", "Tall", "Grande", "Venti"]`
  * **Iced & Specialty Drinks (3 sizes):** `["Tall", "Grande", "Venti"]`
* Passes human-verified `sizes` directly into `evaluateWithGemini` without fragile dynamic string splitting.

### 2. Top-Level `groundTruthRecipe` Injection Payload
* `geminiGrader.ts` constructs a clean top-level reference object:
  ```json
  "groundTruthRecipe": {
    "drinkName": "Hot Caramel Macchiato (CM)",
    "temperature": "hot",
    "validSizes": ["Short", "Tall", "Grande", "Venti"],
    "groundTruthSteps": {
      "steamMilk": "Steam milk: 1-3s",
      "queueShots": "1 2 2 3",
      "pumpSyrup": "Vanilla 1 2 3 4 AND Classic 1 2 3 4",
      "finish": "1. Đổ sữa và foam... 2. Đổ shots... 3. Vẽ caramel sauce 7-7-2 4. Thêm bọc cốc"
    }
  }
  ```

### 3. System Prompt Hierarchy & User Voice Preservation
* **Ground Truth Superiority:** Instructs the LLM that `groundTruthRecipe.groundTruthSteps` is the single supreme source of truth over outside pre-trained knowledge.
* **Size Enforcement:** Size requirements are strictly governed by `groundTruthRecipe.validSizes`. If `validSizes` has 3 items, **never demand Short size**.
* **Preserving User Voice:** Kept all user-written detailed bullet points under Rule 5 untouched, only adding minimal clarifying clauses.

## Key Learnings & Error Avoidance
* **Never let LLMs guess ground truth rules:** Always pass complete ground truth steps and explicit size arrays in the prompt context.
* **Never wipe custom system prompts during refactors:** Modify prompts incrementally, preserving original phrasing and user-authored rules.
