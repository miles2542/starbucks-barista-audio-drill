import type { EvaluationDebugLog } from './geminiGrader';

export interface RecitationLog {
  id: string;
  timestamp: number;
  recipeId: string;
  recipeName: string;
  recipeCode?: string;
  pass: boolean;
  speedMs?: number;
  transcript: string;
  debugLog: EvaluationDebugLog;
  audioId?: string;
}

const HISTORY_KEY = 'starbucks_recitation_history';
const MAX_HISTORY = 100;
const DB_NAME = 'starbucks_audio_db';
const DB_VERSION = 1;
const STORE_NAME = 'audio_blobs';

class HistoryEngineClass {
  private dbPromise: Promise<IDBDatabase>;

  constructor() {
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
    });
  }

  private async saveAudioBlob(blob: Blob): Promise<string> {
    const id = crypto.randomUUID();
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(blob, id);
      
      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(request.error);
    });
  }

  async getAudioBlob(audioId: string): Promise<Blob | null> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(audioId);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async addLog(log: Omit<RecitationLog, 'id'>, audioBlob?: Blob): Promise<RecitationLog> {
    let audioId: string | undefined;
    if (audioBlob) {
      try {
        audioId = await this.saveAudioBlob(audioBlob);
      } catch (e) {
        console.error("Failed to save audio blob to IndexedDB", e);
      }
    }

    const newLog: RecitationLog = {
      ...log,
      id: crypto.randomUUID(),
      audioId
    };

    const logs = this.getAllLogs();
    logs.unshift(newLog);

    if (logs.length > MAX_HISTORY) {
      const excess = logs.slice(MAX_HISTORY);
      excess.forEach(async (l) => {
        if (l.audioId) {
          try {
            const db = await this.dbPromise;
            db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(l.audioId);
          } catch (e) {
            // ignore
          }
        }
      });
      logs.splice(MAX_HISTORY);
    }

    this.saveLogs(logs);
    return newLog;
  }

  getAllLogs(): RecitationLog[] {
    const saved = localStorage.getItem(HISTORY_KEY);
    if (!saved) return [];
    try {
      return JSON.parse(saved) as RecitationLog[];
    } catch {
      return [];
    }
  }

  getLogsForRecipe(recipeId: string): RecitationLog[] {
    return this.getAllLogs().filter(log => log.recipeId === recipeId);
  }

  updateLogGrade(id: string, newPass: boolean): void {
    const logs = this.getAllLogs();
    const idx = logs.findIndex(l => l.id === id);
    if (idx !== -1) {
      logs[idx].pass = newPass;
      this.saveLogs(logs);
    }
  }

  getRawLogs(): RecitationLog[] {
    return this.getAllLogs();
  }
  
  setRawLogs(logs: RecitationLog[]) {
    if (logs.length > MAX_HISTORY) {
      logs = logs.slice(0, MAX_HISTORY);
    }
    this.saveLogs(logs);
  }

  private saveLogs(logs: RecitationLog[]) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(logs));
  }
}

export const HistoryEngine = new HistoryEngineClass();
