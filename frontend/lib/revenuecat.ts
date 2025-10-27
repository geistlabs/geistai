/**
 * RevenueCat integration for GeistAI
 * Real RevenueCat SDK implementation
 */

import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PurchasesPackage,
} from 'react-native-purchases';

// Import Offerings type separately due to export structure
import type { PurchasesOfferings } from 'react-native-purchases';

class RevenueCatService {
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
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
      const customerInfo = await Purchases.getCustomerInfo();
      return customerInfo.originalAppUserId;
    } catch (error) {
      console.error('❌ [RevenueCat] Failed to get user ID:', error);
      return `anonymous_${Date.now()}`;
    }
  }

  async isPremiumUser(): Promise<boolean> {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      return customerInfo.entitlements.active['premium'] !== undefined;
    } catch (error) {
      console.error('❌ [RevenueCat] Failed to check premium status:', error);
      return false;
    }
  }

  async getOfferings(): Promise<PurchasesOfferings> {
    try {
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
      return await Purchases.getCustomerInfo();
    } catch (error) {
      console.error('❌ [RevenueCat] Failed to get customer info:', error);
      throw error;
    }
  }

  // Development helpers (keep for testing)
  async setDebugUserId(userId: string): Promise<void> {
    try {
      await Purchases.logIn(userId);
      console.log(`🔧 [RevenueCat] Debug user ID set to: ${userId}`);
    } catch (error) {
      console.error('❌ [RevenueCat] Failed to set debug user ID:', error);
    }
  }

  async logOut(): Promise<void> {
    try {
      await Purchases.logOut();
      console.log('🔄 [RevenueCat] User logged out');
    } catch (error) {
      console.error('❌ [RevenueCat] Logout failed:', error);
    }
  }

  // Legacy methods for backward compatibility during transition
  setPremiumStatus(isPremium: boolean): void {
    console.warn(
      '🔧 [RevenueCat] setPremiumStatus is deprecated - use real RevenueCat purchases',
    );
  }

  togglePremiumStatus(): boolean {
    console.warn(
      '🔧 [RevenueCat] togglePremiumStatus is deprecated - use real RevenueCat purchases',
    );
    return false;
  }

  reset(): void {
    console.warn('🔧 [RevenueCat] reset is deprecated - use logOut() instead');
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
