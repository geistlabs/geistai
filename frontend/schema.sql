-- GeistAI Frontend SQLite Database Schema
-- Generated from current codebase state
-- Date: 2025-10-19

-- =============================================================================
-- DATABASE CONFIGURATION
-- =============================================================================

-- Main chat database: geist_v2_chats.db
-- Vector storage database: vectors.db  
-- Memory storage database: memories.db

-- Enable WAL mode for better concurrent access
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

-- =============================================================================
-- CHAT STORAGE TABLES (geist_v2_chats.db)
-- =============================================================================

-- Chats table - stores conversation metadata
CREATE TABLE IF NOT EXISTS chats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,           -- Unix timestamp
  updated_at INTEGER NOT NULL,           -- Unix timestamp  
  pinned INTEGER DEFAULT 0,              -- 0 or 1 (SQLite boolean)
  archived INTEGER DEFAULT 0             -- 0 or 1 (SQLite boolean)
);

-- Messages table - stores individual chat messages
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,           -- Unix timestamp
  FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE
);

-- =============================================================================
-- MEMORY STORAGE TABLES (memories.db)
-- =============================================================================

-- Memories table - stores extracted conversational memories with embeddings
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,                   -- UUID-like string
  chat_id INTEGER NOT NULL,              -- Reference to chat
  content TEXT NOT NULL,                 -- Extracted fact/memory content
  original_context TEXT NOT NULL,       -- Original conversation snippet
  embedding BLOB NOT NULL,               -- Float32Array as binary blob
  relevance_score REAL NOT NULL DEFAULT 0.0,  -- 0.0-1.0 relevance score
  extracted_at INTEGER NOT NULL,        -- Unix timestamp
  message_ids TEXT NOT NULL,             -- JSON array of message IDs
  category TEXT NOT NULL CHECK (category IN ('personal', 'technical', 'preference', 'context', 'other'))
);

-- =============================================================================
-- VECTOR STORAGE TABLES (vectors.db)
-- =============================================================================

-- Embeddings table - stores text embeddings for similarity search
CREATE TABLE IF NOT EXISTS embeddings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,                    -- Original text
  embedding BLOB NOT NULL,               -- Float32Array as binary blob
  created_at INTEGER NOT NULL           -- Unix timestamp
);

-- =============================================================================
-- PERFORMANCE INDEXES
-- =============================================================================

-- Chat indexes
CREATE INDEX IF NOT EXISTS idx_chats_updated_at 
ON chats(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_chat_id 
ON messages(chat_id, created_at);

-- Memory indexes  
CREATE INDEX IF NOT EXISTS idx_memories_chat_id 
ON memories(chat_id);

CREATE INDEX IF NOT EXISTS idx_memories_category 
ON memories(category);

CREATE INDEX IF NOT EXISTS idx_memories_extracted_at 
ON memories(extracted_at DESC);

CREATE INDEX IF NOT EXISTS idx_memories_relevance_score 
ON memories(relevance_score DESC);

-- =============================================================================
-- DATA TYPES AND CONSTRAINTS
-- =============================================================================

-- TIMESTAMPS: All timestamps are stored as INTEGER (Unix timestamp in milliseconds)
-- BOOLEANS: Stored as INTEGER (0 = false, 1 = true) since SQLite doesn't have native boolean
-- EMBEDDINGS: Stored as BLOB (Float32Array converted to Uint8Array binary data)
-- JSON ARRAYS: Stored as TEXT (JSON.stringify format)

-- =============================================================================
-- RELATIONSHIPS
-- =============================================================================

-- messages.chat_id -> chats.id (CASCADE DELETE)
-- memories.chat_id -> chats.id (NO FOREIGN KEY - cross-database reference)
-- memories.message_ids -> messages.id[] (JSON array, no formal FK)

-- =============================================================================
-- USAGE PATTERNS
-- =============================================================================

-- Chat Operations:
-- - Load chat: SELECT * FROM chats WHERE id = ? + SELECT * FROM messages WHERE chat_id = ?
-- - Add message: INSERT INTO messages + UPDATE chats SET updated_at = ?
-- - Delete chat: DELETE FROM chats (CASCADE deletes messages)

-- Memory Operations:  
-- - Store memory: INSERT OR REPLACE INTO memories
-- - Search memories: SELECT * FROM memories + cosine similarity calculation on embeddings
-- - Get chat memories: SELECT * FROM memories WHERE chat_id = ?

-- Vector Operations:
-- - Store embedding: INSERT INTO embeddings  
-- - Similarity search: SELECT * FROM embeddings + cosine similarity calculation

-- =============================================================================
-- EMBEDDING FORMAT
-- =============================================================================

-- Embeddings are stored as binary blobs using this conversion:
-- JavaScript: Float32Array -> ArrayBuffer -> Uint8Array -> BLOB
-- Retrieval: BLOB -> Uint8Array -> ArrayBuffer -> Float32Array

-- Example embedding storage:
-- const embeddingBuffer = new Float32Array(embedding).buffer;
-- const embeddingBlob = new Uint8Array(embeddingBuffer);

-- Example embedding retrieval:  
-- const buffer = new Uint8Array(row.embedding).buffer;
-- const embedding = Array.from(new Float32Array(buffer));
