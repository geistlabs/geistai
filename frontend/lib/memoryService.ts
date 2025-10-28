import { ENV } from './config/environment';

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
   * Search for relevant memories based on query (local implementation)
   * This method is now handled entirely by the useMemoryManager hook
   * using local storage and embeddings
   */
  async searchMemories(
    request: MemorySearchRequest,
  ): Promise<MemorySearchResult[]> {
    // This method is deprecated in favor of local search in useMemoryManager
    // It's kept for interface compatibility but returns empty results
    return [];
  }

  /**
   * Get embeddings for text using the backend service
   */
  async getEmbedding(text: string): Promise<number[]> {
    const embeddingUrl = `${this.baseUrl}/embeddings/embed`;
    const requestBody = {
      input: text,
      model: 'all-MiniLM-L6-v2',
    };

    try {
      const response = await fetch(embeddingUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Embedding generation failed: ${response.status} - ${errorText}`,
        );
      }

      const result = await response.json();

      const embedding = result.data[0]?.embedding || [];

      return embedding;
    } catch (error) {
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
        const similarity = (result.similarity * 100).toFixed(1);
        return `${index + 1}. [${memory.category.toUpperCase()}] ${memory.content} (${similarity}% relevant)`;
      })
      .join('\n');

    return `## Relevant Context from Previous Conversations

Based on your conversation history, here are some relevant facts about you:

${formattedMemories}

This context helps me provide more personalized responses based on your preferences and previous discussions.`;
  }

  /**
   * Extract memories from a single user question using the dedicated memory extraction endpoint
   */
  async extractMemoriesFromQuestion(
    question: string,
    systemPrompt?: string,
  ): Promise<any[]> {
    const defaultSystemPrompt = `Extract key facts from user input and return ONLY a JSON array. No explanations, no reasoning, no other text.

Extract facts about:
1. Personal info (name, location, job, interests)
2. Technical preferences (tools, languages, frameworks)  
3. User preferences (communication style, needs)
4. Important context (projects, goals, constraints)

Format: [{"content": "fact summary", "category": "personal|technical|preference|context|other", "relevanceScore": 0.8, "originalContext": "snippet from input"}]

CRITICAL: Your response must start with [ and end with ]. Nothing else. No reasoning. No explanations. Just the JSON array.`;

    const requestBody = {
      model: 'llama3.1',
      messages: [
        {
          role: 'system',
          content: systemPrompt || defaultSystemPrompt,
        },
        {
          role: 'user',
          content: question,
        },
      ],
      temperature: 0.1,
      max_tokens: 1000,
    };

    try {
      const response = await fetch(`${this.baseUrl}/api/memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Memory extraction failed: ${response.status} - ${errorText}`,
        );
      }

      const result = await response.json();

      // Extract the content from the response
      let content = '';
      if (result.choices && result.choices[0] && result.choices[0].message) {
        content = result.choices[0].message.content;
      } else if (result.response) {
        content = result.response;
      } else if (typeof result === 'string') {
        content = result;
      } else {
        return [];
      }

      // Parse the JSON array from the response
      try {
        const jsonContent = content.trim();
        const startIndex = jsonContent.indexOf('[');
        const endIndex = jsonContent.lastIndexOf(']');

        if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
          return [];
        }

        let jsonArrayString = jsonContent.substring(startIndex, endIndex + 1);

        // Clean up malformed JSON with trailing commas
        // Remove trailing commas before closing braces and brackets
        jsonArrayString = jsonArrayString
          .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas before } or ]
          .replace(/,(\s*\n\s*[}\]])/g, '$1'); // Handle newlines too

        const memories = JSON.parse(jsonArrayString);

        if (!Array.isArray(memories)) {
          return [];
        }

        return memories;
      } catch (parseError) {
        return [];
      }
    } catch (error) {
      return [];
    }
  }

  /**
   * Test memory extraction from a question
   */
  async testMemoryExtractionFromQuestion(): Promise<void> {
    const testQuestion =
      "I'm a software engineer working with React Native and I prefer TypeScript. I'm currently building a mobile app for iOS.";

    try {
      const memories = await this.extractMemoriesFromQuestion(testQuestion);
    } catch (error) {
      // Test failed
    }
  }

  /**
   * Test the API endpoint with a simple request
   */
  async testApiEndpoint(): Promise<void> {
    const testRequest = {
      message: 'Test simple message',
      messages: [],
    };

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testRequest),
      });

      if (response.ok) {
        const result = await response.json();
      } else {
        const errorText = await response.text();
      }
    } catch (error) {
      // Test failed
    }
  }
}

export const memoryService = new MemoryService();
