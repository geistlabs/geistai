/**
 * Debug Configuration for GeistAI Frontend
 *
 * This file controls debug logging and debugging features
 */

export interface DebugConfig {
  // Enable/disable debug mode
  enabled: boolean;

  // Logging levels
  logLevel: 'none' | 'error' | 'warn' | 'info' | 'debug';

  // Features to debug
  features: {
    api: boolean; // API requests/responses
    streaming: boolean; // Streaming events
    routing: boolean; // Route selection
    performance: boolean; // Performance metrics
    errors: boolean; // Error tracking
    ui: boolean; // UI interactions
  };

  // Performance monitoring
  performance: {
    trackTokenCount: boolean;
    trackResponseTime: boolean;
    trackMemoryUsage: boolean;
    logSlowRequests: boolean;
    slowRequestThreshold: number; // milliseconds
  };

  // Console output
  console: {
    showTimestamps: boolean;
    showCallStack: boolean;
    maxLogLength: number;
  };
}

export const defaultDebugConfig: DebugConfig = {
  enabled: false,
  logLevel: 'info',
  features: {
    api: true,
    streaming: true,
    routing: true,
    performance: true,
    errors: true,
    ui: false,
  },
  performance: {
    trackTokenCount: true,
    trackResponseTime: true,
    trackMemoryUsage: false,
    logSlowRequests: true,
    slowRequestThreshold: 5000, // 5 seconds
  },
  console: {
    showTimestamps: true,
    showCallStack: false,
    maxLogLength: 200,
  },
};

export const debugConfig: DebugConfig = {
  ...defaultDebugConfig,
  enabled: __DEV__, // Enable in development mode
  logLevel: __DEV__ ? 'debug' : 'error',
};

/**
 * Debug Logger Class
 */
export class DebugLogger {
  private config: DebugConfig;

  constructor(config: DebugConfig = debugConfig) {
    this.config = config;
  }

  private shouldLog(level: string): boolean {
    const levels = ['none', 'error', 'warn', 'info', 'debug'];
    const currentLevelIndex = levels.indexOf(this.config.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }

  private formatMessage(
    level: string,
    category: string,
    message: string,
    data?: any,
  ): string {
    let formatted = '';

    if (this.config.console.showTimestamps) {
      formatted += `[${new Date().toISOString()}] `;
    }

    formatted += `[${level.toUpperCase()}] [${category}] ${message}`;

    if (data !== undefined) {
      const dataStr = JSON.stringify(data, null, 2);
      if (dataStr.length > this.config.console.maxLogLength) {
        formatted += `\n${dataStr.substring(0, this.config.console.maxLogLength)}...`;
      } else {
        formatted += `\n${dataStr}`;
      }
    }

    if (this.config.console.showCallStack && level === 'error') {
      formatted += `\n${new Error().stack}`;
    }

    return formatted;
  }

  error(category: string, message: string, data?: any): void {
    if (!this.shouldLog('error')) return;
    console.error(this.formatMessage('error', category, message, data));
  }

  warn(category: string, message: string, data?: any): void {
    if (!this.shouldLog('warn')) return;
    console.warn(this.formatMessage('warn', category, message, data));
  }

  info(category: string, message: string, data?: any): void {
    if (!this.shouldLog('info')) return;
    console.info(this.formatMessage('info', category, message, data));
  }

  debug(category: string, message: string, data?: any): void {
    if (!this.shouldLog('debug')) return;
    console.log(this.formatMessage('debug', category, message, data));
  }

  // Feature-specific logging methods
  api(message: string, data?: any): void {
    if (!this.config.features.api) return;
    this.info('API', message, data);
  }

  streaming(message: string, data?: any): void {
    if (!this.config.features.streaming) return;
    this.debug('STREAMING', message, data);
  }

  routing(message: string, data?: any): void {
    if (!this.config.features.routing) return;
    this.info('ROUTING', message, data);
  }

  performance(message: string, data?: any): void {
    if (!this.config.features.performance) return;
    this.info('PERFORMANCE', message, data);
  }

  error(category: string, message: string, data?: any): void {
    if (!this.config.features.errors) return;
    this.error(category, message, data);
  }

  ui(message: string, data?: any): void {
    if (!this.config.features.ui) return;
    this.debug('UI', message, data);
  }
}

// Export singleton instance
export const logger = new DebugLogger();

// Export convenience functions
export const debugApi = (message: string, data?: any) =>
  logger.api(message, data);
export const debugStreaming = (message: string, data?: any) =>
  logger.streaming(message, data);
export const debugRouting = (message: string, data?: any) =>
  logger.routing(message, data);
export const debugPerformance = (message: string, data?: any) =>
  logger.performance(message, data);
export const debugError = (category: string, message: string, data?: any) =>
  logger.error(category, message, data);
export const debugUI = (message: string, data?: any) =>
  logger.ui(message, data);

// Export debug utilities
export const isDebugEnabled = () => debugConfig.enabled;
export const isFeatureEnabled = (feature: keyof DebugConfig['features']) =>
  debugConfig.features[feature];
export const isPerformanceTracking = () =>
  debugConfig.performance.trackTokenCount ||
  debugConfig.performance.trackResponseTime;
