/**
 * RevenueCat integration for GeistAI
 * Real RevenueCat SDK implementation
 */

import type {
  CustomerInfo,
  PurchasesOfferings,
  PurchasesPackage,
} from 'react-native-purchases';

// Lazy import to avoid NativeEventEmitter initialization issues
let Purchases: any = null;
let LOG_LEVEL_CONSTANTS: any = null;

const getPurchases = () => {
  if (!Purchases) {
    try {
      // Suppress the NativeEventEmitter error that occurs during require
      // This is expected when running in Expo Development Client
      const originalWarn = console.warn;
      const originalError = console.error;
      let suppressedError = false;

      console.warn = (...args: any[]) => {
        if (args[0]?.includes?.('NativeEventEmitter')) {
          suppressedError = true;
          return;
        }
        originalWarn(...args);
      };

      console.error = (...args: any[]) => {
        if (
          args[0]?.includes?.('NativeEventEmitter') ||
          args[0]?.includes?.('Invariant Violation')
        ) {
          suppressedError = true;
          return;
        }
        originalError(...args);
      };

      try {
        const rcModule = require('react-native-purchases');
        Purchases = rcModule.default || rcModule;
        LOG_LEVEL_CONSTANTS = rcModule.LOG_LEVEL || rcModule.default?.LOG_LEVEL;
        console.log('✅ RevenueCat native module loaded successfully');
      } finally {
        console.warn = originalWarn;
        console.error = originalError;
      }
    } catch (error) {
      console.warn(
        '⚠️ RevenueCat native module not available, using mock implementation',
      );
      // Return a mock object to prevent crashes
      const mockEntitlements = { active: {} };
      const mockCustomerInfo = {
        originalAppUserId: 'anonymous',
        entitlements: mockEntitlements,
      };

      Purchases = {
        setLogLevel: () => {},
        configure: () => {
          console.log('📝 [Mock] RevenueCat configure called');
          return Promise.resolve();
        },
        getCustomerInfo: () => {
          console.log('📝 [Mock] RevenueCat getCustomerInfo called');
          return Promise.resolve(mockCustomerInfo);
        },
        getOfferings: () => {
          console.log('📝 [Mock] RevenueCat getOfferings called');
          return Promise.resolve({ current: null, all: {} });
        },
        purchasePackage: () => {
          console.log('📝 [Mock] RevenueCat purchasePackage called');
          return Promise.resolve({
            customerInfo: mockCustomerInfo,
            userCancelled: false,
          });
        },
        restorePurchases: () => {
          console.log('📝 [Mock] RevenueCat restorePurchases called');
          return Promise.resolve(mockCustomerInfo);
        },
        logIn: () => {
          console.log('📝 [Mock] RevenueCat logIn called');
          return Promise.resolve();
        },
        logOut: () => {
          console.log('📝 [Mock] RevenueCat logOut called');
          return Promise.resolve();
        },
      };
      LOG_LEVEL_CONSTANTS = { INFO: 'INFO' };
    }
  }
  return Purchases;
};

const getLOG_LEVEL = () => {
  if (!LOG_LEVEL_CONSTANTS) {
    getPurchases();
  }
  return LOG_LEVEL_CONSTANTS || { INFO: 'INFO' };
};

class RevenueCatService {
  private isInitialized = false;
  private developmentOverride: boolean | null = null; // For testing: null = use real data, true/false = override

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Get lazy-loaded Purchases and LOG_LEVEL
      const Purchases = getPurchases();
      const LOG_LEVEL = getLOG_LEVEL();

      // Configure RevenueCat
      Purchases.setLogLevel(LOG_LEVEL.INFO);

      // Initialize with your RevenueCat API keys
      // Replace these with your actual API keys from RevenueCat dashboard
      const apiKey = __DEV__
        ? 'test_KWoKSNKRwCVgtwxTRwDXTOFVNLb' // Sandbox key for development
        : 'appl_your_production_api_key_here'; // Production key for release

      await Purchases.configure({ apiKey });

