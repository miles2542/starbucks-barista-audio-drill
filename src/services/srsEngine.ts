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
    localStorage.setItem('starbucks_srs_backup', JSON.stringify(this.loadAll()));
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

  static exportSyncString(): string {
    const data = this.loadAll();
    return btoa(JSON.stringify(data));
  }

  static importJSON(input: string): boolean {
    if (!input) return false;
    let clean = input.trim();
    try {
      // Auto-detect base64 encoded strings from earlier QR exports (starting with ey... or non-JSON)
      if (clean.startsWith('ey') || (!clean.startsWith('{') && !clean.startsWith('['))) {
        try {
          clean = atob(clean);
        } catch (e) {}
      }
      const data = JSON.parse(clean);
      if (data && typeof data === 'object') {
        this.saveAll(data);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  static getSyncCode(): string | null {
    return localStorage.getItem('starbucks_srs_sync_code');
  }

  static setSyncCode(code: string) {
    localStorage.setItem('starbucks_srs_backup', JSON.stringify(this.loadAll()));
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

  static resolveBlobId(code: string): string {
    const cleanCode = code.trim();
    if (cleanCode.includes('jsonblob.com/')) {
      const parts = cleanCode.split('/');
      return parts[parts.length - 1];
    }
    const mapped = localStorage.getItem(`starbucks_srs_blob_${cleanCode.toUpperCase()}`);
    if (mapped) return mapped;
    return cleanCode;
  }

  static async createNewSyncChannel(code: string): Promise<{ success: boolean; itemCount: number; message: string }> {
    localStorage.setItem('starbucks_srs_backup', JSON.stringify(this.loadAll()));
    const cleanCode = code.toUpperCase().trim();
    if (!cleanCode || cleanCode.length < 4) {
      return { success: false, itemCount: 0, message: 'Sync code must be at least 4 characters long.' };
    }

    try {
      const all = this.loadAll();
      const res = await fetch(`https://jsonblob.com/api/jsonBlob`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(all),
      });
      
      if (!res.ok) {
        throw new Error('Failed to create jsonBlob');
      }

      const location = res.headers.get('Location');
      if (!location) {
        throw new Error('No Location header returned from jsonBlob');
      }

      const parts = location.split('/');
      const blobId = parts[parts.length - 1];
      
      localStorage.setItem(`starbucks_srs_blob_${cleanCode}`, blobId);
      this.setSyncCode(cleanCode);
      
      const itemCount = Object.keys(all).length;
      return {
        success: true,
        itemCount,
        message: `Registered new sync channel '${cleanCode}' with ${itemCount} recipe items! Share code '${cleanCode}' (or direct blobId: ${blobId}) with your other device.`
      };
    } catch (e: any) {
      return {
        success: false,
        itemCount: 0,
        message: `Network error connecting to cloud server: ${e?.message || 'Unable to reach jsonblob.com'}`
      };
    }
  }

  static async joinExistingSyncChannel(code: string): Promise<{ success: boolean; itemCount: number; message: string }> {
    localStorage.setItem('starbucks_srs_backup', JSON.stringify(this.loadAll()));
    const cleanCode = code.trim();
    if (!cleanCode || cleanCode.length < 4) {
      return { success: false, itemCount: 0, message: 'Sync code must be at least 4 characters long.' };
    }

    try {
      const blobId = this.resolveBlobId(cleanCode);
      const res = await fetch(`https://jsonblob.com/api/jsonBlob/${blobId}`, { cache: 'no-cache' });
      
      if (res.status === 404 || !res.ok) {
        return {
          success: false,
          itemCount: 0,
          message: `Channel '${cleanCode}' NOT FOUND on cloud server! Please verify the code/URL or click 'Create New Channel' on your primary device first.`
        };
      }

      const remoteAll: Record<string, WeightData> = await res.json();
      const itemCount = Object.keys(remoteAll).length;

      this.setSyncCode(cleanCode);
      await this.pullSync();

      return {
        success: true,
        itemCount,
        message: `Successfully connected to active channel! Downloaded and merged ${itemCount} recipe items from cloud.`
      };
    } catch (e: any) {
      return {
        success: false,
        itemCount: 0,
        message: `Network error connecting to cloud server: ${e?.message || 'Unable to reach jsonblob.com'}`
      };
    }
  }

  static async pushSync() {
    const code = this.getSyncCode();
    if (!code) return;
    const blobId = this.resolveBlobId(code);
    const all = this.loadAll();
    try {
      await fetch(`https://jsonblob.com/api/jsonBlob/${blobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(all),
      });
    } catch (e) {
      console.error('Failed to push sync', e);
    }
  }

  static async pullSync() {
    const code = this.getSyncCode();
    if (!code) return;
    const blobId = this.resolveBlobId(code);
    try {
      const res = await fetch(`https://jsonblob.com/api/jsonBlob/${blobId}`, { cache: 'no-cache' });
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
