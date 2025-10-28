import { TokenBatcher } from '../../../lib/streaming/tokenBatcher';

type StreamingCallback = (data: {
  tokens: string;
  accumulatedContent: string;
}) => void;
type CompleteCallback = (content: string) => void;
type ErrorCallback = (error: Error) => void;

export class StreamingService {
  private batcher: TokenBatcher;
  private accumulatedContent: string = '';
  private callbacks: {
    onTokens?: StreamingCallback;
    onComplete?: CompleteCallback;
    onError?: ErrorCallback;
  } = {};

  constructor(batchSize: number = 10, flushInterval: number = 100) {
    this.batcher = new TokenBatcher({
      batchSize,
      flushInterval,
      onBatch: this.handleBatch.bind(this),
      onComplete: this.handleComplete.bind(this),
    });
  }

  private handleBatch(tokens: string) {
    this.accumulatedContent += tokens;
    this.callbacks.onTokens?.({
      tokens,
      accumulatedContent: this.accumulatedContent,
    });
  }

  private handleComplete() {
    this.callbacks.onComplete?.(this.accumulatedContent);
  }

  public onTokens(callback: StreamingCallback) {
    this.callbacks.onTokens = callback;
    return this;
  }

  public onComplete(callback: CompleteCallback) {
    this.callbacks.onComplete = callback;
    return this;
  }

  public onError(callback: ErrorCallback) {
    this.callbacks.onError = callback;
    return this;
  }

  public addToken(token: string) {
    try {
      this.batcher.addToken(token);
    } catch (error) {
      this.callbacks.onError?.(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  public complete() {
    this.batcher.complete();
  }

  public reset() {
    this.accumulatedContent = '';
    // Don't clear callbacks - they might be reused
  }

  public getAccumulatedContent() {
    return this.accumulatedContent;
  }
}

