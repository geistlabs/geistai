/**
 * Environment detection utilities
 * Single source of truth for environment detection
 */

import Constants from 'expo-constants';

export type Environment = 'expo-go' | 'development' | 'production';

// Development override: Set this to force a specific environment
// Set to null to use automatic detection
let developmentEnvironmentOverride: Environment | null = null;

/**
 * Override the environment detection (for development/testing only)
 * @param env - The environment to force, or null to use automatic detection
 */
export function setEnvironmentOverride(env: Environment | null) {
  if (env) {
    console.log('🔧 [Environment] Overriding environment to:', env);
  }
  developmentEnvironmentOverride = env;
}

/**
 * Detects the current environment using Expo Constants
 * This is the single source of truth for environment detection
 */
export function getEnvironment(): Environment {
  // If overridden, use that
  if (developmentEnvironmentOverride !== null) {
    return developmentEnvironmentOverride;
  }

  const { executionEnvironment } = Constants;

  console.log('🔍 [Environment] executionEnvironment:', executionEnvironment);
  console.log('🔍 [Environment] __DEV__:', __DEV__);

  // Standard checks
  switch (executionEnvironment) {
    case 'storeClient':
      // Expo Go app from App Store or Google Play
      return 'expo-go';
    case 'standalone':
      // Production standalone build
      return 'production';
    case 'bare':
      // Bare workflow - could be 'expo start' or 'expo run:ios/android'
      // Both return the same values, so we default to development
      // For Expo Go, you can use: setEnvironmentOverride('expo-go')
      return 'development';
    default:
      // Fallback for unknown environments
      console.warn(
        '⚠️ [Environment] Unknown environment, defaulting to development',
      );
      return 'development';
  }
}

/**
 * Checks if running in Expo Go
 */
export function isExpoGo(): boolean {
  return getEnvironment() === 'expo-go';
}

/**
 * Checks if running in development build (Xcode/Android Studio)
 */
export function isDevelopmentBuild(): boolean {
  return getEnvironment() === 'development';
}

/**
 * Checks if running in production build
 */
export function isProductionBuild(): boolean {
  return getEnvironment() === 'production';
}

/**
 * Checks if running in any native build (development or production)
 */
export function isNativeBuild(): boolean {
  return isDevelopmentBuild() || isProductionBuild();
}
