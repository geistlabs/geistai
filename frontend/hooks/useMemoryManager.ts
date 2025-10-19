import { useState, useEffect, useCallback } from 'react';

import { ChatMessage } from '../lib/api/chat';
import {
  memoryService,
  Memory,
  MemorySearchResult,
} from '../lib/memoryService';
import { memoryStorage, MemoryStats } from '../lib/memoryStorage';

export interface UseMemoryManagerOptions {
  contextThreshold?: number; // Similarity threshold for context inclusion
  searchThreshold?: number; // Similarity threshold for search results
  maxContextMemories?: number; // Max memories to include in context
}

export interface UseMemoryManagerReturn {
  // Memory operations
  searchMemories: (
    query: string,
    excludeChatId?: number,
  ) => Promise<MemorySearchResult[]>;
  getRelevantContext: (
    query: string,
    excludeChatId?: number,
  ) => Promise<string>;

  // Storage operations
  storeMemories: (memories: Memory[]) => Promise<void>;
  getMemoriesByChat: (chatId: number) => Promise<Memory[]>;
  deleteMemory: (memoryId: string) => Promise<void>;
  deleteMemoriesByChat: (chatId: number) => Promise<void>;
  clearAllMemories: () => Promise<void>;

  // Stats and management
  getMemoryStats: () => Promise<MemoryStats>;
  isInitialized: boolean;

  // State
  isExtracting: boolean;
  isSearching: boolean;
  error: string | null;
}

export function useMemoryManager(
  options: UseMemoryManagerOptions = {},
): UseMemoryManagerReturn {
  const { 
    contextThreshold = 0.7, 
    searchThreshold = 0.3, 
    maxContextMemories = 5 
  } = options;

  const [isInitialized, setIsInitialized] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize memory storage
  useEffect(() => {
    const initializeStorage = async () => {
      try {
        await memoryStorage.initDatabase();
        setIsInitialized(true);
      } catch (err) {
        console.error('Failed to initialize memory storage:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to initialize memory storage',
        );
      }
    };

    initializeStorage();
  }, []);


  /**
   * Search for relevant memories
   */
  const searchMemories = useCallback(
    async (
      query: string,
      excludeChatId?: number,
    ): Promise<MemorySearchResult[]> => {
      if (!isInitialized) {
        throw new Error('Memory storage not initialized');
      }

      setIsSearching(true);
      setError(null);

      try {
        console.log(`🔍 [MemoryManager] Searching for: "${query}"`);
        console.log(`🔍 [MemoryManager] Using threshold: ${searchThreshold}`);
        
        // Generate embedding for query
        const queryEmbedding = await memoryService.getEmbedding(query);
        console.log(`🔍 [MemoryManager] Query embedding length: ${queryEmbedding.length}`);

        if (queryEmbedding.length === 0) {
          console.log('🔍 [MemoryManager] ❌ Failed to generate query embedding');
          return [];
        }

        // Search in local storage with low threshold for better recall
        const results = await memoryStorage.searchMemoriesBySimilarity(
          queryEmbedding,
          excludeChatId,
          5, // Return top 5 results
          searchThreshold, // Use lower threshold (0.3) for search
        );

        console.log(`🔍 [MemoryManager] ✅ Search completed, found ${results.length} results`);
        return results;
      } catch (err) {
        console.error('Failed to search memories:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to search memories',
        );
        return [];
      } finally {
        setIsSearching(false);
      }
    },
    [isInitialized, searchThreshold],
  );

  /**
   * Get relevant context for a query (formatted for LLM)
   */
  const getRelevantContext = useCallback(
    async (query: string, excludeChatId?: number): Promise<string> => {
      try {
        const results = await searchMemories(query, excludeChatId);

        if (results.length === 0) {
          return '';
        }

        // Take top results up to maxContextMemories
        const topResults = results.slice(0, maxContextMemories);

        return memoryService.formatMemoriesForContext(topResults);
      } catch (err) {
        console.error('Failed to get relevant context:', err);
        return '';
      }
    },
    [searchMemories, maxContextMemories],
  );

  /**
   * Store memories in local database
   */
  const storeMemories = useCallback(
    async (memories: Memory[]): Promise<void> => {
      if (!isInitialized) {
        throw new Error('Memory storage not initialized');
      }

      try {
        await memoryStorage.storeMemories(memories);
      } catch (err) {
        console.error('Failed to store memories:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to store memories',
        );
        throw err;
      }
    },
    [isInitialized],
  );

  /**
   * Get memories for a specific chat
   */
  const getMemoriesByChat = useCallback(
    async (chatId: number): Promise<Memory[]> => {
      if (!isInitialized) {
        throw new Error('Memory storage not initialized');
      }

      try {
        return await memoryStorage.getMemoriesByChat(chatId);
      } catch (err) {
        console.error('Failed to get memories by chat:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to get memories by chat',
        );
        return [];
      }
    },
    [isInitialized],
  );

  /**
   * Delete a specific memory
   */
  const deleteMemory = useCallback(
    async (memoryId: string): Promise<void> => {
      if (!isInitialized) {
        throw new Error('Memory storage not initialized');
      }

      try {
        await memoryStorage.deleteMemory(memoryId);
      } catch (err) {
        console.error('Failed to delete memory:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to delete memory',
        );
        throw err;
      }
    },
    [isInitialized],
  );

  /**
   * Delete memories for a specific chat
   */
  const deleteMemoriesByChat = useCallback(
    async (chatId: number): Promise<void> => {
      if (!isInitialized) {
        throw new Error('Memory storage not initialized');
      }

      try {
        await memoryStorage.deleteMemoriesByChat(chatId);
      } catch (err) {
        console.error('Failed to delete memories by chat:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to delete memories by chat',
        );
        throw err;
      }
    },
    [isInitialized],
  );

  /**
   * Clear all memories
   */
  const clearAllMemories = useCallback(async (): Promise<void> => {
    if (!isInitialized) {
      throw new Error('Memory storage not initialized');
    }

    try {
      await memoryStorage.clearAllMemories();
    } catch (err) {
      console.error('Failed to clear all memories:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to clear all memories',
      );
      throw err;
    }
  }, [isInitialized]);

  /**
   * Get memory statistics
   */
  const getMemoryStats = useCallback(async (): Promise<MemoryStats> => {
    if (!isInitialized) {
      throw new Error('Memory storage not initialized');
    }

    try {
      return await memoryStorage.getMemoryStats();
    } catch (err) {
      console.error('Failed to get memory stats:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to get memory stats',
      );
      return {
        totalMemories: 0,
        memoriesByCategory: {},
        memoriesByChat: {},
        oldestMemory: 0,
        newestMemory: 0,
      };
    }
  }, [isInitialized]);

  return {
    // Memory operations
    searchMemories,
    getRelevantContext,

    // Storage operations
    storeMemories,
    getMemoriesByChat,
    deleteMemory,
    deleteMemoriesByChat,
    clearAllMemories,

    // Stats and management
    getMemoryStats,
    isInitialized,

    // State
    isExtracting,
    isSearching,
    error,
  };
}
