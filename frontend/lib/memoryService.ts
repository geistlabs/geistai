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
   * Extract key facts/memories from a conversation using local LLM call
   */
  async extractMemories(request: MemoryExtractionRequest): Promise<MemoryExtractionResponse> {
    try {
      // Create extraction prompt
      const conversationText = request.messages
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');
      
      const extractionPrompt = `Analyze the following conversation and extract key facts, preferences, and contextual information that would be useful to remember for future conversations. Focus on:

1. Personal information (name, location, job, interests, etc.)
2. Technical preferences (tools, languages, frameworks, etc.)
3. User preferences (communication style, specific needs, etc.)
4. Important context (current projects, goals, constraints, etc.)

For each fact, provide:
- A concise summary (1-2 sentences max)
- A category (personal, technical, preference, context, other)
- A relevance score (0.0-1.0)

Conversation:
${conversationText}

Extract up to ${request.maxMemories || 10} key facts. Return as JSON array with format:
[{"content": "fact summary", "category": "category", "relevanceScore": 0.8, "originalContext": "relevant snippet from conversation"}]

Only return the JSON array, no other text.`;

      // Call the existing chat endpoint for extraction
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: extractionPrompt,
          messages: [], // No conversation history for extraction
        }),
      });

      if (!response.ok) {
        throw new Error(`Memory extraction failed: ${response.status}`);
      }

      const result = await response.json();
      const content = result.response || '';
      
      // Parse extracted memories
      try {
        const memories = JSON.parse(content);
        if (!Array.isArray(memories)) {
          return {
            memories: [],
            success: false,
            error: 'Invalid response format from LLM',
          };
        }
        
        // Add metadata
        const processedMemories = memories.map(memory => ({
          ...memory,
          chatId: request.chatId,
          messageIds: request.messages.map(msg => parseInt(msg.id || '0')).filter(id => id > 0),
        }));
        
        return {
          memories: processedMemories,
          success: true,
        };
      } catch (parseError) {
        console.warn('Failed to parse LLM response:', content);
        return {
          memories: [],
          success: false,
          error: 'Failed to parse LLM response',
        };
      }
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
   * Search for relevant memories based on query (local implementation)
   * This method is now handled entirely by the useMemoryManager hook
   * using local storage and embeddings
   */
  async searchMemories(request: MemorySearchRequest): Promise<MemorySearchResult[]> {
    // This method is deprecated in favor of local search in useMemoryManager
    // It's kept for interface compatibility but returns empty results
    console.warn('searchMemories called on MemoryService - use useMemoryManager.searchMemories instead');
    return [];
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
