import * as SQLite from 'expo-sqlite';

// Database configuration
const DATABASE_NAME = 'geist_v2_chats.db';

// Types
export interface Chat {
  id: number;
  title: string;
  created_at: number;
  updated_at: number;
  pinned: number; // 0 or 1 (SQLite doesn't have boolean)
  archived: number; // 0 or 1
}

export interface Message {
  id: number;
  chat_id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: number;
}

export interface ChatWithMessages extends Chat {
  messages: Message[];
}

// Database instance
let db: SQLite.SQLiteDatabase | null = null;

/**
 * Initialize the database with proper schema
 */
export const initializeDatabase = async (): Promise<void> => {
  try {
    // Open database
    db = await SQLite.openDatabaseAsync(DATABASE_NAME);

    // Enable WAL mode for better concurrent access
    await db.execAsync('PRAGMA journal_mode = WAL;');
    await db.execAsync('PRAGMA synchronous = NORMAL;');

    // Run migrations
    await runMigrations();
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
};

/**
 * Run database migrations
 */
const runMigrations = async (): Promise<void> => {
  if (!db) throw new Error('Database not initialized');

  try {
    // Create chats table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        pinned INTEGER DEFAULT 0,
        archived INTEGER DEFAULT 0
      );
    `);

    // Create messages table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE
      );
    `);

    // Create performance indexes
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_chats_updated_at 
      ON chats(updated_at DESC);
    `);

    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_messages_chat_id 
      ON messages(chat_id, created_at);
    `);
  } catch (error) {
    console.error('Database migration failed:', error);
    throw error;
  }
};

/**
 * Get database instance (ensure it's initialized)
 */
const getDatabase = (): SQLite.SQLiteDatabase => {
  if (!db) {
    throw new Error(
      'Database not initialized. Call initializeDatabase() first.',
    );
  }
  return db;
};

/**
 * Check if database is initialized
 */
export const isDatabaseInitialized = (): boolean => {
  return db !== null;
};

/**
 * Create a new chat
 */
export const createChat = async (title: string = ''): Promise<number> => {
  const database = getDatabase();
  const now = Date.now();

  try {
    const result = await database.runAsync(
      'INSERT INTO chats (title, created_at, updated_at) VALUES (?, ?, ?)',
      [title, now, now],
    );

    const chatId = result.lastInsertRowId;
    return chatId;
  } catch (error) {
    console.error('[chatStorage] Failed to create chat:', error);
    throw error;
  }
};

/**
 * Generate a title from the first user message in a chat
 */
export const getChatTitle = async (chatId: number): Promise<string> => {
  const database = getDatabase();

  try {
    const result = await database.getFirstAsync<{ content: string }>(
      'SELECT content FROM messages WHERE chat_id = ? AND role = "user" ORDER BY created_at ASC LIMIT 1',
      [chatId],
    );

    if (result) {
      let title = result.content.trim();

      // Truncate if longer than ~35 characters to fit sidebar width nicely
      if (title.length > 35) {
        title = title.substring(0, 32) + '...';
      }

      return title;
    }

    return 'New Chat';
  } catch (error) {
    console.error('Failed to get chat title:', error);
    return 'New Chat';
  }
};

/**
 * Get all chats with computed titles, sorted by updated_at DESC
 */
export const getChats = async (
  options: { includeArchived?: boolean } = {},
): Promise<Chat[]> => {
  const database = getDatabase();
  const { includeArchived = false } = options;

  try {
    let query = 'SELECT * FROM chats';
    const params: any[] = [];

    if (!includeArchived) {
      query += ' WHERE archived = 0';
    }

    query += ' ORDER BY pinned DESC, updated_at DESC';

    const result = await database.getAllAsync<Chat>(query, params);
    const chats: Chat[] = [];

    for (const chat of result) {
      // Get computed title from first user message
      const computedTitle = await getChatTitle(chat.id);

      chats.push({
        ...chat,
        title: computedTitle,
      });
    }

    return chats;
  } catch (error) {
    console.error('[chatStorage] Failed to get chats:', error);
    throw error;
  }
};

/**
 * Get a single chat with its messages
 */
export const getChat = async (
  chatId: number,
  options: { limit?: number; offset?: number } = {},
): Promise<ChatWithMessages | null> => {
  const database = getDatabase();
  const { limit = 100, offset = 0 } = options;

  try {
    // Get chat details
    const chat = await database.getFirstAsync<Chat>(
      'SELECT * FROM chats WHERE id = ?',
      [chatId],
    );

    if (!chat) {
      return null;
    }

    // Get messages for this chat
    const messages = await database.getAllAsync<Message>(
      'SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?',
      [chatId, limit, offset],
    );

    return { ...chat, messages };
  } catch (error) {
    console.error('Failed to get chat:', error);
    throw error;
  }
};

/**
 * Add a message to a chat and update chat's updated_at
 */
export const addMessage = async (
  chatId: number,
  role: 'user' | 'assistant',
  content: string,
): Promise<number> => {
  const database = getDatabase();
  const now = Date.now();

  try {
    let messageId = 0;

    await database.withTransactionAsync(async () => {
      // Insert message
      const messageResult = await database.runAsync(
        'INSERT INTO messages (chat_id, role, content, created_at) VALUES (?, ?, ?, ?)',
        [chatId, role, content.trim(), now],
      );

      // Update chat's updated_at timestamp
      await database.runAsync('UPDATE chats SET updated_at = ? WHERE id = ?', [
        now,
        chatId,
      ]);

      messageId = messageResult.lastInsertRowId;
    });

    return messageId;
  } catch (error) {
    console.error('[chatStorage] Failed to add message:', error);
    throw error;
  }
};

/**
 * Delete a chat and all its messages
 */
export const deleteChat = async (chatId: number): Promise<void> => {
  const database = getDatabase();

  try {
    await database.withTransactionAsync(async () => {
      // Delete messages first (though CASCADE should handle this)
      await database.runAsync('DELETE FROM messages WHERE chat_id = ?', [
        chatId,
      ]);

      // Delete chat
      await database.runAsync('DELETE FROM chats WHERE id = ?', [chatId]);
    });

    // Chat deleted
  } catch (error) {
    console.error('Failed to delete chat:', error);
    throw error;
  }
};

/**
 * Get message count for a chat
 */
export const getMessageCount = async (chatId: number): Promise<number> => {
  const database = getDatabase();

  try {
    const result = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM messages WHERE chat_id = ?',
      [chatId],
    );

    return result?.count || 0;
  } catch (error) {
    console.error('Failed to get message count:', error);
    throw error;
  }
};

/**
 * Close database connection
 */
export const closeDatabase = async (): Promise<void> => {
  if (db) {
    try {
      await db.closeAsync();
      db = null;
      // Database connection closed
    } catch (error) {
      console.error('Failed to close database:', error);
      throw error;
    }
  }
};
