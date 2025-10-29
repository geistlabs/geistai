/**
 * Custom hook for environment detection
 * Provides environment information throughout the app
 */

import { isExpoGo, isNativeBuild } from '../lib/utils/environment';

export interface EnvironmentContext {
  isExpoGoEnv: boolean;
  isNativeBuildEnv: boolean;
}

export function useEnvironmentContext(): EnvironmentContext {
  const isExpoGoEnv = isExpoGo();
  const isNativeBuildEnv = isNativeBuild();

  console.log('🌍 [useEnvironment] Environment detected:', {
    isExpoGo: isExpoGoEnv,
    isNativeBuild: isNativeBuildEnv,
  });

  return {
    isExpoGo: isExpoGoEnv,
    isNativeBuild: isNativeBuildEnv,
  };
}
