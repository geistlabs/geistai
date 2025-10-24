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
    console.warn(
      'searchMemories called on MemoryService - use useMemoryManager.searchMemories instead',
    );
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

    console.log('🔢 [MemoryService] Getting embedding for text...');
    console.log('🔢 [MemoryService] Embedding URL:', embeddingUrl);
    console.log('🔢 [MemoryService] Text length:', text.length);
    console.log(
      '🔢 [MemoryService] Text preview:',
      text.substring(0, 100) + (text.length > 100 ? '...' : ''),
    );
    console.log('🔢 [MemoryService] Request body:', requestBody);

    try {
      const response = await fetch(embeddingUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log(
        '🔢 [MemoryService] Embedding response status:',
        response.status,
      );
      console.log(
        '🔢 [MemoryService] Embedding response headers:',
        Object.fromEntries(response.headers.entries()),
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.log(
          '🔢 [MemoryService] ❌ Embedding error response:',
          errorText,
        );
        throw new Error(
          `Embedding generation failed: ${response.status} - ${errorText}`,
        );
      }

      const result = await response.json();
      console.log('🔢 [MemoryService] Embedding result structure:', {
        hasData: !!result.data,
        dataLength: result.data?.length || 0,
        hasEmbedding: !!result.data?.[0]?.embedding,
        embeddingLength: result.data?.[0]?.embedding?.length || 0,
        fullResult: result,
      });

      const embedding = result.data[0]?.embedding || [];
      console.log(
        '🔢 [MemoryService] ✅ Embedding generated, length:',
        embedding.length,
      );

      return embedding;
    } catch (error) {
      console.log('🔢 [MemoryService] ❌ Failed to generate embedding:', error);
      console.log('🔢 [MemoryService] Embedding error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
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

  /**
   * Extract memories from a single user question using the dedicated memory extraction endpoint
   */
  async extractMemoriesFromQuestion(
    question: string,
    systemPrompt?: string,
  ): Promise<any[]> {
    console.log('🧠 [MemoryService] Extracting memories from user question...');
    console.log(
      '🧠 [MemoryService] Question:',
      question.substring(0, 100) + '...',
    );

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

      console.log(
        '🧠 [MemoryService] Memory response status:',
        response.status,
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.log(
          '🧠 [MemoryService] ❌ Memory extraction error:',
          errorText,
        );
        throw new Error(
          `Memory extraction failed: ${response.status} - ${errorText}`,
        );
      }

      const result = await response.json();
      console.log('🧠 [MemoryService] Raw memory extraction result:', result);

      // Extract the content from the response
      let content = '';
      if (result.choices && result.choices[0] && result.choices[0].message) {
        content = result.choices[0].message.content;
      } else if (result.response) {
        content = result.response;
      } else if (typeof result === 'string') {
        content = result;
      } else {
        console.log(
          '🧠 [MemoryService] ❌ Unexpected response format:',
          result,
        );
        return [];
      }

      console.log('🧠 [MemoryService] Extracted content:', content);

      // Parse the JSON array from the response
      try {
        const jsonContent = content.trim();
        const startIndex = jsonContent.indexOf('[');
        const endIndex = jsonContent.lastIndexOf(']');

        if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
          console.log(
            '🧠 [MemoryService] ❌ No valid JSON array found in response',
          );
          return [];
        }

        let jsonArrayString = jsonContent.substring(startIndex, endIndex + 1);

        // Clean up malformed JSON with trailing commas
        // Remove trailing commas before closing braces and brackets
        jsonArrayString = jsonArrayString
          .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas before } or ]
          .replace(/,(\s*\n\s*[}\]])/g, '$1'); // Handle newlines too

        console.log('🧠 [MemoryService] Cleaned JSON string:', jsonArrayString);

        const memories = JSON.parse(jsonArrayString);

        if (!Array.isArray(memories)) {
          console.log('🧠 [MemoryService] ❌ Parsed result is not an array');
          return [];
        }

        console.log(
          '🧠 [MemoryService] ✅ Successfully extracted memories:',
          memories,
        );
        return memories;
      } catch (parseError) {
        console.log('🧠 [MemoryService] ❌ JSON parsing failed:', parseError);
        console.log(
          '🧠 [MemoryService] Content that failed to parse:',
          content,
        );
        return [];
      }
    } catch (error) {
      console.log(
        '🧠 [MemoryService] ❌ Memory extraction from question failed:',
        error,
      );
      return [];
    }
  }

  /**
   * Test memory extraction from a question
   */
  async testMemoryExtractionFromQuestion(): Promise<void> {
    console.log(
      '🧠 [MemoryService] 🔧 Testing memory extraction from question...',
    );

    const testQuestion =
      "I'm a software engineer working with React Native and I prefer TypeScript. I'm currently building a mobile app for iOS.";

    try {
      const memories = await this.extractMemoriesFromQuestion(testQuestion);

      if (memories.length > 0) {
        console.log('🧠 [MemoryService] ✅ Memory extraction test successful!');
        console.log('🧠 [MemoryService] 🔧 Extracted memories:', memories);
      } else {
        console.log(
          '🧠 [MemoryService] ⚠️ No memories extracted from test question',
        );
      }
    } catch (error) {
      console.log(
        '🧠 [MemoryService] ❌ Memory extraction test failed:',
        error,
      );
    }
  }

  /**
   * Test the API endpoint with a simple request
   */
  async testApiEndpoint(): Promise<void> {
    console.log('🧠 [MemoryService] 🔧 Testing API endpoint...');
    console.log('🧠 [MemoryService] 🔧 API URL:', this.baseUrl);

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

      console.log(
        '🧠 [MemoryService] 🔧 Test response status:',
        response.status,
      );
      console.log(
        '🧠 [MemoryService] 🔧 Test response headers:',
        Object.fromEntries(response.headers.entries()),
      );

      if (response.ok) {
        const result = await response.json();
        console.log('🧠 [MemoryService] ✅ API endpoint test successful!');
        console.log('🧠 [MemoryService] 🔧 Test response:', result);
      } else {
        const errorText = await response.text();
        console.log(
          '🧠 [MemoryService] ❌ API endpoint test failed:',
          response.status,
          errorText,
        );
      }
    } catch (error) {
      console.log('🧠 [MemoryService] ❌ API endpoint test error:', error);
    }
  }
}

export const memoryService = new MemoryService();
