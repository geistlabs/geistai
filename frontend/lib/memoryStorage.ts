import * as SQLite from 'expo-sqlite';

import { Memory, MemorySearchResult } from './memoryService';

// Database configuration
const MEMORY_DATABASE_NAME = 'geist_memories.db';

export interface StoredMemory extends Memory {
  // All fields from Memory interface
}

export interface MemoryStats {
  totalMemories: number;
  memoriesByCategory: Record<string, number>;
  memoriesByChat: Record<number, number>;
  oldestMemory: number;
  newestMemory: number;
}

/**
 * Memory Storage Service using SQLite
 */
class MemoryStorageService {
  private db: SQLite.SQLiteDatabase | null = null;

  /**
   * Initialize the memory database
   */
  async initDatabase(): Promise<void> {
    if (this.db) return;

    try {
      // Open database
      this.db = await SQLite.openDatabaseAsync(MEMORY_DATABASE_NAME);

      // Enable WAL mode for better concurrent access
      await this.db.execAsync('PRAGMA journal_mode = WAL;');
      await this.db.execAsync('PRAGMA synchronous = NORMAL;');

      // Run migrations
      await this.runMigrations();
    } catch (error) {
      console.error('Memory database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Run database migrations
   */
  private async runMigrations(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Create memories table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS memories (
          id TEXT PRIMARY KEY,
          chat_id INTEGER NOT NULL,
          content TEXT NOT NULL,
          original_context TEXT NOT NULL,
          embedding BLOB NOT NULL,
          relevance_score REAL NOT NULL DEFAULT 0.0,
          extracted_at INTEGER NOT NULL,
          message_ids TEXT NOT NULL, -- JSON array of message IDs
          category TEXT NOT NULL CHECK (category IN ('personal', 'technical', 'preference', 'context', 'other'))
        );
      `);

      // Create indexes for performance
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_memories_chat_id 
        ON memories(chat_id);
      `);

      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_memories_category 
        ON memories(category);
      `);

      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_memories_extracted_at 
        ON memories(extracted_at DESC);
      `);

      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_memories_relevance_score 
        ON memories(relevance_score DESC);
      `);
    } catch (error) {
      console.error('Memory database migration failed:', error);
      throw error;
    }
  }

  /**
   * Get database instance (ensure it's initialized)
   */
  private getDatabase(): SQLite.SQLiteDatabase {
    if (!this.db) {
      throw new Error(
        'Memory database not initialized. Call initDatabase() first.',
      );
    }
    return this.db;
  }

  /**
   * Store a memory in the database
   */
  async storeMemory(memory: Memory): Promise<void> {
    const database = this.getDatabase();

    try {
      // Convert embedding to blob
      const embeddingBuffer = new Float32Array(memory.embedding).buffer;
      const embeddingBlob = new Uint8Array(embeddingBuffer);

      await database.runAsync(
        `INSERT OR REPLACE INTO memories 
         (id, chat_id, content, original_context, embedding, relevance_score, extracted_at, message_ids, category) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          memory.id,
          memory.chatId,
          memory.content,
          memory.originalContext,
          embeddingBlob,
          memory.relevanceScore,
          memory.extractedAt,
          JSON.stringify(memory.messageIds),
          memory.category,
        ],
      );
    } catch (error) {
      console.error('Failed to store memory:', error);
      throw error;
    }
  }

  /**
   * Store multiple memories in a transaction
   */
  async storeMemories(memories: Memory[]): Promise<void> {
    const database = this.getDatabase();

    try {
      await database.withTransactionAsync(async () => {
        for (const memory of memories) {
          const embeddingBuffer = new Float32Array(memory.embedding).buffer;
          const embeddingBlob = new Uint8Array(embeddingBuffer);

          await database.runAsync(
            `INSERT OR REPLACE INTO memories 
             (id, chat_id, content, original_context, embedding, relevance_score, extracted_at, message_ids, category) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              memory.id,
              memory.chatId,
              memory.content,
              memory.originalContext,
              embeddingBlob,
              memory.relevanceScore,
              memory.extractedAt,
              JSON.stringify(memory.messageIds),
              memory.category,
            ],
          );
        }
      });
    } catch (error) {
      console.error('Failed to store memories:', error);
      throw error;
    }
  }

  /**
   * Get all memories for a specific chat
   */
  async getMemoriesByChat(chatId: number): Promise<StoredMemory[]> {
    const database = this.getDatabase();

    try {
      const rows = await database.getAllAsync(
        'SELECT * FROM memories WHERE chat_id = ? ORDER BY extracted_at DESC',
        [chatId],
      );

      return rows.map((row: any) => this.rowToMemory(row));
    } catch (error) {
      console.error('Failed to get memories by chat:', error);
      throw error;
    }
  }

  /**
   * Get all memories excluding a specific chat
   */
  async getAllMemoriesExcludingChat(
    excludeChatId: number,
  ): Promise<StoredMemory[]> {
    const database = this.getDatabase();

    try {
      const rows = await database.getAllAsync(
        'SELECT * FROM memories WHERE chat_id != ? ORDER BY relevance_score DESC, extracted_at DESC',
        [excludeChatId],
      );

      return rows.map((row: any) => this.rowToMemory(row));
    } catch (error) {
      console.error('Failed to get memories excluding chat:', error);
      throw error;
    }
  }

  /**
   * Get all memories
   */
  async getAllMemories(): Promise<StoredMemory[]> {
    const database = this.getDatabase();

    try {
      const rows = await database.getAllAsync(
        'SELECT * FROM memories ORDER BY extracted_at DESC',
      );

      return rows.map((row: any) => this.rowToMemory(row));
    } catch (error) {
      console.error('Failed to get all memories:', error);
      throw error;
    }
  }

  /**
   * Search memories by similarity to a query embedding
   */
  async searchMemoriesBySimilarity(
    queryEmbedding: number[],
    excludeChatId?: number,
    limit: number = 10,
    threshold: number = 0.7,
  ): Promise<MemorySearchResult[]> {
    const memories = excludeChatId
      ? await this.getAllMemoriesExcludingChat(excludeChatId)
      : await this.getAllMemories();

    const results: MemorySearchResult[] = [];

    for (const memory of memories) {
      const similarity = this.cosineSimilarity(
        queryEmbedding,
        memory.embedding,
      );

      if (similarity >= threshold) {
        results.push({
          memory,
          similarity,
        });
      }
    }

    // Sort by similarity (descending) and limit results
    return results.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
  }

  /**
   * Delete memories for a specific chat
   */
  async deleteMemoriesByChat(chatId: number): Promise<void> {
    const database = this.getDatabase();

    try {
      await database.runAsync('DELETE FROM memories WHERE chat_id = ?', [
        chatId,
      ]);
    } catch (error) {
      console.error('Failed to delete memories by chat:', error);
      throw error;
    }
  }

  /**
   * Delete a specific memory
   */
  async deleteMemory(memoryId: string): Promise<void> {
    const database = this.getDatabase();

    try {
      await database.runAsync('DELETE FROM memories WHERE id = ?', [memoryId]);
    } catch (error) {
      console.error('Failed to delete memory:', error);
      throw error;
    }
  }

  /**
   * Get memory statistics
   */
  async getMemoryStats(): Promise<MemoryStats> {
    const database = this.getDatabase();

    try {
      // Total memories
      const totalResult = await database.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM memories',
      );
      const totalMemories = totalResult?.count || 0;

      // Memories by category
      const categoryRows = await database.getAllAsync<{
        category: string;
        count: number;
      }>('SELECT category, COUNT(*) as count FROM memories GROUP BY category');
      const memoriesByCategory: Record<string, number> = {};
      categoryRows.forEach(row => {
        memoriesByCategory[row.category] = row.count;
      });

      // Memories by chat
      const chatRows = await database.getAllAsync<{
        chat_id: number;
        count: number;
      }>('SELECT chat_id, COUNT(*) as count FROM memories GROUP BY chat_id');
      const memoriesByChat: Record<number, number> = {};
      chatRows.forEach(row => {
        memoriesByChat[row.chat_id] = row.count;
      });

      // Oldest and newest memories
      const oldestResult = await database.getFirstAsync<{
        extracted_at: number;
      }>('SELECT MIN(extracted_at) as extracted_at FROM memories');
      const newestResult = await database.getFirstAsync<{
        extracted_at: number;
      }>('SELECT MAX(extracted_at) as extracted_at FROM memories');

      return {
        totalMemories,
        memoriesByCategory,
        memoriesByChat,
        oldestMemory: oldestResult?.extracted_at || 0,
        newestMemory: newestResult?.extracted_at || 0,
      };
    } catch (error) {
      console.error('Failed to get memory stats:', error);
      throw error;
    }
  }

  /**
   * Clear all memories
   */
  async clearAllMemories(): Promise<void> {
    const database = this.getDatabase();

    try {
      await database.runAsync('DELETE FROM memories');
    } catch (error) {
      console.error('Failed to clear all memories:', error);
      throw error;
    }
  }

  /**
   * Convert database row to Memory object
   */
  private rowToMemory(row: any): StoredMemory {
    // Convert blob back to float array
    const embeddingBlob = new Uint8Array(row.embedding);
    const embeddingBuffer = embeddingBlob.buffer;
    const embedding = Array.from(new Float32Array(embeddingBuffer));

    return {
      id: row.id,
      chatId: row.chat_id,
      content: row.content,
      originalContext: row.original_context,
      embedding,
      relevanceScore: row.relevance_score,
      extractedAt: row.extracted_at,
      messageIds: JSON.parse(row.message_ids),
      category: row.category,
    };
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
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
   * Check if database is initialized
   */
  isDatabaseInitialized(): boolean {
    return this.db !== null;
  }

  /**
   * Close database connection
   */
  async closeDatabase(): Promise<void> {
    if (this.db) {
      try {
        await this.db.closeAsync();
        this.db = null;
      } catch (error) {
        console.error('Failed to close memory database:', error);
        throw error;
      }
    }
  }
}

export const memoryStorage = new MemoryStorageService();
