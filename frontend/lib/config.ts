import Constants from 'expo-constants';

// Determine environment (default to test for safety)
const isProduction = Constants.expoConfig?.extra?.environment === 'production';
const rcEnv = isProduction ? 'production' : 'test';

export const config = {
  revenuecat: {
    publicKey: Constants.expoConfig?.extra?.revenuecat?.[rcEnv] || '',
    entitlementId: 'premium',
    environment: rcEnv,
  },
  api: {
    baseUrl: isProduction ? 'https://api.geist.im' : 'http://localhost:8000',
  },
};

// Log configuration in development
if (__DEV__) {
  console.log('🔧 RevenueCat Environment:', rcEnv);
  console.log(
    '🔑 RC Key:',
    config.revenuecat.publicKey.substring(0, 20) + '...',
  );
}

