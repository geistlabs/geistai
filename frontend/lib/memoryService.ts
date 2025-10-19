import { ChatMessage } from './api/chat';
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
  async extractMemories(
    request: MemoryExtractionRequest,
  ): Promise<MemoryExtractionResponse> {
    console.log('🧠 [MemoryService] Starting memory extraction...');
    console.log('🧠 [MemoryService] Request:', {
      chatId: request.chatId,
      messageCount: request.messages.length,
      maxMemories: request.maxMemories || 10,
      baseUrl: this.baseUrl,
    });

    // Add timeout and retry logic for memory extraction
    const MEMORY_EXTRACTION_TIMEOUT = 120000; // 120 seconds (2 minutes)
    // const MAX_RETRIES = 2; // Reserved for future retry logic

    try {
      // Create extraction prompt - only include user messages for faster processing
      const userMessages = request.messages
        .filter(msg => msg.role === 'user')
        .map(msg => msg.content)
        .join('\n\n');

      console.log(
        '🧠 [MemoryService] User messages text length:',
        userMessages.length,
      );
      console.log(
        '🧠 [MemoryService] First 200 chars of user messages:',
        userMessages.substring(0, 200) + '...',
      );

      const extractionPrompt = `Extract key facts, preferences, and contextual information from the following user input that would be useful to remember for future conversations. Focus on:

1. Personal information (name, location, job, interests, etc.)
2. Technical preferences (tools, languages, frameworks, etc.)
3. User preferences (communication style, specific needs, etc.)
4. Important context (current projects, goals, constraints, etc.)

For each fact, provide:
- A concise summary (1-2 sentences max)
- A category (personal, technical, preference, context, other)
- A relevance score (0.0-1.0)

User input:
${userMessages}

Extract up to ${request.maxMemories || 10} key facts. Return ONLY a JSON array with this exact format:
[{"content": "fact summary", "category": "category", "relevanceScore": 0.8, "originalContext": "relevant snippet from user input"}]

CRITICAL: Return ONLY the JSON array. Do not include any explanations, reasoning, or other text before or after the JSON array. Start your response with [ and end with ].`;

      console.log(
        '🧠 [MemoryService] Extraction prompt length:',
        extractionPrompt.length,
      );
      console.log(
        '🧠 [MemoryService] Extraction prompt preview:',
        extractionPrompt.substring(0, 300) + '...',
      );

      // Try the chat endpoint first, fall back to stream endpoint if 404
      let content = '';

      const requestBody = {
        message: extractionPrompt,
        messages: [], // No conversation history for extraction
      };

      const apiUrl = `${this.baseUrl}/api/chat`;
      console.log('🧠 [MemoryService] Making API call to:', apiUrl);
      console.log('🧠 [MemoryService] Request body structure:', {
        hasMessage: !!requestBody.message,
        messageLength: requestBody.message.length,
        messagesCount: requestBody.messages.length,
        // Don't log the full message as it's very long
        messagePreview: requestBody.message.substring(0, 100) + '...',
      });
      console.log('🧠 [MemoryService] Actual request body:', requestBody);

      try {
        // First try the /api/chat endpoint with timeout
        // The backend will automatically detect memory extraction requests
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          MEMORY_EXTRACTION_TIMEOUT,
        );

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        console.log('🧠 [MemoryService] API response status:', response.status);
        console.log(
          '🧠 [MemoryService] API response headers:',
          Object.fromEntries(response.headers.entries()),
        );

        if (response.status === 404) {
          // Fallback to stream endpoint if chat endpoint doesn't exist
          console.log(
            '🧠 [MemoryService] ❌ Chat endpoint not found (404), falling back to stream endpoint',
          );
          throw new Error('Chat endpoint not available, trying stream');
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.log('🧠 [MemoryService] ❌ API error response:', errorText);
          throw new Error(
            `Memory extraction failed: ${response.status} - ${errorText}`,
          );
        }

        const result = await response.json();
        console.log('🧠 [MemoryService] ✅ API response received:', {
          hasResponse: !!result.response,
          responseLength: result.response?.length || 0,
          responseType: typeof result.response,
          status: result.status,
          meta: result.meta,
        });

        content = result.response || '';
        console.log(
          '🧠 [MemoryService] Extracted content length:',
          content.length,
        );
        console.log(
          '🧠 [MemoryService] Content preview:',
          content.substring(0, 500) + (content.length > 500 ? '...' : ''),
        );

        // Check if content is empty
        if (!content || content.trim().length === 0) {
          console.log('🧠 [MemoryService] ❌ Empty response content');
          return {
            memories: [],
            success: false,
            error: 'Empty response from backend',
          };
        }
      } catch (error) {
        console.log('🧠 [MemoryService] ❌ API call error:', error);

        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            console.log(
              '🧠 [MemoryService] ❌ Request was aborted (timeout or manual abort)',
            );
            throw new Error(
              `Memory extraction timed out after ${MEMORY_EXTRACTION_TIMEOUT / 1000} seconds`,
            );
          }

          if (error.message.includes('Chat endpoint not available')) {
            // Try the dedicated memory extraction endpoint as fallback
            console.log(
              '🧠 [MemoryService] Attempting to use dedicated memory extraction endpoint',
            );

            try {
              const memoryApiUrl = `${this.baseUrl}/api/memory/extract`;
              const memoryRequestBody = {
                ...requestBody,
                extract_memories: true,
              };

              const memoryResponse = await fetch(memoryApiUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(memoryRequestBody),
              });

              if (memoryResponse.ok) {
                const memoryResult = await memoryResponse.json();
                content = memoryResult.response || '';
                console.log(
                  '🧠 [MemoryService] ✅ Memory extraction endpoint successful',
                );
              } else {
                throw new Error('Memory extraction endpoint also failed');
              }
            } catch (memoryError) {
              console.log(
                '🧠 [MemoryService] ❌ Memory extraction endpoint failed:',
                memoryError,
              );
              throw new Error(
                'Memory extraction requires updated backend. Please use local development setup or update the deployed router.',
              );
            }
          }
        }

        if (!content) {
          throw error;
        }
      }

      // Parse extracted memories
      console.log('🧠 [MemoryService] Starting JSON parsing...');
      try {
        // Extract JSON array from the response - look for the first [ and last ]
        const jsonContent = content.trim();
        console.log(
          '🧠 [MemoryService] Trimmed content length:',
          jsonContent.length,
        );

        // Find the first occurrence of '[' and last occurrence of ']'
        const startIndex = jsonContent.indexOf('[');
        const endIndex = jsonContent.lastIndexOf(']');

        console.log('🧠 [MemoryService] JSON extraction indices:', {
          startIndex,
          endIndex,
        });

        if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
          console.log(
            '🧠 [MemoryService] ❌ No valid JSON array found in response',
          );
          console.log(
            '🧠 [MemoryService] Full content for debugging:',
            content,
          );
          return {
            memories: [],
            success: false,
            error: 'No valid JSON array found in LLM response',
          };
        }

        // Extract just the JSON array part
        const jsonArrayString = jsonContent.substring(startIndex, endIndex + 1);
        console.log(
          '🧠 [MemoryService] Extracted JSON string length:',
          jsonArrayString.length,
        );
        console.log(
          '🧠 [MemoryService] Extracted JSON string:',
          jsonArrayString,
        );

        const memories = JSON.parse(jsonArrayString);
        console.log('🧠 [MemoryService] ✅ JSON parsed successfully');
        console.log(
          '🧠 [MemoryService] Parsed memories count:',
          memories.length,
        );
        console.log('🧠 [MemoryService] Parsed memories:', memories);

        if (!Array.isArray(memories)) {
          console.log(
            '🧠 [MemoryService] ❌ Parsed result is not an array:',
            typeof memories,
          );
          return {
            memories: [],
            success: false,
            error: 'Invalid response format from LLM',
          };
        }

        // Add metadata
        const processedMemories = memories.map((memory, index) => {
          const processed = {
            ...memory,
            chatId: request.chatId,
            messageIds: request.messages
              .map(msg => parseInt(msg.id || '0'))
              .filter(id => id > 0),
          };
          console.log(
            `🧠 [MemoryService] Processed memory ${index + 1}:`,
            processed,
          );
          return processed;
        });

        console.log(
          '🧠 [MemoryService] ✅ Memory extraction completed successfully',
        );
        console.log(
          '🧠 [MemoryService] Final processed memories count:',
          processedMemories.length,
        );

        return {
          memories: processedMemories,
          success: true,
        };
      } catch (parseError) {
        console.log('🧠 [MemoryService] ❌ JSON parsing failed:', parseError);
        console.log(
          '🧠 [MemoryService] Content that failed to parse:',
          content,
        );
        console.log('🧠 [MemoryService] Parse error details:', {
          name: parseError instanceof Error ? parseError.name : 'Unknown',
          message:
            parseError instanceof Error
              ? parseError.message
              : String(parseError),
          stack: parseError instanceof Error ? parseError.stack : undefined,
        });

        return {
          memories: [],
          success: false,
          error: 'Failed to parse LLM response',
        };
      }
    } catch (error) {
      console.log(
        '🧠 [MemoryService] ❌ Memory extraction failed with error:',
        error,
      );
      console.log('🧠 [MemoryService] Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

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
   * Debug method to test memory extraction with a simple conversation
   */
  async debugMemoryExtraction(): Promise<void> {
    console.log('🧠 [MemoryService] 🔧 Starting debug memory extraction...');
    console.log('🧠 [MemoryService] 🔧 Current API URL:', this.baseUrl);

    const testMessages: ChatMessage[] = [
      {
        id: '1',
        role: 'user',
        content:
          'I am running Ubuntu on System 76. How should I install ffmpeg?',
        timestamp: Date.now(),
      },
      {
        id: '2',
        role: 'assistant',
        content:
          'You can install ffmpeg on Ubuntu using apt: sudo apt update && sudo apt install ffmpeg',
        timestamp: Date.now(),
      },
      {
        id: '3',
        role: 'user',
        content:
          'I prefer using the latest version and I work with video editing.',
        timestamp: Date.now(),
      },
    ];

    try {
      const result = await this.extractMemories({
        chatId: 999,
        messages: testMessages,
        maxMemories: 5,
      });

      console.log('🧠 [MemoryService] 🔧 Debug extraction result:', result);

      if (result.success && result.memories.length > 0) {
        console.log('🧠 [MemoryService] ✅ Debug extraction successful!');
        console.log(
          '🧠 [MemoryService] 🔧 Extracted memories:',
          result.memories,
        );
      } else {
        console.log(
          '🧠 [MemoryService] ❌ Debug extraction failed:',
          result.error,
        );
      }
    } catch (error) {
      console.log('🧠 [MemoryService] ❌ Debug extraction error:', error);
    }
  }

  /**
   * Extract memories from a single user question using the dedicated memory extraction endpoint
   */
  async extractMemoriesFromQuestion(
    question: string,
    systemPrompt?: string,
  ): Promise<any[]> {
    console.log('🧠 [MemoryService] Extracting memories from user question...');
    console.log('🧠 [MemoryService] Question:', question.substring(0, 100) + '...');

    const defaultSystemPrompt = `You are a memory extraction assistant. Your job is to extract key facts from user questions and return ONLY a valid JSON array. 

Extract key facts, preferences, and contextual information from the following user input that would be useful to remember for future conversations. Focus on:

1. Personal information (name, location, job, interests, etc.)
2. Technical preferences (tools, languages, frameworks, etc.)
3. User preferences (communication style, specific needs, etc.)
4. Important context (current projects, goals, constraints, etc.)

For each fact, provide:
- A concise summary (1-2 sentences max)
- A category (personal, technical, preference, context, other)
- A relevance score (0.0-1.0)
- Original context from the user input

Return ONLY a JSON array with this exact format:
[{"content": "fact summary", "category": "category", "relevanceScore": 0.8, "originalContext": "relevant snippet from user input"}]

CRITICAL: Return ONLY the JSON array. Do not include any explanations, reasoning, or other text before or after the JSON array. Start your response with [ and end with ].`;

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

      console.log('🧠 [MemoryService] Memory response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('🧠 [MemoryService] ❌ Memory extraction error:', errorText);
        throw new Error(`Memory extraction failed: ${response.status} - ${errorText}`);
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
        console.log('🧠 [MemoryService] ❌ Unexpected response format:', result);
        return [];
      }

      console.log('🧠 [MemoryService] Extracted content:', content);

      // Parse the JSON array from the response
      try {
        const jsonContent = content.trim();
        const startIndex = jsonContent.indexOf('[');
        const endIndex = jsonContent.lastIndexOf(']');

        if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
          console.log('🧠 [MemoryService] ❌ No valid JSON array found in response');
          return [];
        }

        const jsonArrayString = jsonContent.substring(startIndex, endIndex + 1);
        const memories = JSON.parse(jsonArrayString);

        if (!Array.isArray(memories)) {
          console.log('🧠 [MemoryService] ❌ Parsed result is not an array');
          return [];
        }

        console.log('🧠 [MemoryService] ✅ Successfully extracted memories:', memories);
        return memories;
      } catch (parseError) {
        console.log('🧠 [MemoryService] ❌ JSON parsing failed:', parseError);
        console.log('🧠 [MemoryService] Content that failed to parse:', content);
        return [];
      }
    } catch (error) {
      console.log('🧠 [MemoryService] ❌ Memory extraction from question failed:', error);
      return [];
    }
  }

  /**
   * Test memory extraction from a question
   */
  async testMemoryExtractionFromQuestion(): Promise<void> {
    console.log('🧠 [MemoryService] 🔧 Testing memory extraction from question...');
    
    const testQuestion = "I'm a software engineer working with React Native and I prefer TypeScript. I'm currently building a mobile app for iOS.";
    
    try {
      const memories = await this.extractMemoriesFromQuestion(testQuestion);
      
      if (memories.length > 0) {
        console.log('🧠 [MemoryService] ✅ Memory extraction test successful!');
        console.log('🧠 [MemoryService] 🔧 Extracted memories:', memories);
      } else {
        console.log('🧠 [MemoryService] ⚠️ No memories extracted from test question');
      }
    } catch (error) {
      console.log('🧠 [MemoryService] ❌ Memory extraction test failed:', error);
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
