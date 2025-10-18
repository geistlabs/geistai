import { ENV } from './config/environment';
import { ChatMessage } from './api/chat';

export interface Memory {
  id: string;
  chatId: number;
  content: string; // The extracted key fact
  originalContext: string; // Original conversation snippet
  embedding: number[];
  relevanceScore: number;
  extractedAt: number;
  messageIds: number[]; // Source message IDs
  category: 'personal' | 'technical' | 'preference' | 'context' | 'other';
}

export interface MemoryExtractionRequest {
  chatId: number;
  messages: ChatMessage[];
  maxMemories?: number;
}

export interface MemoryExtractionResponse {
  memories: Omit<Memory, 'id' | 'embedding' | 'extractedAt'>[];
  success: boolean;
  error?: string;
}

export interface MemorySearchRequest {
  query: string;
  excludeChatId?: number;
  limit?: number;
  threshold?: number;
}

export interface MemorySearchResult {
  memory: Memory;
  similarity: number;
}

/**
 * Memory Service for extracting and managing conversational memories
 */
export class MemoryService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = ENV.API_URL;
  }

  /**
   * Extract key facts/memories from a conversation
   */
  async extractMemories(request: MemoryExtractionRequest): Promise<MemoryExtractionResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/memory/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Memory extraction failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to extract memories:', error);
      return {
        memories: [],
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Search for relevant memories based on query
   */
  async searchMemories(request: MemorySearchRequest): Promise<MemorySearchResult[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/memory/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Memory search failed: ${response.status}`);
      }

      const result = await response.json();
      return result.memories || [];
    } catch (error) {
      console.error('Failed to search memories:', error);
      return [];
    }
  }

  /**
   * Get embeddings for text using the backend service
   */
  async getEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch(`${this.baseUrl}/embeddings/embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: text,
          model: 'all-MiniLM-L6-v2',
        }),
      });

      if (!response.ok) {
        throw new Error(`Embedding generation failed: ${response.status}`);
      }

      const result = await response.json();
      return result.data[0]?.embedding || [];
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      return [];
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Format memories for context injection
   */
  formatMemoriesForContext(memories: MemorySearchResult[]): string {
    if (memories.length === 0) return '';

    const formattedMemories = memories
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5) // Top 5 most relevant
      .map((result, index) => {
        const { memory } = result;
        return `${index + 1}. [${memory.category.toUpperCase()}] ${memory.content}`;
      })
      .join('\n');

    return `Previous conversation context:\n${formattedMemories}\n\n`;
  }
}

export const memoryService = new MemoryService();
