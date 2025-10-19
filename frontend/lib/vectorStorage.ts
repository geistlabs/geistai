import * as SQLite from 'expo-sqlite';

export interface VectorEmbedding {
  id: number;
  text: string;
  embedding: number[];
  created_at: number;
}

export interface SimilarityResult {
  id: number;
  text: string;
  similarity: number;
  created_at: number;
}

class VectorStorageService {
  private db: SQLite.SQLiteDatabase | null = null;

  async initDatabase(): Promise<void> {
    if (this.db) return;

    this.db = await SQLite.openDatabaseAsync('vectors.db');

    // Create the embeddings table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS embeddings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        embedding BLOB NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
  }

  async storeEmbedding(text: string, embedding: number[]): Promise<number> {
    if (!this.db) await this.initDatabase();

    // Normalize the embedding vector (unit length for cosine similarity)
    const normalizedEmbedding = this.normalizeVector(embedding);

    // Convert to Float32Array and then to Buffer for storage
    const embeddingBuffer = new Float32Array(normalizedEmbedding).buffer;
    const embeddingBlob = new Uint8Array(embeddingBuffer);

    const result = await this.db!.runAsync(
      'INSERT INTO embeddings (text, embedding, created_at) VALUES (?, ?, ?)',
      [text, embeddingBlob, Date.now()],
    );

    return result.lastInsertRowId;
  }

  async getAllEmbeddings(): Promise<VectorEmbedding[]> {
    if (!this.db) await this.initDatabase();

    const rows = await this.db!.getAllAsync(
      'SELECT * FROM embeddings ORDER BY created_at DESC',
    );

    return rows.map((row: any) => ({
      id: row.id,
      text: row.text,
      embedding: this.blobToFloatArray(row.embedding),
      created_at: row.created_at,
    }));
  }

  async searchSimilar(
    queryEmbedding: number[],
    limit: number = 10,
  ): Promise<SimilarityResult[]> {
    if (!this.db) await this.initDatabase();

    const normalizedQuery = this.normalizeVector(queryEmbedding);
    const allEmbeddings = await this.getAllEmbeddings();

    // Calculate cosine similarity for each embedding
    const similarities = allEmbeddings.map(item => ({
      id: item.id,
      text: item.text,
      similarity: this.cosineSimilarity(normalizedQuery, item.embedding),
      created_at: item.created_at,
    }));

    // Sort by similarity (descending) and return top results
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  async deleteEmbedding(id: number): Promise<void> {
    if (!this.db) await this.initDatabase();

    await this.db!.runAsync('DELETE FROM embeddings WHERE id = ?', [id]);
  }

  async clearAllEmbeddings(): Promise<void> {
    if (!this.db) await this.initDatabase();

    await this.db!.runAsync('DELETE FROM embeddings');
  }

  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(
      vector.reduce((sum, val) => sum + val * val, 0),
    );
    if (magnitude === 0) return vector;
    return vector.map(val => val / magnitude);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
    }

    // Since vectors are normalized, cosine similarity = dot product
    return dotProduct;
  }

  private blobToFloatArray(blob: Uint8Array): number[] {
    const float32Array = new Float32Array(blob.buffer);
    return Array.from(float32Array);
  }
}

// Simple embedding service using a basic hash-based approach
// In a real app, you'd use a proper embedding model
export class SimpleEmbeddingService {
  private readonly EMBEDDING_DIM = 128;

  async generateEmbedding(text: string): Promise<number[]> {
    // Simple hash-based embedding for demo purposes
    // In production, you'd use a real embedding model like sentence-transformers
    const embedding = new Array(this.EMBEDDING_DIM).fill(0);

    // Create a simple hash-based embedding
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const index = charCode % this.EMBEDDING_DIM;
      embedding[index] += Math.sin(charCode * 0.1) * Math.cos(i * 0.1);
    }

    // Add some word-level features
    const words = text.toLowerCase().split(/\s+/);
    words.forEach((word, wordIndex) => {
      for (let i = 0; i < word.length; i++) {
        const charCode = word.charCodeAt(i);
        const index = (charCode + wordIndex) % this.EMBEDDING_DIM;
        embedding[index] += Math.sin(charCode * wordIndex * 0.01);
      }
    });

    // Add text length feature
    const lengthFeature = Math.log(text.length + 1) / 10;
    for (let i = 0; i < this.EMBEDDING_DIM; i += 10) {
      embedding[i] += lengthFeature;
    }

    return embedding;
  }
}

export const vectorStorage = new VectorStorageService();
export const embeddingService = new SimpleEmbeddingService();
