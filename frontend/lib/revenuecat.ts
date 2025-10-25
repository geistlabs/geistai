/**
 * RevenueCat integration for GeistAI
 * Handles subscription management and premium verification
 */

// Mock RevenueCat implementation for development
// In production, you would use the actual RevenueCat SDK
class RevenueCatService {
  private isInitialized = false;
  private appUserId: string | null = null;
  private isPremium = false; // Change this to true to test premium users

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // In development, we'll use a mock implementation
      // In production, you would initialize the actual RevenueCat SDK here
      console.log('🔧 [RevenueCat] Initializing (mock mode)');

      // Generate a mock user ID for development
      this.appUserId = `dev_user_${Date.now()}`;
      this.isPremium = false; // Start as non-premium for testing negotiation chat

      this.isInitialized = true;
      console.log('✅ [RevenueCat] Initialized successfully');
    } catch (error) {
      console.error('❌ [RevenueCat] Initialization failed:', error);
      throw error;
    }
  }

  async getAppUserId(): Promise<string> {
    if (!this.appUserId) {
      this.appUserId = `dev_user_${Date.now()}`;
    }
    return this.appUserId;
  }

  async isPremiumUser(): Promise<boolean> {
    // Mock implementation - in production this would check actual subscription status
    return this.isPremium;
  }

  // Development helper methods for testing
  setPremiumStatus(isPremium: boolean): void {
    this.isPremium = isPremium;
    console.log(`🔧 [RevenueCat] Premium status set to: ${isPremium}`);
  }

  togglePremiumStatus(): boolean {
    this.isPremium = !this.isPremium;
    console.log(`🔧 [RevenueCat] Premium status toggled to: ${this.isPremium}`);
    return this.isPremium;
  }

  async getOfferings(): Promise<any> {
    // Mock offerings for development
    return {
      current: {
        identifier: 'default',
        serverDescription: 'Default offering',
        availablePackages: [
          {
            identifier: 'monthly',
            packageType: 'MONTHLY',
            product: {
              identifier: 'geistai_monthly',
              description: 'GeistAI Monthly Subscription',
              title: 'GeistAI Pro Monthly',
              price: 9.99,
              priceString: '$9.99',
              currencyCode: 'USD',
            },
          },
          {
            identifier: 'yearly',
            packageType: 'ANNUAL',
            product: {
              identifier: 'geistai_yearly',
              description: 'GeistAI Yearly Subscription',
              title: 'GeistAI Pro Yearly',
              price: 99.99,
              priceString: '$99.99',
              currencyCode: 'USD',
            },
          },
        ],
      },
    };
  }

  async purchasePackage(packageToPurchase: any): Promise<any> {
    // Mock purchase - in production this would handle actual purchase
    console.log('🛒 [RevenueCat] Mock purchase:', packageToPurchase.identifier);

    // Simulate successful purchase
    this.isPremium = true;

    return {
      customerInfo: {
        activeSubscriptions: ['geistai_monthly'],
        allPurchaseDates: {
          geistai_monthly: new Date().toISOString(),
        },
      },
    };
  }

  async restorePurchases(): Promise<any> {
    // Mock restore - in production this would restore actual purchases
    console.log('🔄 [RevenueCat] Mock restore purchases');

    // For development, we'll simulate some purchases being restored
    this.isPremium = true;

    return {
      customerInfo: {
        activeSubscriptions: ['geistai_monthly'],
        allPurchaseDates: {
          geistai_monthly: new Date().toISOString(),
        },
      },
    };
  }

  async getCustomerInfo(): Promise<any> {
    return {
      activeSubscriptions: this.isPremium ? ['geistai_monthly'] : [],
      allPurchaseDates: this.isPremium
        ? {
            geistai_monthly: new Date().toISOString(),
          }
        : {},
      entitlements: {
        premium: {
          isActive: this.isPremium,
          willRenew: this.isPremium,
          periodType: 'NORMAL',
          latestPurchaseDate: this.isPremium ? new Date().toISOString() : null,
          originalPurchaseDate: this.isPremium
            ? new Date().toISOString()
            : null,
          expirationDate: this.isPremium
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            : null,
        },
      },
    };
  }

  // Development helper methods
  setPremiumStatus(isPremium: boolean): void {
    this.isPremium = isPremium;
    console.log(`🔧 [RevenueCat] Premium status set to: ${isPremium}`);
  }

  reset(): void {
    this.isPremium = false;
    this.appUserId = null;
    this.isInitialized = false;
    console.log('🔄 [RevenueCat] Reset to initial state');
  }
}

// Export singleton instance
export const revenuecat = new RevenueCatService();

// Export types for TypeScript
export interface CustomerInfo {
  activeSubscriptions: string[];
  allPurchaseDates: Record<string, string>;
  entitlements: {
    premium: {
      isActive: boolean;
      willRenew: boolean;
      periodType: string;
      latestPurchaseDate: string | null;
      originalPurchaseDate: string | null;
      expirationDate: string | null;
    };
  };
}

export interface Offering {
  identifier: string;
  serverDescription: string;
  availablePackages: Package[];
}

export interface Package {
  identifier: string;
  packageType: string;
  product: {
    identifier: string;
    description: string;
    title: string;
    price: number;
    priceString: string;
    currencyCode: string;
  };
}
