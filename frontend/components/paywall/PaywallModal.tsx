import React, { useState } from 'react';
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
}

export function PaywallModal({
  visible,
  onClose,
  onPurchaseSuccess,
}: PaywallModalProps) {
  const [selectedPackage, setSelectedPackage] =
    useState<PurchasesPackage | null>(null);

  const { offerings, isLoading, isPurchasing, error, purchase, restore } =
    useRevenueCat('premium');

  const handlePurchase = async (packageToPurchase: PurchasesPackage) => {
    try {
      setSelectedPackage(packageToPurchase);
      await purchase(packageToPurchase);
      Alert.alert('Success', 'Welcome to Premium! 🎉', [
        { text: 'Continue', onPress: onPurchaseSuccess },
      ]);
    } catch (err) {
      Alert.alert('Purchase Failed', `Error: ${err}`);
    } finally {
      setSelectedPackage(null);
    }
  };

  const handleRestore = async () => {
    try {
      await restore();
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

  const getSavingsText = (packageType: string) => {
    if (packageType === 'ANNUAL') {
      return 'Save 50%';
    }
    return null;
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
          {/* Hero Section */}
          <View className='p-6 items-center'>
            <Text className='text-3xl font-bold text-gray-900 mb-2'>
              Unlock Premium Features
            </Text>
            <Text className='text-gray-600 text-center text-base leading-6'>
              Get unlimited access to all features and enhance your AI
              experience
            </Text>
          </View>

          {/* Features List */}
          <View className='px-6 mb-6'>
            <Text className='text-lg font-semibold text-gray-900 mb-4'>
              Premium Features
            </Text>
            {[
              'Unlimited messages per day',
              'Advanced memory search',
              'Unlimited storage',
              'Priority support',
              'Export conversations',
              'Voice features',
            ].map((feature, index) => (
              <View key={index} className='flex-row items-center mb-3'>
                <View className='w-5 h-5 bg-green-500 rounded-full items-center justify-center mr-3'>
                  <Text className='text-white text-xs font-bold'>✓</Text>
                </View>
                <Text className='text-gray-700 flex-1'>{feature}</Text>
              </View>
            ))}
          </View>

          {/* Pricing Cards */}
          <View className='px-6 mb-6'>
            <Text className='text-lg font-semibold text-gray-900 mb-4'>
              Choose Your Plan
            </Text>

            {isLoading ? (
              <View className='items-center py-8'>
                <ActivityIndicator size='large' color='#3B82F6' />
                <Text className='text-gray-600 mt-2'>Loading plans...</Text>
              </View>
            ) : error ? (
              <View className='items-center py-8'>
                <Text className='text-red-600 text-center mb-4'>
                  Failed to load subscription plans
                </Text>
                <TouchableOpacity
                  onPress={() => window.location.reload()}
                  className='bg-blue-500 px-4 py-2 rounded'
                >
                  <Text className='text-white'>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : offerings?.availablePackages ? (
              <View className='space-y-3'>
                {offerings.availablePackages.map(pkg => {
                  const isSelected =
                    selectedPackage?.identifier === pkg.identifier;
                  const savings = getSavingsText(pkg.packageType);

                  return (
                    <TouchableOpacity
                      key={pkg.identifier}
                      onPress={() => handlePurchase(pkg)}
                      disabled={isPurchasing}
                      className={`p-4 rounded-xl border-2 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <View className='flex-row items-center justify-between'>
                        <View className='flex-1'>
                          <View className='flex-row items-center mb-1'>
                            <Text className='text-lg font-semibold text-gray-900'>
                              {pkg.product.title}
                            </Text>
                            {savings && (
                              <View className='ml-2 bg-green-500 px-2 py-1 rounded'>
                                <Text className='text-white text-xs font-bold'>
                                  {savings}
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text className='text-gray-600 text-sm'>
                            {getPackageTypeDisplay(pkg.packageType)}
                          </Text>
                        </View>
                        <View className='items-end'>
                          <Text className='text-xl font-bold text-gray-900'>
                            {pkg.product.priceString}
                          </Text>
                          {pkg.product.introPrice && (
                            <Text className='text-sm text-gray-500 line-through'>
                              {pkg.product.introPrice.priceString}
                            </Text>
                          )}
                        </View>
                      </View>

                      {isPurchasing &&
                        selectedPackage?.identifier === pkg.identifier && (
                          <View className='mt-3 items-center'>
                            <ActivityIndicator size='small' color='#3B82F6' />
                            <Text className='text-blue-600 text-sm mt-1'>
                              Processing...
                            </Text>
                          </View>
                        )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View className='items-center py-8'>
                <Text className='text-gray-600 text-center'>
                  No subscription plans available
                </Text>
              </View>
            )}
          </View>

          {/* Restore Purchases */}
          <View className='px-6 mb-6'>
            <TouchableOpacity
              onPress={handleRestore}
              disabled={isPurchasing}
              className='items-center py-3'
            >
              <Text className='text-blue-600 font-medium'>
                Restore Purchases
              </Text>
            </TouchableOpacity>
          </View>

          {/* Terms */}
          <View className='px-6 pb-8'>
            <Text className='text-xs text-gray-500 text-center leading-4'>
              By subscribing, you agree to our Terms of Service and Privacy
              Policy. Subscriptions auto-renew unless cancelled.
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
