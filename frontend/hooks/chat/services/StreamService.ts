import { TokenBatcher } from '../../../lib/streaming/tokenBatcher';
import { ChatAction } from '../state/chatReducer';
import { NegotiationResult } from '../types/ChatTypes';

export interface StreamServiceConfig {
  batchSize?: number;
  flushInterval?: number;
  enhancedAssistantMessageId: string;
  dispatch: React.Dispatch<ChatAction>;
}

export class StreamService {
  private batcher: TokenBatcher;
  private accumulatedContent = '';
  private config: StreamServiceConfig;

  constructor(config: StreamServiceConfig) {
    this.config = config;
    this.batcher = new TokenBatcher({
      batchSize: config.batchSize || 10,
      flushInterval: config.flushInterval || 100,
      onBatch: this.handleBatch.bind(this),
      onComplete: this.handleComplete.bind(this),
    });
  }

  private handleBatch(tokens: string) {
    this.accumulatedContent += tokens;

    // Update enhanced message content
    this.config.dispatch({
      type: 'UPDATE_ENHANCED_MESSAGE',
      id: this.config.enhancedAssistantMessageId,
      updates: { content: this.accumulatedContent },
    });

    // Update regular message content
    this.config.dispatch({
      type: 'UPDATE_MESSAGE',
      id: this.config.enhancedAssistantMessageId,
      content: this.accumulatedContent,
    });
  }

  private handleComplete() {
    this.config.dispatch({ type: 'STOP_STREAMING' });
  }

  public addToken(token: string) {
    this.batcher.addToken(token);
  }

  public complete() {
    this.batcher.complete();
  }

  public reset() {
    this.accumulatedContent = '';
  }

  public getAccumulatedContent() {
    return this.accumulatedContent;
  }

  public createEventHandlers() {
    return {
      onToken: (token: string) => {
        this.addToken(token);
      },

      onComplete: () => {
        this.complete();
      },

      onError: (error: string) => {
        this.config.dispatch({
          type: 'SET_ERROR',
          error: new Error(error),
        });
      },

      onSubAgentEvent: (agentEvent: {
        agent: string;
        token: string;
        isStreaming?: boolean;
        task?: string;
        context?: string;
      }) => {
        // Handle sub-agent events
        this.config.dispatch({
          type: 'ADD_AGENT_EVENT',
          event: {
            agent: agentEvent.agent,
            content: agentEvent.token,
            timestamp: Date.now(),
            type: agentEvent.isStreaming ? 'token' : 'complete',
            status: agentEvent.isStreaming ? 'active' : 'completed',
          },
        });
      },

      onToolCallEvent: (toolCallEvent: {
        type: 'start' | 'complete' | 'error';
        toolName: string;
        arguments?: any;
        result?: any;
        error?: string;
      }) => {
        // Handle tool call events
        this.config.dispatch({
          type: 'ADD_TOOL_CALL',
          event: toolCallEvent,
        });
      },

      onNegotiationResult: (result: NegotiationResult) => {
        this.config.dispatch({
          type: 'SET_NEGOTIATION_RESULT',
          result,
        });
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
        this.config.dispatch({
          type: 'SET_NEGOTIATION_RESULT',
          result,
        });
      },
    };
  }
}
