"use client";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL_MS = 60 * 1000; // 60 seconds

export const clientCache = {
  get<T>(key: string): T | null {
    const entry = memoryCache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttl) {
      memoryCache.delete(key);
      return null;
    }
    return entry.data;
  },

  set<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
    memoryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  },

  invalidate(keyOrPrefix?: string): void {
    if (!keyOrPrefix) {
      memoryCache.clear();
      return;
    }
    for (const key of memoryCache.keys()) {
      if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
        memoryCache.delete(key);
      }
    }
  },

  // Issue preview cache to render task/bug detail views in 0ms without skeletons
  setIssuePreview(id: string, previewData: unknown): void {
    this.set(`issue_preview_${id}`, previewData, 5 * 60 * 1000); // 5 min TTL
  },

  getIssuePreview<T>(id: string): T | null {
    return this.get<T>(`issue_preview_${id}`);
  },
};
