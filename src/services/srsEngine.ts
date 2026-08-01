export interface WeightData {
  id: string;
  weight: number;                 // Selection probability weight (10 to 250, default 100)
  correctCount: number;           // Lifetime correct counter
  incorrectCount: number;         // Lifetime incorrect counter
  turnsSinceLastGraded: number;   // Turns since last graded encounter
  lastGradedTimestamp?: number;   // Epoch timestamp ms of last graded encounter
  lastSpeedMs?: number;           // Time taken in ms for the drill response
}

export class SRSEngine {
  private static STORAGE_KEY = 'starbucks_srs_weights_v3';

  static loadAll(): Record<string, WeightData> {
    const data = localStorage.getItem(this.STORAGE_KEY);
    if (!data) return {};
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  static saveAll(data: Record<string, WeightData>) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  }

  static updateItem(id: string, pass: boolean, allRecipeIds: string[], speedMs?: number): WeightData {
    const all = this.loadAll();
    
    // Ensure all recipes exist in state
    allRecipeIds.forEach(recipeId => {
      if (!all[recipeId]) {
        all[recipeId] = {
          id: recipeId,
          weight: 100,
          correctCount: 0,
          incorrectCount: 0,
          turnsSinceLastGraded: 0,
        };
      }
    });

    const target = all[id];
    target.lastGradedTimestamp = Date.now();
    if (speedMs) {
      target.lastSpeedMs = speedMs;
    }

    if (pass) {
      target.correctCount += 1;
      // Fast adaptive learning rate: PASS drops weight by -40 (minimum 10)
      target.weight = Math.max(10, target.weight - 40);
    } else {
      target.incorrectCount += 1;
      // FAIL pushes weight up by +60 (maximum 250)
      target.weight = Math.min(250, target.weight + 60);
    }

    // Reset target's turns since last graded, and increment all other recipes' turn counters
    target.turnsSinceLastGraded = 0;
    allRecipeIds.forEach(recipeId => {
      if (recipeId !== id && all[recipeId]) {
        all[recipeId].turnsSinceLastGraded += 1;
      }
    });

    this.saveAll(all);
    return target;
  }

  static getNextRecipe(recipes: any[], currentRecipeId?: string): any {
    if (!recipes || recipes.length === 0) return null;
    if (recipes.length === 1) return recipes[0];

    const all = this.loadAll();
    const recipeIds = recipes.map(r => r.id);

    // Dynamic Forced Review Cap scaling with total recipe count (e.g. 6 recipes -> 9 turns, 18 recipes -> 27 turns)
    const maxTurnsWithoutReview = Math.max(8, Math.round(recipes.length * 1.5));

    // Ensure all items are initialized
    recipeIds.forEach(id => {
      if (!all[id]) {
        all[id] = { id, weight: 100, correctCount: 0, incorrectCount: 0, turnsSinceLastGraded: 0 };
      }
    });

    // Check for DYNAMIC FORCED REVIEW items
    const forcedItems = recipes.filter(r => {
      const data = all[r.id];
      return data && data.turnsSinceLastGraded >= maxTurnsWithoutReview && r.id !== currentRecipeId;
    });

    if (forcedItems.length > 0) {
      // Pick highest turn count forced item
      forcedItems.sort((a, b) => (all[b.id]?.turnsSinceLastGraded || 0) - (all[a.id]?.turnsSinceLastGraded || 0));
      return forcedItems[0];
    }

    // Weighted Probability Sampler
    const candidates = recipes.filter(r => r.id !== currentRecipeId);
    let totalWeight = 0;
    const weightsMap = candidates.map(r => {
      const data = all[r.id];
      const w = data ? data.weight : 100;
      totalWeight += w;
      return { recipe: r, weight: w };
    });

    let random = Math.random() * totalWeight;
    for (const item of weightsMap) {
      if (random < item.weight) {
        return item.recipe;
      }
      random -= item.weight;
    }

    return candidates[0] || recipes[0];
  }

  static getDueItems(recipes: any[]): any[] {
    return recipes;
  }

  static exportSyncString(): string {
    const all = this.loadAll();
    return btoa(JSON.stringify(all));
  }

  static importSyncString(encoded: string): boolean {
    try {
      const json = atob(encoded);
      const data = JSON.parse(json);
      this.saveAll(data);
      return true;
    } catch {
      return false;
    }
  }
}
