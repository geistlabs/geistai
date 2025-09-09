import { useState, useCallback, useRef, useEffect } from 'react';

export interface StreamOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  onChunk?: (chunk: string) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
  parseChunks?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface UseStreamingReturn {
  data: string;
  isStreaming: boolean;
  error: Error | null;
  startStream: (options: StreamOptions) => Promise<void>;
  stopStream: () => void;
  clearData: () => void;
}

export function useStreaming(): UseStreamingReturn {
  const [data, setData] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  const processSSELine = (line: string, onChunk?: (chunk: string) => void): string | null => {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') {
        return null;
      }
      onChunk?.(data);
      return data;
    }
    return null;
  };

  const startStream = useCallback(async (options: StreamOptions) => {
    const {
      url,
      method = 'GET',
      headers = {},
      body,
      onChunk,
      onError,
      onComplete,
      parseChunks = true,
      retryAttempts = 3,
      retryDelay = 1000
    } = options;

    if (isStreaming) {
      console.warn('[useStreaming] Stream already in progress');
      return;
    }

    setError(null);
    setIsStreaming(true);
    setData('');

    let attempt = 0;

    const attemptStream = async (): Promise<void> => {
      try {
        abortControllerRef.current = new AbortController();

        const response = await fetch(url, {
          method,
          headers: {
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
            ...headers
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: abortControllerRef.current.signal
        });

        if (!response.ok) {
          throw new Error(`Stream request failed: ${response.status} ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulatedData = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            setData(accumulatedData);
            onComplete?.();
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim()) {
              if (parseChunks) {
                const processedData = processSSELine(line, onChunk);
                if (processedData) {
                  accumulatedData += processedData;
                  setData(accumulatedData);
                }
              } else {
                accumulatedData += line + '\n';
                setData(accumulatedData);
                onChunk?.(line);
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('[useStreaming] Stream aborted');
          return;
        }

        attempt++;
        
        if (attempt < retryAttempts) {
          console.log(`[useStreaming] Retrying stream (attempt ${attempt + 1}/${retryAttempts})`);
          
          retryTimeoutRef.current = setTimeout(() => {
            attemptStream();
          }, retryDelay * Math.pow(2, attempt - 1));
        } else {
          const error = err instanceof Error ? err : new Error('Stream failed');
          console.error('[useStreaming] Stream error:', error);
          setError(error);
          onError?.(error);
          setIsStreaming(false);
        }
      }
    };

    await attemptStream();
    setIsStreaming(false);
  }, [isStreaming]);

  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      console.log('[useStreaming] Stopping stream');
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    setIsStreaming(false);
  }, []);

  const clearData = useCallback(() => {
    setData('');
    setError(null);
  }, []);

  return {
    data,
    isStreaming,
    error,
    startStream,
    stopStream,
    clearData
  };
}