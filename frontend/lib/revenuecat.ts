/**
 * RevenueCat integration for GeistAI
 * Real RevenueCat SDK implementation with mock fallback
 */

import { Platform } from 'react-native';
import type {
  CustomerInfo,
  PurchasesOfferings,
  PurchasesPackage,
} from 'react-native-purchases';

import { ENV } from './config/environment';

// Lazy import to avoid NativeEventEmitter initialization issues
let Purchases: any = null;
let LOG_LEVEL_CONSTANTS: any = null;

// Mock data for development/testing
const createMockCustomerInfo = (isPremium = false) => ({
  originalAppUserId: 'anonymous',
  entitlements: {
    active: isPremium
      ? {
          premium: {
            isActive: true,
            willRenew: true,
            periodType: 'NORMAL',
            latestPurchaseDate: new Date().toISOString(),
            originalPurchaseDate: new Date().toISOString(),
            expirationDate: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            store: 'APP_STORE',
            productIdentifier: 'premium_monthly_40',
            isSandbox: true,
          },
        }
      : {},
    all: {},
  },
  activeSubscriptions: isPremium ? ['premium_monthly_40'] : [],
  allPurchaseDates: isPremium
    ? { premium_monthly_40: new Date().toISOString() }
    : {},
  firstSeen: new Date().toISOString(),
  originalApplicationVersion: '1.0.0',
  requestDate: new Date().toISOString(),
});

const createMockOfferings = () => ({
  current: {
    identifier: 'default',
    availablePackages: [
      {
        identifier: 'premium_monthly_20',
        packageType: 'MONTHLY',
        product: {
          identifier: 'premium_monthly_20',
          description: 'Premium Monthly - $19.99',
          title: 'Premium Monthly',
          price: 19.99,
          priceString: '$19.99',
          currencyCode: 'USD',
        },
      },
      {
        identifier: 'premium_monthly_30',
        packageType: 'MONTHLY',
        product: {
          identifier: 'premium_monthly_30',
          description: 'Premium Monthly - $29.99',
          title: 'Premium Monthly',
          price: 29.99,
          priceString: '$29.99',
          currencyCode: 'USD',
        },
      },
      {
        identifier: 'premium_monthly_40',
        packageType: 'MONTHLY',
        product: {
          identifier: 'premium_monthly_40',
          description: 'Premium Monthly - $39.99',
          title: 'Premium Monthly',
          price: 39.99,
          priceString: '$39.99',
          currencyCode: 'USD',
        },
      },
    ],
  },
  all: {
    default: {
      identifier: 'default',
      availablePackages: [
        {
          identifier: 'premium_monthly_20',
          packageType: 'MONTHLY',
          product: {
            identifier: 'premium_monthly_20',
            description: 'Premium Monthly - $19.99',
            title: 'Premium Monthly',
            price: 19.99,
            priceString: '$19.99',
            currencyCode: 'USD',
          },
        },
        {
          identifier: 'premium_monthly_30',
          packageType: 'MONTHLY',
          product: {
            identifier: 'premium_monthly_30',
            description: 'Premium Monthly - $29.99',
            title: 'Premium Monthly',
            price: 29.99,
            priceString: '$29.99',
            currencyCode: 'USD',
          },
        },
        {
          identifier: 'premium_monthly_40',
          packageType: 'MONTHLY',
          product: {
            identifier: 'premium_monthly_40',
            description: 'Premium Monthly - $39.99',
            title: 'Premium Monthly',
            price: 39.99,
            priceString: '$39.99',
            currencyCode: 'USD',
          },
        },
      ],
    },
    premium_monthly_20: {
      identifier: 'premium_monthly_20',
      availablePackages: [
        {
          identifier: 'premium_monthly_20',
          packageType: 'MONTHLY',
          product: {
            identifier: 'premium_monthly_20',
            description: 'Premium Monthly - $19.99',
            title: 'Premium Monthly',
            price: 19.99,
            priceString: '$19.99',
            currencyCode: 'USD',
          },
        },
      ],
    },
    premium_monthly_30: {
      identifier: 'premium_monthly_30',
      availablePackages: [
        {
          identifier: 'premium_monthly_30',
          packageType: 'MONTHLY',
          product: {
            identifier: 'premium_monthly_30',
            description: 'Premium Monthly - $29.99',
            title: 'Premium Monthly',
            price: 29.99,
            priceString: '$29.99',
            currencyCode: 'USD',
          },
        },
      ],
    },
    premium_monthly_40: {
      identifier: 'premium_monthly_40',
      availablePackages: [
        {
          identifier: 'premium_monthly_40',
          packageType: 'MONTHLY',
          product: {
            identifier: 'premium_monthly_40',
            description: 'Premium Monthly - $39.99',
            title: 'Premium Monthly',
            price: 39.99,
            priceString: '$39.99',
            currencyCode: 'USD',
          },
        },
      ],
    },
  },
});

