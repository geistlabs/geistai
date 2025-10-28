import { ChatAPI } from '../../../lib/api/chat';
import { ApiClient } from '../../../lib/api/client';
import {
  createSubAgentHandler,
  createTokenHandler,
  createToolCallHandler,
} from '../handlers/tokenHandler';
import {
  ChatMessage,
  EnhancedMessage,
  NegotiationResult,
} from '../types/ChatTypes';

import { StreamingService } from './StreamingService';

export interface ChatServiceConfig {
  baseUrl: string;
  timeout?: number;
  maxRetries?: number;
  streaming?: {
    batchSize: number;
    flushInterval: number;
  };
}

export interface ChatServiceCallbacks {
  onUpdateMessage: (id: string, content: string) => void;
  onUpdateEnhancedMessage: (
    id: string,
    updates: Partial<EnhancedMessage>,
  ) => void;
  onNegotiationResult: (result: NegotiationResult) => void;
  onError: (error: Error) => void;
  onComplete: () => void;
}

export class ChatService {
  private streamingService: StreamingService;
  private apiClient: ApiClient;
  private chatApi: ChatAPI;
  private callbacks: ChatServiceCallbacks;

  constructor(config: ChatServiceConfig, callbacks: ChatServiceCallbacks) {
    this.streamingService = new StreamingService(
      config.streaming?.batchSize || 10,
      config.streaming?.flushInterval || 100,
    );

    this.apiClient = new ApiClient({
      baseUrl: config.baseUrl,
      timeout: config.timeout || 120000,
      maxRetries: config.maxRetries || 3,
    });

    this.chatApi = new ChatAPI(this.apiClient);
    this.callbacks = callbacks;
  }

  public async sendMessage(
    content: string,
    isPremium: boolean,
    messageHistory: ChatMessage[],
    enhancedMessageId: string,
  ): Promise<void> {
    try {
      // Create event handlers
      const eventHandlers = {
        onToken: createTokenHandler({
          messageId: enhancedMessageId,
          streamingService: this.streamingService,
          onUpdateMessage: this.callbacks.onUpdateMessage,
          onUpdateEnhancedMessage: this.callbacks.onUpdateEnhancedMessage,
        }),

        onSubAgentEvent: createSubAgentHandler({
          messageId: enhancedMessageId,
          onUpdateEnhancedMessage: this.callbacks.onUpdateEnhancedMessage,
        }),

        onToolCallEvent: createToolCallHandler({
          messageId: enhancedMessageId,
          onUpdateEnhancedMessage: this.callbacks.onUpdateEnhancedMessage,
        }),

        onComplete: () => {
          this.streamingService.complete();
          this.callbacks.onComplete();
        },

        onError: (error: string) => {
          this.callbacks.onError(new Error(error));
        },

        onNegotiationChannel: (data: {
          final_price: number;
          package_id: string;
          negotiation_summary: string;
          stage: string;
          confidence: number;
        }) => {
          const result: NegotiationResult = {
            final_price: data.final_price,
            package_id: data.package_id,
            negotiation_summary: data.negotiation_summary,
          };
          this.callbacks.onNegotiationResult(result);
        },
      };

      // Use appropriate endpoint based on premium status
      if (isPremium) {
        await this.chatApi.sendStreamingMessage(
          content,
          messageHistory,
          eventHandlers,
        );
      } else {
        await this.chatApi.sendNegotiationMessage(
          content,
          messageHistory,
          eventHandlers,
        );
      }
    } catch (error) {
      this.callbacks.onError(
        error instanceof Error ? error : new Error('Failed to send message'),
      );
    } finally {
      this.streamingService.reset();
    }
  }

  public stopStreaming() {
    // Implementation depends on how the streaming can be stopped in your API
    // This might involve aborting fetch requests or closing SSE connections
  }
}
