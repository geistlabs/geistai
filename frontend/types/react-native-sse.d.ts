declare module 'react-native-sse' {
  export interface EventSourceOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    withCredentials?: boolean;
    timeout?: number;
  }

  export interface MessageEvent {
    data: string;
    origin?: string;
    lastEventId?: string;
    source?: EventSource;
    ports?: any[];
  }

  export default class EventSource {
    constructor(url: string, options?: EventSourceOptions);

    addEventListener(
      type: string,
      listener: (event: MessageEvent) => void,
    ): void;
    removeEventListener(
      type: string,
      listener: (event: MessageEvent) => void,
    ): void;
    close(): void;

    readonly readyState: number;
    readonly url: string;
    readonly withCredentials: boolean;

    static readonly CONNECTING: number;
    static readonly OPEN: number;
    static readonly CLOSED: number;

    onopen?: (event: Event) => void;
    onmessage?: (event: MessageEvent) => void;
    onerror?: (event: Event) => void;
  }
}