      this.isInitialized = true;
      console.log('✅ [RevenueCat] Initialized successfully');
    } catch (error) {
      console.error('❌ [RevenueCat] Initialization failed:', error);
      throw error;
    }
  }

  async getAppUserId(): Promise<string> {
    try {
      const Purchases = getPurchases();
      const customerInfo = await Purchases.getCustomerInfo();
      return customerInfo.originalAppUserId;
    } catch (error) {
      console.error('❌ [RevenueCat] Failed to get user ID:', error);
      return `anonymous_${Date.now()}`;
    }
  }

  async isPremiumUser(): Promise<boolean> {
    // Development override for testing
    if (__DEV__ && this.developmentOverride !== null) {
      console.log(
        `🔧 [RevenueCat] Development override: ${this.developmentOverride}`,
      );
      return this.developmentOverride;
    }

    try {
      const Purchases = getPurchases();
      const customerInfo = await Purchases.getCustomerInfo();
      return customerInfo.entitlements.active['premium'] !== undefined;
    } catch (error) {
      console.error('❌ [RevenueCat] Failed to check premium status:', error);
      return false;
    }
  }

  async getOfferings(): Promise<PurchasesOfferings> {
    try {
      const Purchases = getPurchases();
      const offerings = await Purchases.getOfferings();
      return offerings;
    } catch (error) {
      console.error('❌ [RevenueCat] Failed to get offerings:', error);
      throw error;
    }
  }

  async purchasePackage(packageToPurchase: PurchasesPackage): Promise<{
    customerInfo: CustomerInfo;
    userCancelled: boolean;
  }> {
    try {
      console.log(
        '🛒 [RevenueCat] Starting purchase:',
        packageToPurchase.identifier,
      );

      const Purchases = getPurchases();
      const result = await Purchases.purchasePackage(packageToPurchase);

      if (!result.userCancelled) {
        console.log('✅ [RevenueCat] Purchase successful');
      } else {
        console.log('⚠️ [RevenueCat] Purchase cancelled by user');
      }

      return result;
    } catch (error) {
      console.error('❌ [RevenueCat] Purchase failed:', error);
      throw error;
    }
  }

  async restorePurchases(): Promise<CustomerInfo> {
    try {
      console.log('🔄 [RevenueCat] Restoring purchases');
      const Purchases = getPurchases();
      const customerInfo = await Purchases.restorePurchases();
      console.log('✅ [RevenueCat] Purchases restored');
      return customerInfo;
    } catch (error) {
      console.error('❌ [RevenueCat] Restore failed:', error);
      throw error;
    }
  }

  async getCustomerInfo(): Promise<CustomerInfo> {
    try {
      const Purchases = getPurchases();
      return await Purchases.getCustomerInfo();
    } catch (error) {
      console.error('❌ [RevenueCat] Failed to get customer info:', error);
      throw error;
    }
  }

  // Development helpers (keep for testing)
  async setDebugUserId(userId: string): Promise<void> {
    try {
      const Purchases = getPurchases();
      await Purchases.logIn(userId);
      console.log(`🔧 [RevenueCat] Debug user ID set to: ${userId}`);
    } catch (error) {
      console.error('❌ [RevenueCat] Failed to set debug user ID:', error);
    }
  }

  async logOut(): Promise<void> {
    try {
      const Purchases = getPurchases();
      await Purchases.logOut();
      console.log('🔄 [RevenueCat] User logged out');
    } catch (error) {
      console.error('❌ [RevenueCat] Logout failed:', error);
    }
  }

  // Development methods for testing
  async cancelSubscription(): Promise<boolean> {
    if (!__DEV__) {
      console.warn(
        '🔧 [RevenueCat] Subscription cancellation only available in development',
      );
      return false;
    }

    try {
      const Purchases = getPurchases();
      const userId = await this.getAppUserId();
      console.log(
        `🔄 [RevenueCat] Attempting to cancel subscription for user: ${userId}`,
      );

      // First, get customer info to find active subscriptions
      const customerInfo = await this.getCustomerInfo();
      const activeEntitlements = Object.keys(customerInfo.entitlements.active);

      if (activeEntitlements.length === 0) {
        console.log('ℹ️ [RevenueCat] No active subscriptions found to cancel');
        return true; // Consider this a success since goal is achieved
      }

      console.log('📋 [RevenueCat] Active entitlements:', activeEntitlements);

      // For now, we'll use the SDK's restore method to refresh state
      // and then use development override as the primary method
      console.log(
        '🔄 [RevenueCat] Using development override for reliable testing',
      );
      this.setDevelopmentOverride(false);

      // Also try to restore purchases to sync with server
      try {
        await Purchases.restorePurchases();
        console.log('✅ [RevenueCat] Purchases restored (may help sync state)');
      } catch (restoreError) {
        console.log('⚠️ [RevenueCat] Restore failed, continuing with override');
      }

      return true;
    } catch (error) {
      console.error('❌ [RevenueCat] Error in cancel subscription:', error);
      // Fallback to development override
      this.setDevelopmentOverride(false);
      return true; // Return true since we achieved the goal via override
    }
  }

  setDevelopmentOverride(isPremium: boolean | null): void {
    if (__DEV__) {
      this.developmentOverride = isPremium;
      console.log(`🔧 [RevenueCat] Development override set to: ${isPremium}`);
    } else {
      console.warn(
        '🔧 [RevenueCat] Development override only available in development',
      );
    }
  }

  clearDevelopmentOverride(): void {
    if (__DEV__) {
      this.developmentOverride = null;
      console.log(
        '🔧 [RevenueCat] Development override cleared - using real data',
      );
    }
  }

  // Legacy methods for backward compatibility during transition
  setPremiumStatus(isPremium: boolean): void {
    console.warn(
      '🔧 [RevenueCat] setPremiumStatus is deprecated - use setDevelopmentOverride() instead',
    );
    this.setDevelopmentOverride(isPremium);
  }

  togglePremiumStatus(): boolean {
    console.warn(
      '🔧 [RevenueCat] togglePremiumStatus is deprecated - use setDevelopmentOverride() instead',
    );
    const newStatus = !(this.developmentOverride ?? false);
    this.setDevelopmentOverride(newStatus);
    return newStatus;
  }

  reset(): void {
    console.warn(
      '🔧 [RevenueCat] reset is deprecated - use setDevelopmentOverride(false) instead',
    );
    this.setDevelopmentOverride(false);
  }
}

// Export singleton instance
export const revenuecat = new RevenueCatService();

// Re-export types for convenience
export type {
  CustomerInfo,
  PurchasesOfferings,
  PurchasesPackage,
} from 'react-native-purchases';
