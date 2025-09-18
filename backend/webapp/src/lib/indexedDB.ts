// IndexedDB utilities for storing embeddings

export interface StoredEmbedding {
  id: string;
  text: string;
  embedding: number[];
  model: string;
  createdAt: Date;
  chatId?: string; // ID of the chat conversation this embedding belongs to
  messageId?: string; // ID of the specific message this embedding represents
  metadata?: Record<string, any>;
}

const DB_NAME = 'GeistAIEmbeddings';
const DB_VERSION = 2; // Increment version to add new indexes
const STORE_NAME = 'embeddings';

class EmbeddingDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('text', 'text', { unique: false });
          store.createIndex('model', 'model', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('chatId', 'chatId', { unique: false });
          store.createIndex('messageId', 'messageId', { unique: false });
        } else {
          // Handle version upgrade - add new indexes if they don't exist
          const transaction = (event.target as IDBOpenDBRequest).transaction!;
          const store = transaction.objectStore(STORE_NAME);
          
          if (!store.indexNames.contains('chatId')) {
            store.createIndex('chatId', 'chatId', { unique: false });
          }
          if (!store.indexNames.contains('messageId')) {
            store.createIndex('messageId', 'messageId', { unique: false });
          }
        }
      };
    });
  }

  async saveEmbedding(embedding: Omit<StoredEmbedding, 'id' | 'createdAt'>): Promise<string> {
    if (!this.db) {
      await this.init();
    }

    const id = crypto.randomUUID();
    const storedEmbedding: StoredEmbedding = {
      ...embedding,
      id,
      createdAt: new Date()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(storedEmbedding);

      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(new Error('Failed to save embedding'));
    });
  }

  async getAllEmbeddings(): Promise<StoredEmbedding[]> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to get embeddings'));
    });
  }

  async getEmbedding(id: string): Promise<StoredEmbedding | null> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Failed to get embedding'));
    });
  }

  async deleteEmbedding(id: string): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete embedding'));
    });
  }

  async searchEmbeddings(query: string): Promise<StoredEmbedding[]> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const embeddings = request.result;
        const filtered = embeddings.filter(embedding => 
          embedding.text.toLowerCase().includes(query.toLowerCase())
        );
        resolve(filtered);
      };
      request.onerror = () => reject(new Error('Failed to search embeddings'));
    });
  }

  async getEmbeddingsByChatId(chatId: string): Promise<StoredEmbedding[]> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('chatId');
      const request = index.getAll(chatId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to get embeddings by chat ID'));
    });
  }

  async getEmbeddingByMessageId(messageId: string): Promise<StoredEmbedding | null> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('messageId');
      const request = index.get(messageId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Failed to get embedding by message ID'));
    });
  }

  async deleteEmbeddingsByChatId(chatId: string): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('chatId');
      const request = index.getAll(chatId);

      request.onsuccess = () => {
        const embeddings = request.result;
        const deletePromises = embeddings.map(embedding => {
          return new Promise<void>((deleteResolve, deleteReject) => {
            const deleteRequest = store.delete(embedding.id);
            deleteRequest.onsuccess = () => deleteResolve();
            deleteRequest.onerror = () => deleteReject(new Error('Failed to delete embedding'));
          });
        });

        Promise.all(deletePromises)
          .then(() => resolve())
          .catch(reject);
      };
      request.onerror = () => reject(new Error('Failed to get embeddings for deletion'));
    });
  }
}

export const embeddingDB = new EmbeddingDB();
