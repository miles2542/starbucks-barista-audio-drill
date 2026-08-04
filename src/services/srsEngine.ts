import type { Recipe } from '../types/recipe';

export interface WeightData {
  id: string;
  weight: number;
  correctCount: number;
  incorrectCount: number;
  turnsSinceLastGraded: number;
  lastGradedTimestamp?: number;
  lastSpeedMs?: number;
}

export class SRSEngine {
  private static STORAGE_KEY = 'starbucks_srs_weights';

  static loadAll(): Record<string, WeightData> {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (!saved) return {};
    try {
      return JSON.parse(saved);
    } catch {
      return {};
    }
  }

  static saveAll(data: Record<string, WeightData>) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  }

  static updateItem(id: string, pass: boolean, allRecipeIds: string[], speedMs?: number) {
    const all = this.loadAll();

    allRecipeIds.forEach(rid => {
      if (!all[rid]) {
        all[rid] = {
          id: rid,
          weight: 100,
          correctCount: 0,
          incorrectCount: 0,
          turnsSinceLastGraded: 0
        };
      }
    });

    const item = all[id] || {
      id,
      weight: 100,
      correctCount: 0,
      incorrectCount: 0,
      turnsSinceLastGraded: 0
    };

    if (pass) {
      item.weight = Math.max(10, Math.round(item.weight * 0.65));
      item.correctCount = (item.correctCount || 0) + 1;
    } else {
      item.weight = Math.min(250, Math.round(item.weight * 2.2));
      item.incorrectCount = (item.incorrectCount || 0) + 1;
    }

    item.turnsSinceLastGraded = 0;
    item.lastGradedTimestamp = Date.now();
    if (speedMs) item.lastSpeedMs = speedMs;

    allRecipeIds.forEach(rid => {
      if (rid !== id && all[rid]) {
        all[rid].turnsSinceLastGraded += 1;
        if (all[rid].turnsSinceLastGraded >= 3 && all[rid].weight > 35) {
          all[rid].weight = Math.min(250, Math.round(all[rid].weight * 1.08));
        }
      }
    });

    all[id] = item;
    this.saveAll(all);

    if (this.getSyncCode()) {
      this.pushSync();
    }
  }

  static getNextRecipe(recipes: Recipe[], excludeId?: string): Recipe | null {
    if (!recipes || recipes.length === 0) return null;

    const all = this.loadAll();
    const available = recipes.filter(r => r.id !== excludeId);
    const pool = available.length > 0 ? available : recipes;

    const itemsWithWeights = pool.map(r => {
      const data = all[r.id];
      const weight = data ? data.weight : 100;
      return { recipe: r, weight };
    });

    const totalWeight = itemsWithWeights.reduce((acc, item) => acc + item.weight, 0);
    if (totalWeight <= 0) {
      return pool[Math.floor(Math.random() * pool.length)];
    }

    let random = Math.random() * totalWeight;
    for (const item of itemsWithWeights) {
      if (random < item.weight) {
        return item.recipe;
      }
      random -= item.weight;
    }

    return pool[0];
  }

  static getDueItems(recipes: Recipe[]): Recipe[] {
    const all = this.loadAll();
    return recipes.filter(r => {
      const item = all[r.id];
      if (!item) return true;
      return item.weight > 35;
    });
  }

  static exportJSON(): string {
    const data = this.loadAll();
    return JSON.stringify(data, null, 2);
  }

  static importJSON(json: string): boolean {
    try {
      const data = JSON.parse(json);
      this.saveAll(data);
      return true;
    } catch {
      return false;
    }
  }

  static getSyncCode(): string | null {
    return localStorage.getItem('starbucks_srs_sync_code');
  }

  static setSyncCode(code: string) {
    if (!code) {
      localStorage.removeItem('starbucks_srs_sync_code');
    } else {
      localStorage.setItem('starbucks_srs_sync_code', code);
    }
  }

  static disconnectSyncCode() {
    localStorage.removeItem('starbucks_srs_sync_code');
    window.dispatchEvent(new Event('starbucks_srs_sync_updated'));
  }

  static async validateAndConnectSyncCode(code: string): Promise<{ success: boolean; isNewChannel: boolean; itemCount: number; message: string }> {
    const cleanCode = code.toUpperCase().trim();
    if (!cleanCode || cleanCode.length < 4) {
      return { success: false, isNewChannel: false, itemCount: 0, message: 'Sync code must be at least 4 characters long.' };
    }

    try {
      const res = await fetch(`https://kvdb.io/starbucks_srs_v1/${cleanCode}`);
      if (res.status === 404) {
        // Register new channel by uploading current local snapshot
        this.setSyncCode(cleanCode);
        await this.pushSync();
        return {
          success: true,
          isNewChannel: true,
          itemCount: Object.keys(this.loadAll()).length,
          message: `Created & registered new cloud sync channel '${cleanCode}'!`
        };
      } else if (!res.ok) {
        return {
          success: false,
          isNewChannel: false,
          itemCount: 0,
          message: `Cloud server error (${res.status} ${res.statusText}). Please try again later.`
        };
      } else {
        // Existing channel found: pull and merge!
        const remoteAll: Record<string, WeightData> = await res.json();
        this.setSyncCode(cleanCode);
        await this.pullSync();
        const itemCount = Object.keys(remoteAll).length;
        return {
          success: true,
          isNewChannel: false,
          itemCount,
          message: `Successfully connected to cloud channel '${cleanCode}'! Found ${itemCount} active recipe items.`
        };
      }
    } catch (e: any) {
      return {
        success: false,
        isNewChannel: false,
        itemCount: 0,
        message: `Network error connecting to cloud server: ${e?.message || 'Unable to reach kvdb.io'}`
      };
    }
  }

  static async pushSync() {
    const code = this.getSyncCode();
    if (!code) return;
    const all = this.loadAll();
    try {
      await fetch(`https://kvdb.io/starbucks_srs_v1/${code}`, {
        method: 'POST',
        body: JSON.stringify(all),
      });
    } catch (e) {
      console.error('Failed to push sync', e);
    }
  }

  static async pullSync() {
    const code = this.getSyncCode();
    if (!code) return;
    try {
      const res = await fetch(`https://kvdb.io/starbucks_srs_v1/${code}`);
      if (!res.ok) return;
      const remoteAll: Record<string, WeightData> = await res.json();
      
      const localAll = this.loadAll();
      let changed = false;

      for (const id in remoteAll) {
        const remote = remoteAll[id];
        const local = localAll[id];
        if (!local || (remote.lastGradedTimestamp || 0) > (local.lastGradedTimestamp || 0)) {
          localAll[id] = remote;
          changed = true;
        }
      }

      if (changed) {
        localStorage.setItem('starbucks_srs_backup', JSON.stringify(this.loadAll()));
        this.saveAll(localAll);
        window.dispatchEvent(new Event('starbucks_srs_sync_updated'));
      }
    } catch (e) {
      console.error('Failed to pull sync', e);
    }
  }

  static revertBackup(): boolean {
    const backup = localStorage.getItem('starbucks_srs_backup');
    if (backup) {
      localStorage.setItem(this.STORAGE_KEY, backup);
      return true;
    }
    return false;
  }

  static initAutoSync() {
    if (this.getSyncCode()) {
      this.pullSync();
    }
    
    window.addEventListener('focus', () => {
      if (this.getSyncCode()) this.pullSync();
    });

    setInterval(() => {
      if (this.getSyncCode()) this.pullSync();
    }, 30000);
  }
}
