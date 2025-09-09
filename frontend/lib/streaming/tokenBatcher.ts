export interface TokenBatcherOptions {
  batchSize?: number;
  flushInterval?: number;
  onBatch: (tokens: string) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

export class TokenBatcher {
  private buffer: string[] = [];
  private batchSize: number;
  private flushInterval: number;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private onBatch: (tokens: string) => void;
  private onError?: (error: Error) => void;
  private onComplete?: () => void;
  private isCompleted = false;
  private tokenCount = 0;

  constructor(options: TokenBatcherOptions) {
    this.batchSize = options.batchSize || 5;
    this.flushInterval = options.flushInterval || 50;
    this.onBatch = options.onBatch;
    this.onError = options.onError;
    this.onComplete = options.onComplete;
  }

  addToken(token: string) {
    if (this.isCompleted) return;
    
    this.buffer.push(token);
    this.tokenCount++;
    
    if (this.buffer.length >= this.batchSize) {
      this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.flushInterval);
    }
  }

  flush() {
    if (this.buffer.length === 0) return;
    
    const batch = this.buffer.join('');
    this.buffer = [];
    
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    
    try {
      this.onBatch(batch);
    } catch (error) {
      this.onError?.(error as Error);
    }
  }

  complete() {
    if (this.isCompleted) return;
    
    this.flush();
    this.isCompleted = true;
    this.onComplete?.();
  }

  abort() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.buffer = [];
    this.isCompleted = true;
  }

  getTokenCount() {
    return this.tokenCount;
  }
}