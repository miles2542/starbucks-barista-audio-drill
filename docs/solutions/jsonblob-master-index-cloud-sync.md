---
title: "Multi-Tier JsonBlob Master Index Cloud Auto-Sync & Backup Safeguards"
category: "architecture"
problem_type: "cloud_sync_data_loss"
component: "srsEngine.ts"
tags: ["jsonblob", "auto-sync", "master-index", "localstorage", "backup-snapshot"]
date: "2026-08-05"
---

# Multi-Tier JsonBlob Master Index Cloud Auto-Sync & Backup Safeguards

## Problem
1. Initial KV storage attempts using `kvdb.io` failed due to HTTP 403 Forbidden / strict CORS policies on web browsers.
2. Direct blob sharing required users to manually copy/paste long UUIDs across devices, resulting in "channel not found" errors when typing short sync codes (e.g. `BANANA`).
3. Joining a new or empty sync channel wiped local drill progress on the secondary device because incoming remote state was empty and no pre-sync snapshot was preserved.

## Solution

### 1. Master Index Architecture (`jsonblob.com`)
* **Coordinator Blob:** A permanent, public Master Index Blob ID (`019fcd83-3d4a-7924-a444-3f85f9cdc26c`) acts as a centralized registry.
* **Short Code Mapping:** Maps 6-character uppercase codes (e.g. `BANANA`, `MILESX`) to individual JSONBlob storage IDs:
  ```json
  {
    "BANANA": "019fcd8d-a41b-7a2e-b3f9-8d1234567890",
    "MILESX": "019fcd91-c12e-7b3f-a890-9f0987654321"
  }
  ```
* **REST Lifecycle:**
  * **Create Channel:** POSTs a new blob to `https://jsonblob.com/api/jsonBlob`, registers `CODE -> blobId` in Master Index via PUT.
  * **Join Channel:** Fetches Master Index via GET, resolves `blobId`, pulls remote state, and merges locally.
  * **Auto-Sync Trigger:** Auto-pulls on `window.onfocus` or periodic 30-second background interval.

### 2. Pre-Sync Backup Snapshot Safeguard
* Before any cloud channel creation, join, sync, or revert operation, `srsEngine.ts` automatically executes:
  ```typescript
  localStorage.setItem('starbucks_srs_backup', JSON.stringify(this.loadAll()));
  ```
* If a sync attempt overwrites local state or connects to an empty channel, the user can click **"Revert to Local Backup Snapshot"** in Settings to instantly restore pre-sync data.

### 3. Timestamp-Based State Merging
* Merges local and cloud JSON states per recipe ID using `lastGradedTimestamp`:
  * Keeps whichever recipe drill entry has the **newest timestamp**.
  * Ensures progress on PC (e.g. 6 mastered recipes) merges cleanly with phone progress without losing drill counts.

## Key Learnings & Error Avoidance
* **Never perform cloud sync without a pre-sync local backup:** Always snapshot `localStorage` before merging remote payloads.
* **Avoid CORS-restricted KV hosts:** Use REST services (`jsonblob.com`) that natively support cross-origin GET/POST/PUT without API key headers.
