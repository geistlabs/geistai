export interface Environment {
  API_URL: string;
  NODE_ENV: 'development' | 'production' | 'test';
  REVENUECAT_API_KEY: string;
  BYPASS_PREMIUM: boolean;
}

const getEnvironment = (): Environment => {
  const isProduction = !__DEV__;
  const useLocalApi = process.env.EXPO_PUBLIC_USE_LOCAL_API === 'true';
  // Using local API for development
  let apiUrl: string;

  if (useLocalApi) {
    // Use local development API
    apiUrl = process.env.EXPO_PUBLIC_LOCAL_API_URL || 'http://localhost:8000';
    // Using local API
  } else {
    // Use production API
    apiUrl = process.env.EXPO_PUBLIC_PROD_API_URL || 'https://api.geist.im';
    // Using production API
  }

  return {
    API_URL: apiUrl,
    NODE_ENV: isProduction ? 'production' : 'development',
    REVENUECAT_API_KEY: isProduction
      ? process.env.EXPO_PUBLIC_REVENUECAT_PRODUCTION_API_KEY!
      : process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY!,
    BYPASS_PREMIUM: !isProduction, // Always bypass in development
  };
};

export const ENV = getEnvironment();
