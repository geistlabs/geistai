// Utility functions for working with embeddings

import { StoredEmbedding } from './indexedDB';

export interface SimilarityResult {
  embedding: StoredEmbedding;
  similarity: number;
}

/**
 * Calculate cosine similarity between two embedding vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embedding vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * Find similar embeddings based on cosine similarity
 */
export function findSimilarEmbeddings(
  queryEmbedding: number[],
  embeddings: StoredEmbedding[],
  threshold: number = 0.7,
  limit: number = 10
): SimilarityResult[] {
  const results: SimilarityResult[] = [];

  for (const embedding of embeddings) {
    try {
      const similarity = cosineSimilarity(queryEmbedding, embedding.embedding);
      if (similarity >= threshold) {
        results.push({ embedding, similarity });
      }
    } catch (error) {
      console.warn('Failed to calculate similarity for embedding:', embedding.id, error);
    }
  }

  // Sort by similarity (highest first) and limit results
  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/**
 * Find embeddings from the same chat conversation
 */
export function getChatContext(
  chatId: string,
  embeddings: StoredEmbedding[],
  excludeMessageId?: string
): StoredEmbedding[] {
  return embeddings
    .filter(embedding => 
      embedding.chatId === chatId && 
      embedding.id !== excludeMessageId
    )
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/**
 * Find embeddings from different chat conversations (for cross-chat context)
 */
export function getCrossChatContext(
  currentChatId: string,
  embeddings: StoredEmbedding[],
  limit: number = 5
): StoredEmbedding[] {
  return embeddings
    .filter(embedding => embedding.chatId !== currentChatId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

/**
 * Format similarity score for display
 */
export function formatSimilarityScore(similarity: number): string {
  return `${(similarity * 100).toFixed(1)}%`;
}

/**
 * Get embedding statistics for a chat
 */
export function getChatEmbeddingStats(embeddings: StoredEmbedding[]): {
  totalEmbeddings: number;
  userMessages: number;
  assistantMessages: number;
  averageDimensions: number;
  models: string[];
} {
  const userMessages = embeddings.filter(e => e.metadata?.role === 'user').length;
  const assistantMessages = embeddings.filter(e => e.metadata?.role === 'assistant').length;
  const models = Array.from(new Set(embeddings.map(e => e.model)));
  const averageDimensions = embeddings.length > 0 
    ? embeddings.reduce((sum, e) => sum + e.embedding.length, 0) / embeddings.length 
    : 0;

  return {
    totalEmbeddings: embeddings.length,
    userMessages,
    assistantMessages,
    averageDimensions: Math.round(averageDimensions),
    models
  };
}
