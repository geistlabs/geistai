import { Memory, memoryService } from '../../../lib/memoryService';
import { useMemoryManager } from '../../useMemoryManager';

export interface MemoryServiceConfig {
  currentChatId?: number;
  memoryManager: ReturnType<typeof useMemoryManager>;
}

export class MemoryService {
  private config: MemoryServiceConfig;

  constructor(config: MemoryServiceConfig) {
    this.config = config;
  }

  public async extractMemories(content: string, userMessageId: string) {
    try {
      const extractedMemories =
        await memoryService.extractMemoriesFromQuestion(content);

      if (
        extractedMemories.length > 0 &&
        this.config.memoryManager.isInitialized &&
        this.config.currentChatId
      ) {
        const memories: Memory[] = [];

        for (const memoryData of extractedMemories) {
          const embedding = await memoryService.getEmbedding(
            memoryData.content,
          );

          if (embedding.length > 0) {
            const memory: Memory = {
              id: `${this.config.currentChatId}-${Date.now()}-${Math.random()
                .toString(36)
                .substr(2, 9)}`,
              chatId: this.config.currentChatId,
              content: memoryData.content,
              originalContext: memoryData.originalContext || content,
              embedding,
              relevanceScore: memoryData.relevanceScore || 0.8,
              extractedAt: Date.now(),
              messageIds: [parseInt(userMessageId || '0')],
              category: memoryData.category || 'other',
            };

            memories.push(memory);
          }
        }

        if (memories.length > 0) {
          await this.config.memoryManager.storeMemories(memories);
          return memories;
        }
      }
      return [];
    } catch (err) {
      console.warn('🧠 [Memory] Failed to store memories:', err);
      return [];
    }
  }

  public async getRelevantContext(content: string): Promise<string> {
    if (this.config.memoryManager.isInitialized && this.config.currentChatId) {
      try {
        return await this.config.memoryManager.getRelevantContext(
          content,
          this.config.currentChatId,
        );
      } catch (err) {
        console.warn('Failed to get memory context:', err);
        return '';
      }
    }
    return '';
  }
}

