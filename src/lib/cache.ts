import { LRUCache } from "lru-cache";

/**
 * In-memory LRU cache for quiz data
 * Reduces database queries for frequently accessed quizzes
 */

// Quiz cache - stores full quiz objects with questions and translations
const quizCache = new LRUCache<string, any>({
  max: 100, // Cache up to 100 quizzes
  ttl: 1000 * 60 * 5, // 5 minute TTL
  updateAgeOnGet: true, // Reset TTL when accessed
});

// Quiz list cache - stores the list of all quizzes
const quizListCache = new LRUCache<string, any>({
  max: 1, // Only cache the single list response
  ttl: 1000 * 60, // 1 minute TTL (shorter since list changes more frequently)
});

/**
 * Get a cached quiz by ID
 */
export function getCachedQuiz(quizId: string): any | undefined {
  return quizCache.get(quizId);
}

/**
 * Cache a quiz by ID
 */
export function setCachedQuiz(quizId: string, data: any): void {
  quizCache.set(quizId, data);
}

/**
 * Invalidate a specific quiz from cache
 * Call this when a quiz is updated or deleted
 */
export function invalidateQuizCache(quizId: string): void {
  quizCache.delete(quizId);
  // Also invalidate the quiz list cache since the quiz has changed
  invalidateQuizListCache();
}

/**
 * Get the cached quiz list
 */
export function getCachedQuizList(): any | undefined {
  return quizListCache.get("list");
}

/**
 * Cache the quiz list
 */
export function setCachedQuizList(data: any): void {
  quizListCache.set("list", data);
}

/**
 * Invalidate the quiz list cache
 * Call this when any quiz is created, updated, or deleted
 */
export function invalidateQuizListCache(): void {
  quizListCache.delete("list");
}

/**
 * Clear all caches
 * Useful for testing or manual cache invalidation
 */
export function clearAllCaches(): void {
  quizCache.clear();
  quizListCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    quizCache: {
      size: quizCache.size,
      max: quizCache.max,
    },
    quizListCache: {
      size: quizListCache.size,
      max: quizListCache.max,
    },
  };
}
