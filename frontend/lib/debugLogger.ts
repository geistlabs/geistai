// Simple debug logging for TestFlight
export class DebugLogger {
  private static baseUrl = 'https://router.geist.im';

  static async log(
    level: 'info' | 'error' | 'warn',
    message: string,
    data?: any,
  ) {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        data: data ? JSON.stringify(data) : undefined,
        platform: 'ios',
        build: 'testflight',
      };

      await fetch(`${DebugLogger.baseUrl}/api/debug-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logEntry),
      });
    } catch (e) {
      // Silently fail - don't break the app
      console.warn('Debug log failed:', e);
    }
  }

  static info(message: string, data?: any) {
    console.log(`[DEBUG] ${message}`, data);
    DebugLogger.log('info', message, data);
  }

  static error(message: string, data?: any) {
    console.error(`[DEBUG] ${message}`, data);
    DebugLogger.log('error', message, data);
  }

  static warn(message: string, data?: any) {
    console.warn(`[DEBUG] ${message}`, data);
    DebugLogger.log('warn', message, data);
  }
}
