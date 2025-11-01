import { Platform } from 'react-native';
import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PurchasesOffering,
  PurchasesPackage,
  PurchasesStoreProduct,
} from 'react-native-purchases';

/**
 * RevenueCat service for managing subscriptions and purchases
 * Follows official RevenueCat Expo documentation:
 * https://www.revenuecat.com/docs/getting-started/installation/expo
 */

/**
 * Get RevenueCat API keys based on environment
 * - Development: Uses test keys by default
 * - Production: Uses production keys by default
 * - Can be overridden with EXPO_PUBLIC_REVENUECAT_USE_TEST_KEYS flag
 */
const getRevenueCatKeys = () => {
  const isProduction = !__DEV__;
  const forceTestKeys =
    process.env.EXPO_PUBLIC_REVENUECAT_USE_TEST_KEYS === 'true';
  const forceProdKeys =
    process.env.EXPO_PUBLIC_REVENUECAT_USE_PROD_KEYS === 'true';

  // Determine which environment keys to use
  // Default: test keys in dev, prod keys in production
  // Can be overridden with flags
  let useTestEnvironment = !isProduction;

  if (forceTestKeys) {
    useTestEnvironment = true;
  } else if (forceProdKeys) {
    useTestEnvironment = false;
  }

  if (useTestEnvironment) {
    // Use test/sandbox keys for development and testing
    // IMPORTANT: Use regular TEST/SANDBOX API key, NOT "Test Store" API key
    // "Test Store" API key forces web billing and doesn't use StoreKit
    // Regular test key can use StoreKit when properly configured
    return {
      apple: process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY || '',
      google: process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY || '',
      isTest: true,
    };
  } else {
    // Use production keys
    return {
      apple: process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY || '',
      google: process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY || '',
      isTest: false,
    };
  }
};

const revenueCatKeys = getRevenueCatKeys();

/**
 * Initialize RevenueCat SDK
 * Call this once at app startup in your root component
 */
export async function initializeRevenueCat(): Promise<boolean> {
  try {
    // Enable verbose logging for debugging - can be controlled via env var
    // Set EXPO_PUBLIC_REVENUECAT_ENABLE_DEBUG=true to enable verbose logs in production
    const enableDebugLogs =
      __DEV__ || process.env.EXPO_PUBLIC_REVENUECAT_ENABLE_DEBUG === 'true';
    Purchases.setLogLevel(
      enableDebugLogs ? LOG_LEVEL.VERBOSE : LOG_LEVEL.ERROR,
    );

    // Configure RevenueCat based on platform
    if (Platform.OS === 'ios') {
      if (!revenueCatKeys.apple) {
        const envVarName = revenueCatKeys.isTest
          ? 'EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY'
          : 'EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY';
        const errorMsg = `RevenueCat Apple API key not found. Set ${envVarName} (using ${revenueCatKeys.isTest ? 'test' : 'production'} environment)`;
        console.error(`❌ [RevenueCat] ${errorMsg}`);
        console.error(
          `❌ [RevenueCat] Environment: ${revenueCatKeys.isTest ? 'TEST' : 'PRODUCTION'}`,
        );
        return false;
      }

      // Log API key info for debugging (masked)
      const maskedKey = revenueCatKeys.apple
        ? `${revenueCatKeys.apple.substring(0, 8)}...${revenueCatKeys.apple.substring(revenueCatKeys.apple.length - 4)}`
        : 'NOT SET';
      console.log(
        `🔑 [RevenueCat] Initializing iOS with ${revenueCatKeys.isTest ? 'TEST' : 'PRODUCTION'} key: ${maskedKey}`,
      );

      Purchases.configure({ apiKey: revenueCatKeys.apple });
      console.log('✅ [RevenueCat] iOS SDK configured successfully');
    } else if (Platform.OS === 'android') {
      if (!revenueCatKeys.google) {
        const envVarName = revenueCatKeys.isTest
          ? 'EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY'
          : 'EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY';
        const errorMsg = `RevenueCat Google API key not found. Set ${envVarName} (using ${revenueCatKeys.isTest ? 'test' : 'production'} environment)`;
        console.error(`❌ [RevenueCat] ${errorMsg}`);
        console.error(
          `❌ [RevenueCat] Environment: ${revenueCatKeys.isTest ? 'TEST' : 'PRODUCTION'}`,
        );
        return false;
      }

      // Log API key info for debugging (masked)
      const maskedKey = revenueCatKeys.google
        ? `${revenueCatKeys.google.substring(0, 8)}...${revenueCatKeys.google.substring(revenueCatKeys.google.length - 4)}`
        : 'NOT SET';
      console.log(
        `🔑 [RevenueCat] Initializing Android with ${revenueCatKeys.isTest ? 'TEST' : 'PRODUCTION'} key: ${maskedKey}`,
      );

      Purchases.configure({ apiKey: revenueCatKeys.google });
      console.log('✅ [RevenueCat] Android SDK configured successfully');
    }
    return true;
  } catch (error) {
    console.error('❌ [RevenueCat] Error initializing RevenueCat:', error);
    throw error;
  }
}

