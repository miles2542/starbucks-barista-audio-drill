---
title: "Recipe Dataset Schema Definition & Ground Truth Management"
category: "data_architecture"
problem_type: "recipe_schema_inconsistency"
component: "recipes.json, recipe.ts"
tags: ["recipe-schema", "ground-truth", "sizes-array", "data-contract"]
date: "2026-08-05"
---

# Recipe Dataset Schema Definition & Ground Truth Management

## Context & Background
In `v1.9.0`, the raw JSON text editor tab (`RecipeManager.tsx`) was removed to streamline the barista experience into 4 focused tabs (Quiz, SRS Metrics, Recipes Quick-Read, Settings).

All Starbucks drink recipes are centrally defined in `src/data/recipes.json` with ground truth reference in `docs/User written recipe.txt`.

## Schema Specification (`src/types/recipe.ts`)

Every recipe entry in `recipes.json` MUST adhere to the following TypeScript interface:

```typescript
export interface RecipeSteps {
  steamMilk: string;  // e.g. "Steam milk: 1-3s" or "None"
  queueShots: string; // e.g. "1 2 2 3" (4 sizes) or "2 2 3" (3 sizes)
  pumpSyrup: string;  // e.g. "Vanilla 1 2 3 4 AND Classic 1 2 3 4"
  finish: string;     // Step-by-step assembly, fill levels, and cup sleeve rules
}

export interface Recipe {
  id: string;         // Unique kebab-case ID (e.g. "hot-caramel-macchiato")
  name: string;       // Display name with mark code (e.g. "Hot Caramel Macchiato (CM)")
  code: string;       // Barista cup mark code (e.g. "CM (HOT)")
  type: 'hot' | 'iced'; // Temperature classification
  sizes: string[];    // Explicit human-verified size array (e.g. ["Short", "Tall", "Grande", "Venti"])
  steps: RecipeSteps; // Standard 4-step recipe details
}
```

## Recipe Addition & Modification Rules

When adding a new drink or modifying an existing recipe:

1. **Authoritative Ground Truth First:** Always refer to `docs/User written recipe.txt` as the primary source of truth.
2. **Explicit `sizes` Array:** Explicitly declare valid sizes in the `"sizes"` array (e.g. `["Short", "Tall", "Grande", "Venti"]` for 4-size hot drinks; `["Tall", "Grande", "Venti"]` for 3-size iced drinks). Never rely on runtime string parsing.
3. **Multi-Syrup Clarity:** If a drink requires multiple syrups (e.g. Hot Caramel Macchiato requiring both Vanilla AND Classic), specify all syrup names and pump counts clearly in `steps.pumpSyrup`.
4. **Cup Sleeve Requirement:** For hot drinks, explicitly list `Thêm bọc cốc (đai chống nóng)` in `steps.finish`.

## Key Learnings & Error Avoidance
* **Never omit the `sizes` array:** Explicit size contracts prevent LLM evaluation hallucinations regarding missing Short sizes on iced drinks.
* **Keep `recipes.json` synchronized with `User written recipe.txt`:** Ensure custom store modifications (like dual syrups) are reflected in `recipes.json` so the LLM Store Manager Grader receives complete ground truth steps.
