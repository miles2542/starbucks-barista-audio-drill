import type { Recipe } from '../types/recipe';
import { HistoryEngine } from './historyEngine';

export interface WeightData {
  id: string;
  weight: number;
  correctCount: number;
  incorrectCount: number;
  turnsSinceLastGraded: number;
  consecutiveCorrect?: number;
  lastGradedTimestamp?: number;
  lastSpeedMs?: number;
}

export class SRSEngine {
  private static STORAGE_KEY = 'starbucks_srs_weights';
  private static MASTER_INDEX_BLOB_ID = '019fcd83-3d4a-7924-a444-3f85f9cdc26c';

  static getDisabledRecipeIds(): string[] {
    const saved = localStorage.getItem('starbucks_disabled_recipes');
    if (!saved) return [];
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  }

  static setDisabledRecipeIds(ids: string[]) {
    localStorage.setItem('starbucks_disabled_recipes', JSON.stringify(ids));
    window.dispatchEvent(new Event('starbucks_srs_sync_updated'));
  }

  static toggleRecipeDisabled(id: string) {
    const ids = this.getDisabledRecipeIds();
    const newIds = ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id];
    this.setDisabledRecipeIds(newIds);
    if (this.getSyncCode()) {
      this.pushSync();
    }
  }

  static getActiveRecipes(allRecipes: Recipe[]): Recipe[] {
    const disabledIds = new Set(this.getDisabledRecipeIds());
    return allRecipes.filter(r => !disabledIds.has(r.id));
  }

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
      item.consecutiveCorrect = (item.consecutiveCorrect || 0) + 1;
      let multiplier = 0.65;
      if (item.consecutiveCorrect === 2) {
        multiplier = 0.50;
      } else if (item.consecutiveCorrect >= 3) {
        multiplier = 0.40;
      }
      item.weight = Math.max(15, Math.round(item.weight * multiplier));
      item.correctCount = (item.correctCount || 0) + 1;
    } else {
      item.consecutiveCorrect = 0;
      item.weight = Math.min(250, Math.max(120, Math.round(item.weight * 1.8)));
      item.incorrectCount = (item.incorrectCount || 0) + 1;
    }

    item.turnsSinceLastGraded = 0;
    item.lastGradedTimestamp = Date.now();
    if (speedMs) item.lastSpeedMs = speedMs;

    const deckSize = Math.max(1, allRecipeIds.length);
    const idleThreshold = Math.max(3, Math.floor(deckSize * 0.75));

    allRecipeIds.forEach(rid => {
      if (rid !== id && all[rid]) {
        all[rid].turnsSinceLastGraded += 1;
        if (all[rid].turnsSinceLastGraded >= idleThreshold) {
          if (all[rid].weight <= 35) {
            all[rid].weight = Math.min(250, Math.round(all[rid].weight * 1.03));
          } else {
            all[rid].weight = Math.min(250, Math.round(all[rid].weight * 1.05));
          }
          all[rid].lastGradedTimestamp = Date.now();
        }
      }
    });

    all[id] = item;
    this.saveAll(all);

    if (this.getSyncCode()) {
      this.pushSync();
    }
  }

  static revertAndReGrade(id: string, targetPassStatus: boolean, allRecipeIds: string[], speedMs?: number) {
    this.revertBackup();
    this.updateItem(id, targetPassStatus, allRecipeIds, speedMs);
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

  // Master Index Cloud Registry helpers
  private static async fetchMasterIndex(): Promise<Record<string, string>> {
    try {
      const res = await fetch(`https://jsonblob.com/api/jsonBlob/${this.MASTER_INDEX_BLOB_ID}`, { cache: 'no-cache' });
      if (!res.ok) return {};
      return await res.json();
    } catch (e) {
      console.error('Failed to fetch Master Index', e);
      return {};
    }
  }

  private static async updateMasterIndex(code: string, blobId: string): Promise<boolean> {
    try {
      const index = await this.fetchMasterIndex();
      index[code.toUpperCase()] = blobId;
      const res = await fetch(`https://jsonblob.com/api/jsonBlob/${this.MASTER_INDEX_BLOB_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(index)
      });
      return res.ok;
    } catch (e) {
      console.error('Failed to update Master Index', e);
      return false;
    }
  }

  private static async resolveBlobIdFromCode(code: string): Promise<string | null> {
    const clean = code.trim();
    if (clean.length > 20 || clean.includes('/')) {
      const parts = clean.split('/');
      return parts[parts.length - 1];
    }
    
    const masterIndex = await this.fetchMasterIndex();
    const masterBlobId = masterIndex[clean.toUpperCase()];
    if (masterBlobId) {
      localStorage.setItem(`starbucks_srs_blob_${clean.toUpperCase()}`, masterBlobId);
      return masterBlobId;
    }

    const localMapped = localStorage.getItem(`starbucks_srs_blob_${clean.toUpperCase()}`);
    if (localMapped) return localMapped;

    return null;
  }

  // Real Cloud Check 1: Register brand-new channel
  static async createNewSyncChannel(code: string, forceOverwrite = false): Promise<{ success: boolean; itemCount: number; message: string; codeExists?: boolean }> {
    localStorage.setItem('starbucks_srs_backup', JSON.stringify(this.loadAll()));
    const cleanCode = code.toUpperCase().trim();
    if (!cleanCode || cleanCode.length < 4) {
      return { success: false, itemCount: 0, message: 'Sync code must be at least 4 characters long.' };
    }

    try {
      const existingBlobId = await this.resolveBlobIdFromCode(cleanCode);
      if (existingBlobId && !forceOverwrite) {
        return {
          success: false,
          itemCount: 0,
          codeExists: true,
          message: `Sync channel '${cleanCode}' ALREADY EXISTS on cloud server! If you want to overwrite cloud data with your local progress, click 'Upload Local Progress to Cloud'. Otherwise click 'Join Existing Channel'.`
        };
      }

      const all = this.loadAll();
      let blobId = existingBlobId;

      if (!blobId) {
        const payload = {
          weights: all,
          history: HistoryEngine.getRawLogs(),
          disabledRecipes: this.getDisabledRecipeIds()
        };
        const res = await fetch(`https://jsonblob.com/api/jsonBlob`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        
        if (!res.ok) throw new Error('Failed to create cloud storage blob');

        const location = res.headers.get('Location');
        if (!location) throw new Error('No Location header returned from cloud server');

        const parts = location.split('/');
        blobId = parts[parts.length - 1];
      } else {
        // Overwrite existing blob
        const payload = {
          weights: all,
          history: HistoryEngine.getRawLogs(),
          disabledRecipes: this.getDisabledRecipeIds()
        };
        await fetch(`https://jsonblob.com/api/jsonBlob/${blobId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      
      localStorage.setItem(`starbucks_srs_blob_${cleanCode}`, blobId);
      await this.updateMasterIndex(cleanCode, blobId);
      this.setSyncCode(cleanCode);
      
      const itemCount = Object.keys(all).length;
      return {
        success: true,
        itemCount,
        message: `Registered & uploaded ${itemCount} recipe items to sync channel '${cleanCode}'! Enter code '${cleanCode}' on your other device and click 'Join Existing Channel'.`
      };
    } catch (e: any) {
      return {
        success: false,
        itemCount: 0,
        message: `Network error connecting to cloud server: ${e?.message || 'Unable to reach jsonblob.com'}`
      };
    }
  }

  // Real Cloud Check 2: Join existing channel (MUST exist on server)
  static async joinExistingSyncChannel(code: string): Promise<{ success: boolean; itemCount: number; message: string }> {
    localStorage.setItem('starbucks_srs_backup', JSON.stringify(this.loadAll()));
    const cleanCode = code.toUpperCase().trim();
    if (!cleanCode || cleanCode.length < 4) {
      return { success: false, itemCount: 0, message: 'Sync code must be at least 4 characters long.' };
    }

    try {
      const blobId = await this.resolveBlobIdFromCode(cleanCode);
      if (!blobId) {
        return {
          success: false,
          itemCount: 0,
          message: `Channel '${cleanCode}' NOT FOUND on cloud server! Please verify the code or click 'Create New Channel' on your primary device first.`
        };
      }

      const res = await fetch(`https://jsonblob.com/api/jsonBlob/${blobId}`, { cache: 'no-cache' });
      if (res.status === 404 || !res.ok) {
        return {
          success: false,
          itemCount: 0,
          message: `Channel '${cleanCode}' data blob not found on cloud server. Please recreate the channel on your primary device.`
        };
      }

      const remoteData: any = await res.json();
      const remoteAll: Record<string, WeightData> = remoteData.weights || remoteData;
      const itemCount = Object.keys(remoteAll).length;

      localStorage.setItem(`starbucks_srs_blob_${cleanCode}`, blobId);
      this.setSyncCode(cleanCode);
      await this.pullSync();

      return {
        success: true,
        itemCount,
        message: `Successfully connected to active channel '${cleanCode}'! Downloaded and merged ${itemCount} recipe items from cloud.`
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
    const blobId = await this.resolveBlobIdFromCode(code);
    if (!blobId) return;

    const all = this.loadAll();
    const payload = {
      weights: all,
      history: HistoryEngine.getRawLogs(),
      disabledRecipes: this.getDisabledRecipeIds()
    };
    try {
      const res = await fetch(`https://jsonblob.com/api/jsonBlob/${blobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.status === 404 || !res.ok) {
        const createRes = await fetch(`https://jsonblob.com/api/jsonBlob`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (createRes.ok) {
          const location = createRes.headers.get('Location');
          if (location) {
            const parts = location.split('/');
            const newBlobId = parts[parts.length - 1];
            await this.updateMasterIndex(code, newBlobId);
            localStorage.setItem('starbucks_srs_blob_' + code.toUpperCase(), newBlobId);
          }
        }
      }
    } catch (e) {
      console.error('Failed to push sync', e);
    }
  }

  static async pullSync() {
    const code = this.getSyncCode();
    if (!code) return;
    let blobId = await this.resolveBlobIdFromCode(code);
    if (!blobId) return;

    try {
      let res = await fetch(`https://jsonblob.com/api/jsonBlob/${blobId}`, { cache: 'no-cache' });
      if (res.status === 404) {
        localStorage.removeItem('starbucks_srs_blob_' + code.toUpperCase());
        const masterIndex = await this.fetchMasterIndex();
        const masterBlobId = masterIndex[code.toUpperCase()];
        if (masterBlobId && masterBlobId !== blobId) {
          blobId = masterBlobId;
          res = await fetch(`https://jsonblob.com/api/jsonBlob/${blobId}`, { cache: 'no-cache' });
        }
        if (res.status === 404) {
          console.error(`Channel '${code}' expired on cloud. Click 'Push to Cloud' on your primary device to re-publish.`);
          return;
        }
      }
      if (!res.ok) return;
      const remoteData: any = await res.json();
      const remoteAll: Record<string, WeightData> = remoteData.weights || remoteData;
      
      const localAll = this.loadAll();
      let changed = false;

      for (const id in remoteAll) {
        const remote = remoteAll[id];
        const local = localAll[id];
        
        if (!local) {
          localAll[id] = remote;
          changed = true;
          continue;
        }

        let itemChanged = false;
        
        const newCorrect = Math.max(local.correctCount || 0, remote.correctCount || 0);
        if (newCorrect !== local.correctCount) {
          local.correctCount = newCorrect;
          itemChanged = true;
        }

        const newIncorrect = Math.max(local.incorrectCount || 0, remote.incorrectCount || 0);
        if (newIncorrect !== local.incorrectCount) {
          local.incorrectCount = newIncorrect;
          itemChanged = true;
        }

        const remoteTime = remote.lastGradedTimestamp || 0;
        const localTime = local.lastGradedTimestamp || 0;
        const remoteTotal = (remote.correctCount || 0) + (remote.incorrectCount || 0);
        const localTotal = (local.correctCount || 0) + (local.incorrectCount || 0);

        if (remoteTime > localTime || (remoteTime === localTime && remoteTotal > localTotal)) {
          local.weight = remote.weight;
          local.consecutiveCorrect = remote.consecutiveCorrect;
          local.turnsSinceLastGraded = remote.turnsSinceLastGraded;
          local.lastSpeedMs = remote.lastSpeedMs;
          local.lastGradedTimestamp = remote.lastGradedTimestamp;
          itemChanged = true;
        }

        if (itemChanged) {
          changed = true;
        }
      }
      
      if (remoteData.history && Array.isArray(remoteData.history)) {
          const localHistory = HistoryEngine.getRawLogs();
          const merged = [...localHistory, ...remoteData.history];
          const deduplicated = merged.filter((log, index, self) => index === self.findIndex(t => t.id === log.id));
          deduplicated.sort((a, b) => b.timestamp - a.timestamp);
          HistoryEngine.setRawLogs(deduplicated);
      }

      if (remoteData.disabledRecipes && Array.isArray(remoteData.disabledRecipes)) {
          this.setDisabledRecipeIds(remoteData.disabledRecipes);
          changed = true;
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

  static async pushToCloud() {
    const code = this.getSyncCode();
    if (!code) return { success: false, message: 'No sync code active.' };
    let blobId = await this.resolveBlobIdFromCode(code);
    if (!blobId) {
      return await this.createNewSyncChannel(code, true);
    }

    const all = this.loadAll();
    const payload = {
      weights: all,
      history: HistoryEngine.getRawLogs(),
      disabledRecipes: this.getDisabledRecipeIds()
    };
    try {
      const res = await fetch(`https://jsonblob.com/api/jsonBlob/${blobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.status === 404 || !res.ok) {
        const createRes = await fetch(`https://jsonblob.com/api/jsonBlob`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!createRes.ok) throw new Error('Failed to create new cloud storage blob');
        const location = createRes.headers.get('Location');
        if (!location) throw new Error('No Location header returned from cloud server');
        const parts = location.split('/');
        const newBlobId = parts[parts.length - 1];
        await this.updateMasterIndex(code, newBlobId);
        localStorage.setItem('starbucks_srs_blob_' + code.toUpperCase(), newBlobId);
        return { success: true, message: 'Cloud channel re-established & local progress uploaded!' };
      }
      if (res.ok) {
        return { success: true, message: 'Successfully pushed local progress to cloud.' };
      }
      return { success: false, message: 'Failed to push to cloud server.' };
    } catch (e: any) {
      return { success: false, message: `Network error: ${e?.message}` };
    }
  }

  static async downloadFromCloud() {
    const code = this.getSyncCode();
    if (!code) return { success: false, message: 'No sync code active.' };
    let blobId = await this.resolveBlobIdFromCode(code);
    if (!blobId) return { success: false, message: 'Could not resolve cloud channel.' };

    try {
      let res = await fetch(`https://jsonblob.com/api/jsonBlob/${blobId}`, { cache: 'no-cache' });
      if (res.status === 404) {
        localStorage.removeItem('starbucks_srs_blob_' + code.toUpperCase());
        const masterIndex = await this.fetchMasterIndex();
        const masterBlobId = masterIndex[code.toUpperCase()];
        if (masterBlobId && masterBlobId !== blobId) {
          blobId = masterBlobId;
          res = await fetch(`https://jsonblob.com/api/jsonBlob/${blobId}`, { cache: 'no-cache' });
        }
        if (res.status === 404) {
          return { success: false, message: `Channel '${code}' expired on cloud. Click 'Push to Cloud' on your primary device to re-publish.` };
        }
      }
      if (!res.ok) return { success: false, message: 'Failed to download from cloud server.' };
      const remoteData: any = await res.json();
      const remoteAll: Record<string, WeightData> = remoteData.weights || remoteData;
      
      if (remoteData.history && Array.isArray(remoteData.history)) {
          HistoryEngine.setRawLogs(remoteData.history);
      }
      
      if (remoteData.disabledRecipes && Array.isArray(remoteData.disabledRecipes)) {
          this.setDisabledRecipeIds(remoteData.disabledRecipes);
      }
      
      localStorage.setItem('starbucks_srs_backup', JSON.stringify(this.loadAll()));
      this.saveAll(remoteAll);
      window.dispatchEvent(new Event('starbucks_srs_sync_updated'));
      return { success: true, message: 'Successfully downloaded and applied cloud progress.' };
    } catch (e: any) {
      return { success: false, message: `Network error: ${e?.message}` };
    }
  }

  static async bidirectionalSync() {
    await this.pullSync();
    await this.pushSync();
  }

  static initAutoSync() {
    if (this.getSyncCode()) {
      this.pullSync();
    }
    
    const onFocus = () => {
      if (this.getSyncCode()) this.pullSync();
    };
    window.addEventListener('focus', onFocus);

    const interval = setInterval(() => {
      if (this.getSyncCode()) this.pullSync();
    }, 30000);

    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }
}