// Mock state to persist premium status
let mockIsPremium = false;

const getPurchases = () => {
  if (!Purchases) {
    // Check if we're in a web environment or Expo Go where native modules don't work
    if (typeof window !== 'undefined' || __DEV__) {
      console.log(
        '🔍 [RevenueCat] Running in development/web environment, using mock implementation',
      );

      Purchases = {
        setLogLevel: () => {},
        configure: () => {
          console.log('📝 [Mock] RevenueCat configure called');
          return Promise.resolve();
        },
        getCustomerInfo: () => {
          console.log('📝 [Mock] RevenueCat getCustomerInfo called');
          return Promise.resolve(createMockCustomerInfo(mockIsPremium));
        },
        getOfferings: () => {
          console.log('📝 [Mock] RevenueCat getOfferings called');
          return Promise.resolve(createMockOfferings());
        },
        purchasePackage: (packageToPurchase: any) => {
          console.log(
            '📝 [Mock] RevenueCat purchasePackage called with:',
            packageToPurchase?.identifier,
          );
          // Update mock state to premium
          mockIsPremium = true;
          return Promise.resolve({
            customerInfo: createMockCustomerInfo(true),
            userCancelled: false,
          });
        },
        restorePurchases: () => {
          console.log('📝 [Mock] RevenueCat restorePurchases called');
          return Promise.resolve(createMockCustomerInfo(mockIsPremium));
        },
        logIn: () => {
          console.log('📝 [Mock] RevenueCat logIn called');
          return Promise.resolve();
        },
        logOut: () => {
          console.log('📝 [Mock] RevenueCat logOut called');
          // Reset premium status on logout
          mockIsPremium = false;
          return Promise.resolve();
        },
      };
      LOG_LEVEL_CONSTANTS = { INFO: 'INFO' };
      return Purchases;
    }

    try {
      // Suppress the NativeEventEmitter error that occurs during require
      const originalWarn = console.warn;
      const originalError = console.error;

      console.warn = (...args: any[]) => {
        if (args[0]?.includes?.('NativeEventEmitter')) {
          return;
        }
        originalWarn(...args);
      };

      console.error = (...args: any[]) => {
        if (
          args[0]?.includes?.('NativeEventEmitter') ||
          args[0]?.includes?.('Invariant Violation')
        ) {
          return;
        }
        originalError(...args);
      };

      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const rcModule = require('react-native-purchases');
        if (!rcModule) {
          throw new Error('RevenueCat module is undefined');
        }
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
        error,
      );
      // Fallback to mock
      return getPurchases();
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
  private isMockMode = true; // Default to mock mode

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Check if we're in a native environment (Xcode, physical device)
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        // Try to use real RevenueCat SDK
        const Purchases = getPurchases();
        const LOG_LEVEL = getLOG_LEVEL();

        Purchases.setLogLevel(LOG_LEVEL.INFO);
        await Purchases.configure({ apiKey: ENV.REVENUECAT_API_KEY });
        this.isMockMode = false;
        console.log('✅ [RevenueCat] Real SDK initialized with API key');
      } else {
        // Fallback to mock for web/Expo Go
        this.isMockMode = true;
        console.log('⚠️ [RevenueCat] Using mock implementation (web/Expo Go)');
      }

      this.isInitialized = true;
    } catch (error) {
      // Fallback to mock if native module fails
      this.isMockMode = true;
      console.warn(
        '⚠️ [RevenueCat] Native module failed, using mock implementation',
        error,
      );
      this.isInitialized = true; // Mark as initialized to prevent retries
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

    // Use environment-based premium bypass logic
    if (ENV.BYPASS_PREMIUM) {
      console.log('🔧 [RevenueCat] Development: Bypassing premium check');
      return false; // Always show negotiation in development
    }

    // Production: Real premium checks
    try {
      if (this.isMockMode) {
        // Use mock implementation
        return (
          this.getMockCustomerInfo().entitlements.active['premium'] !==
          undefined
        );
      }

      const Purchases = getPurchases();
      const customerInfo = await Purchases.getCustomerInfo();
      const isPremium =
        customerInfo.entitlements.active['premium'] !== undefined;
      console.log('🔍 [RevenueCat] Premium check:', {
        isPremium,
        entitlements: customerInfo.entitlements.active,
        activeSubscriptions: customerInfo.activeSubscriptions,
      });
      return isPremium;
    } catch (error) {
      console.error('❌ [RevenueCat] Failed to check premium status:', error);
      return false;
    }
  }

  async getOfferings(): Promise<PurchasesOfferings> {
    try {
      if (this.isMockMode) {
        console.log('📝 [Mock] RevenueCat getOfferings called');
        return this.getMockOfferings();
      }

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
      if (this.isMockMode) {
        console.log('📝 [Mock] RevenueCat purchasePackage called');
        // Simulate successful purchase
        return {
          customerInfo: this.getMockCustomerInfo(true), // Premium customer
          userCancelled: false,
        };
      }

      const Purchases = getPurchases();
      const result = await Purchases.purchasePackage(packageToPurchase);
      return result;
    } catch (error) {
      console.error('❌ [RevenueCat] Failed to purchase package:', error);
      throw error;
    }
  }

  async restorePurchases(): Promise<CustomerInfo> {
    try {
      if (this.isMockMode) {
        console.log('📝 [Mock] RevenueCat restorePurchases called');
        return this.getMockCustomerInfo();
      }

      const Purchases = getPurchases();
      const customerInfo = await Purchases.restorePurchases();
      return customerInfo;
    } catch (error) {
      console.error('❌ [RevenueCat] Failed to restore purchases:', error);
      throw error;
    }
  }

  async getCustomerInfo(): Promise<CustomerInfo> {
    try {
      if (this.isMockMode) {
        console.log('📝 [Mock] RevenueCat getCustomerInfo called');
        return this.getMockCustomerInfo();
      }

      const Purchases = getPurchases();
      const customerInfo = await Purchases.getCustomerInfo();
      return customerInfo;
    } catch (error) {
      console.error('❌ [RevenueCat] Failed to get customer info:', error);
      throw error;
    }
  }

  async logIn(userId: string): Promise<void> {
    try {
      if (this.isMockMode) {
        console.log('📝 [Mock] RevenueCat logIn called');
        return;
      }

      const Purchases = getPurchases();
      await Purchases.logIn(userId);
    } catch (error) {
      console.error('❌ [RevenueCat] Failed to log in:', error);
      throw error;
    }
  }

  async logOut(): Promise<void> {
    try {
      if (this.isMockMode) {
        console.log('📝 [Mock] RevenueCat logOut called');
        return;
      }

      const Purchases = getPurchases();
      await Purchases.logOut();
    } catch (error) {
      console.error('❌ [RevenueCat] Failed to log out:', error);
      throw error;
    }
  }

  // Development helpers for testing
  setDevelopmentOverride(isPremium: boolean | null): void {
    this.developmentOverride = isPremium;
    // Also update mock state for consistency
    if (isPremium !== null) {
      mockIsPremium = isPremium;
    }
    console.log(`🔧 [RevenueCat] Development override set to: ${isPremium}`);
  }

  reset(): void {
    this.developmentOverride = null;
    console.log('🔧 [RevenueCat] Development override reset');
  }

  async cancelSubscription(): Promise<boolean> {
    try {
      console.log('📝 [RevenueCat] Cancel subscription called');

      if (this.isMockMode) {
        // In mock mode, reset premium status and return true
        mockIsPremium = false;
        return true;
      }

      // In real mode, this would typically call RevenueCat's API
      // For now, just return true as a placeholder
      return true;
    } catch (error) {
      console.error('❌ [RevenueCat] Failed to cancel subscription:', error);
      return false;
    }
  }

  clearDevelopmentOverride(): void {
    this.developmentOverride = null;
    console.log('🔧 [RevenueCat] Development override cleared');
  }

  // Mock helper methods
  private getMockCustomerInfo(isPremium: boolean = false): CustomerInfo {
    return createMockCustomerInfo(isPremium) as CustomerInfo;
  }

  private getMockOfferings(): PurchasesOfferings {
    return createMockOfferings() as PurchasesOfferings;
  }
}

// Export singleton instance
export const revenuecat = new RevenueCatService();

// Re-export types for convenience
export type { CustomerInfo, PurchasesOfferings, PurchasesPackage };