/**
 * Identify a user to RevenueCat
 * Use this when a user logs in or signs up
 * @param userId - Your app's user ID
 */
export async function identifyUser(userId: string): Promise<void> {
  try {
    await Purchases.logIn(userId);
  } catch (error) {
    console.error('Error identifying user:', error);
    throw error;
  }
}

/**
 * Reset user identification
 * Use this when a user logs out
 */
export async function resetUser(): Promise<void> {
  try {
    // If current user is anonymous, logOut will throw.
    // In dev, create a fresh random test user instead to simulate "new anonymous".
    const currentInfo = await Purchases.getCustomerInfo();
    const currentId = currentInfo.originalAppUserId || '';
    const isAnonymous = currentId.startsWith('$RCAnonymousID:');

    if (isAnonymous) {
      if (__DEV__) {
        const newId = `dev-${generateRandomId()}`;
        await Purchases.logIn(newId);
        return;
      }
      // In production, there's no supported way to rotate anonymous ID programmatically.
      // Fall through to attempt logOut (will error) so caller can handle.
    }

    await Purchases.logOut();
  } catch (error) {
    console.error('Error resetting user:', error);
    throw error;
  }
}

function generateRandomId(): string {
  // Simple RFC4122-ish v4 generator sufficient for test IDs
  // Avoid external deps for a dev utility
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get current customer info
 * This contains subscription status and entitlements
 */
export async function getCustomerInfo(): Promise<CustomerInfo> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch (error) {
    console.error('Error fetching customer info:', error);
    throw error;
  }
}

/**
 * Check if user has active entitlement
 * @param entitlementIdentifier - The entitlement identifier from RevenueCat dashboard
 */
export async function hasActiveEntitlement(
  entitlementIdentifier: string,
): Promise<boolean> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return (
      typeof customerInfo.entitlements.active[entitlementIdentifier] !==
      'undefined'
    );
  } catch (error) {
    console.error('Error checking entitlement:', error);
    return false;
  }
}

/**
 * Get available offerings (products available for purchase)
 */
export async function getOfferings(): Promise<PurchasesOffering | null> {
  try {
    console.log('🔍 [RevenueCat] Fetching offerings...');
    const offerings = await Purchases.getOfferings();

    if (offerings.current) {
      console.log('✅ [RevenueCat] Offerings fetched successfully');
      console.log(
        `📦 [RevenueCat] Current offering: ${offerings.current.identifier}`,
      );
      console.log(
        `📦 [RevenueCat] Available packages: ${offerings.current.availablePackages.length}`,
      );
      if (offerings.current.availablePackages.length === 0) {
        console.warn(
          '⚠️ [RevenueCat] WARNING: Current offering has no available packages!',
        );
        console.warn(
          '⚠️ [RevenueCat] Check RevenueCat dashboard - offerings may not be configured or products may not be attached',
        );
      }
      // Log all available offerings for debugging
      if (Object.keys(offerings.all).length > 0) {
        console.log(
          `📋 [RevenueCat] All offerings: ${Object.keys(offerings.all).join(', ')}`,
        );
      }
    } else {
      console.error('❌ [RevenueCat] No current offering found!');
      console.error('❌ [RevenueCat] Possible causes:');
      console.error(
        '   1. No offering is set as "current" in RevenueCat dashboard',
      );
      console.error('   2. No products are attached to the offering');
      console.error('   3. Products are not approved in App Store Connect');
      console.error('   4. Wrong API key is being used');
      if (Object.keys(offerings.all).length > 0) {
        console.error(
          `   Available offerings (not set as current): ${Object.keys(offerings.all).join(', ')}`,
        );
      }
    }

    return offerings.current;
  } catch (error) {
    console.error('❌ [RevenueCat] Error fetching offerings:', error);
    if (error instanceof Error) {
      console.error(`❌ [RevenueCat] Error message: ${error.message}`);
      console.error(`❌ [RevenueCat] Error stack: ${error.stack}`);
    }
    return null;
  }
}

/**
 * Purchase a package
 * @param packageToPurchase - The package to purchase
 */
export async function purchasePackage(
  packageToPurchase: PurchasesPackage,
): Promise<CustomerInfo> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
    return customerInfo;
  } catch (error) {
    console.error('Error purchasing package:', error);
    throw error;
  }
}

/**
 * Restore purchases
 * Use this to restore purchases on a new device
 */
export async function restorePurchases(): Promise<CustomerInfo> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo;
  } catch (error) {
    console.error('Error restoring purchases:', error);
    throw error;
  }
}

/**
 * Get store products
 * Useful for displaying product information
 */
export async function getProducts(
  productIdentifiers: string[],
): Promise<PurchasesStoreProduct[]> {
  try {
    const products = await Purchases.getProducts(productIdentifiers);
    return products;
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
}

/**
 * Check if user is premium/subscribed
 * This is a convenience function that checks for a common entitlement
 * Adjust the entitlement identifier based on your RevenueCat setup
 */
export async function isPremium(
  entitlementIdentifier: string = 'premium',
): Promise<boolean> {
  return hasActiveEntitlement(entitlementIdentifier);
}
