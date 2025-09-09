import Constants from 'expo-constants';

export interface Environment {
  API_URL: string;
  NODE_ENV: 'development' | 'production' | 'test';
}

const getEnvironment = (): Environment => {
  const isProduction = !__DEV__;

  // Default to development values
  let apiUrl = 'http://localhost:8000';
  
  if (isProduction) {
    // Production API URL - you'll need to set this in your app.json or env
    apiUrl = Constants.expoConfig?.extra?.apiUrl || 'https://your-production-api.com';
  } else {
    // Development - use localhost or env override
    apiUrl = Constants.expoConfig?.extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';
  }

  return {
    API_URL: apiUrl,
    NODE_ENV: isProduction ? 'production' : 'development'
  };
};

export const ENV = getEnvironment();