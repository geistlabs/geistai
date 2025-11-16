import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { PurchasesPackage } from 'react-native-purchases';

import { useRevenueCat } from '@/hooks/useRevenueCat';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onPurchaseSuccess?: () => void;
  highlightedPackageId?: string;
  negotiationSummary?: string;
}

export function PaywallModal({
  visible,
  onClose,
  onPurchaseSuccess,
  highlightedPackageId,
  negotiationSummary,
}: PaywallModalProps) {
  const [selectedPackage, setSelectedPackage] =
    useState<PurchasesPackage | null>(null);

  const {
    offerings,
    isLoading,
    isPurchasing,
    error,
    purchase,
    restore,
    refresh,
    checkPremium,
  } = useRevenueCat('premium');

  // No pre-selection - let user choose directly
  // Reset selection when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedPackage(null);
    }
  }, [visible]);

  const handlePurchase = async (packageToPurchase: PurchasesPackage) => {
    try {
      setSelectedPackage(packageToPurchase);
      await purchase(packageToPurchase);

      // Explicitly refresh customer info to ensure UI updates immediately
      await refresh();

      // Double-check premium status and update cache
      await checkPremium();

      Alert.alert('Success', 'Welcome to Premium! 🎉', [
        { text: 'Continue', onPress: onPurchaseSuccess },
      ]);
    } catch (err) {
      Alert.alert('Purchase Failed', `Error: ${err}`);
      setSelectedPackage(null);
    }
  };

  const handleRestore = async () => {
    try {
      await restore();

      // Refresh customer info to ensure UI updates
      await refresh();
      await checkPremium();

      Alert.alert('Success', 'Purchases restored successfully!');
    } catch (err) {
      Alert.alert('Restore Failed', `Error: ${err}`);
    }
  };

  const getPackageTypeDisplay = (packageType: string) => {
    switch (packageType) {
      case 'MONTHLY':
        return 'Monthly';
      case 'ANNUAL':
        return 'Yearly';
      case 'WEEKLY':
        return 'Weekly';
      case 'LIFETIME':
        return 'Lifetime';
      default:
        return packageType;
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType='slide'
      presentationStyle='pageSheet'
      onRequestClose={onClose}
    >
      <View className='flex-1 bg-white'>
        {/* Header */}
        <View className='flex-row items-center justify-between p-4 border-b border-gray-200'>
          <Text className='text-lg font-semibold text-gray-900'>
            Upgrade to Premium
          </Text>
          <TouchableOpacity
            onPress={onClose}
            className='w-8 h-8 items-center justify-center rounded-full bg-gray-100'
          >
            <Text className='text-gray-600 text-lg'>×</Text>
          </TouchableOpacity>
        </View>

        <ScrollView className='flex-1' showsVerticalScrollIndicator={false}>
          {/* Hero Section - Simplified */}
          <View className='px-6 pt-6 pb-4'>
            <Text className='text-gray-600 text-center text-sm'>
              Choose your plan
            </Text>
          </View>

          {/* Pricing Cards - Direct Purchase */}
          <View className='px-6 mb-6'>
            {isLoading ? (
              <View className='items-center py-8'>
                <ActivityIndicator size='large' color='#3B82F6' />
                <Text className='text-gray-600 mt-2'>Loading plans...</Text>
              </View>
            ) : error ? (
              <View className='items-center py-8 px-4'>
                <Text className='text-red-600 text-center mb-2 font-semibold'>
                  Failed to load subscription plans
                </Text>
                <Text className='text-red-500 text-center text-sm mb-4'>
                  {typeof error === 'string' ? error : 'Unknown error occurred'}
                </Text>
                <TouchableOpacity
                  onPress={() => refresh()}
                  className='bg-blue-500 px-4 py-2 rounded mb-2'
                >
                  <Text className='text-white font-medium'>Retry</Text>
                </TouchableOpacity>
                <Text className='text-gray-500 text-xs text-center mt-4'>
                  Check console logs for detailed error information
                </Text>
              </View>
            ) : offerings?.availablePackages ? (
              <View className='space-y-3'>
                {offerings.availablePackages.map(pkg => {
                  const isPurchasingThis =
                    isPurchasing &&
                    selectedPackage?.identifier === pkg.identifier;
                  const isAnnual = pkg.packageType === 'ANNUAL';
                  const monthlyEquivalent = isAnnual
                    ? (95.99 / 12).toFixed(2)
                    : null;

                  return (
                    <View
                      key={pkg.identifier}
                      className={`mb-3 rounded-2xl border-2 overflow-hidden ${
                        isAnnual
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      {/* Annual Badge */}
                      {isAnnual && (
                        <View className='bg-green-500 px-3 py-1'>
                          <Text className='text-white text-xs font-bold text-center'>
                            BEST VALUE
                          </Text>
                        </View>
                      )}

                      <View className='p-5'>
                        <View className='flex-row items-center justify-between mb-4'>
                          <View className='flex-1'>
                            <Text className='text-lg font-bold text-gray-900 mb-0.5'>
                              {getPackageTypeDisplay(pkg.packageType)}
                            </Text>
                            {isAnnual && monthlyEquivalent && (
                              <Text className='text-gray-600 text-sm'>
                                ${monthlyEquivalent}/month
                              </Text>
                            )}
                          </View>
                          <View className='items-end'>
                            <Text className='text-2xl font-bold text-gray-900'>
                              {pkg.product.priceString}
                            </Text>
                            {isAnnual && (
                              <Text className='text-green-600 text-xs font-semibold mt-0.5'>
                                20% savings
                              </Text>
                            )}
                          </View>
                        </View>

                        {/* Purchase Button */}
                        {isPurchasingThis ? (
                          <View className='bg-gray-100 py-3 rounded-xl items-center'>
                            <ActivityIndicator size='small' color='#3B82F6' />
                            <Text className='text-gray-600 text-sm mt-1'>
                              Processing...
                            </Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            onPress={() => handlePurchase(pkg)}
                            disabled={isPurchasing}
                            className={`py-3 rounded-xl ${
                              isAnnual ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                            activeOpacity={0.8}
                          >
                            <Text className='text-white text-center font-bold text-base'>
                              Subscribe
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View className='items-center py-8 px-4'>
                <Text className='text-red-600 text-center font-semibold mb-2'>
                  No subscription plans available
                </Text>
                <Text className='text-gray-600 text-center text-sm mb-4'>
                  This could mean:{'\n'}• Products are not configured in
                  RevenueCat{'\n'}• No offering is set as &quot;current&quot; in
                  dashboard{'\n'}
                  {'\n'}• Products are not approved in App Store Connect
                </Text>
                <TouchableOpacity
                  onPress={() => refresh()}
                  className='bg-blue-500 px-4 py-2 rounded'
                >
                  <Text className='text-white font-medium'>Refresh Plans</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Features - Simplified */}
          <View className='px-6 mb-6'>
            <Text className='text-sm text-gray-600 text-center mb-3'>
              Includes: Unlimited messages • Advanced memory • Priority support
              • Voice features
            </Text>
          </View>

          {/* Restore Purchases */}
          <View className='px-6 mb-4'>
            <TouchableOpacity
              onPress={handleRestore}
              disabled={isPurchasing}
              className='items-center py-2'
            >
              <Text className='text-blue-600 text-sm font-medium'>
                Restore Purchases
              </Text>
            </TouchableOpacity>
          </View>

          {/* Terms */}
          <View className='px-6 pb-8'>
            <Text className='text-xs text-gray-500 text-center leading-4'>
              Subscriptions auto-renew unless cancelled. By subscribing, you
              agree to our Terms and Privacy Policy.
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
