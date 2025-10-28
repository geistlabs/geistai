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
        // Generate embedding for query
        const queryEmbedding = await memoryService.getEmbedding(query);

        if (queryEmbedding.length === 0) {
          return [];
        }

        // Search in local storage with low threshold for better recall
        const results = await memoryStorage.searchMemoriesBySimilarity(
          queryEmbedding,
          excludeChatId,
          5, // Return top 5 results
          searchThreshold, // Use lower threshold (0.3) for search
        );
        
        return results;
      } catch (err) {
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
      console.log(`[MemoryManager] 🎯 Getting relevant context for query: "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}"`);
      console.log(`[MemoryManager] 🚫 Excluding chat ID: ${excludeChatId || 'none'}`);
      
      try {
        const results = await searchMemories(query, excludeChatId);

        console.log(`[MemoryManager] 📋 Search returned ${results.length} results`);

        if (results.length === 0) {
          console.log(`[MemoryManager] ❌ No relevant memories found, returning empty context`);
          return '';
        }

        // Take top results up to maxContextMemories
        const topResults = results.slice(0, maxContextMemories);
        console.log(`[MemoryManager] 🔝 Taking top ${topResults.length} results (max: ${maxContextMemories})`);

        const formattedContext = memoryService.formatMemoriesForContext(topResults);
        console.log(`[MemoryManager] 📝 Formatted context length: ${formattedContext.length} characters`);
        console.log(`[MemoryManager] 📄 Formatted context preview:`, formattedContext.substring(0, 200) + '...');

        return formattedContext;
      } catch (err) {
        console.error(`[MemoryManager] ❌ Error getting relevant context:`, err);
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
