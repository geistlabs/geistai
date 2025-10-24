import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Purchases from 'react-native-purchases';

import { revenuecat } from '../lib/revenuecat';

export function DebugMenu() {
  const [visible, setVisible] = useState(false);
  const [premiumStatus, setPremiumStatus] = useState<boolean | null>(null);

  // Load current premium status
  const checkPremiumStatus = async () => {
    try {
      const status = await revenuecat.isPremium();
      setPremiumStatus(status);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to check premium status:', error);
    }
  };

  const handleOpenMenu = async () => {
    await checkPremiumStatus();
    setVisible(true);
  };

  const clearNegotiationCache = async () => {
    try {
      await AsyncStorage.removeItem('negotiation_skipped');
      Alert.alert(
        '✅ Cleared',
        'Negotiation cache cleared.\n\nClose and reopen app to see negotiation flow.',
      );
    } catch (error) {
      Alert.alert('❌ Error', 'Failed to clear negotiation cache');
    }
  };

  const clearRevenueCatCache = async () => {
    try {
      await Purchases.invalidateCustomerInfoCache();
      Alert.alert('✅ Cleared', 'RevenueCat cache cleared');
    } catch (error) {
      Alert.alert('❌ Error', 'Failed to clear RevenueCat cache');
    }
  };

  const logoutRevenueCat = async () => {
    try {
      await Purchases.logOut();
      Alert.alert(
        '✅ Logged Out',
        'RevenueCat user logged out.\n\nClose and reopen app to reset.',
      );
    } catch (error) {
      Alert.alert('❌ Error', 'Failed to logout from RevenueCat');
    }
  };

  const resetAll = async () => {
    try {
      // Clear negotiation cache
      await AsyncStorage.removeItem('negotiation_skipped');

      // Clear RevenueCat cache
      await Purchases.invalidateCustomerInfoCache();

      // Logout
      await Purchases.logOut();

      Alert.alert(
        '✅ Reset Complete',
        'All caches cleared and logged out.\n\nClose and reopen app to start fresh.',
      );
      setVisible(false);
    } catch (error) {
      Alert.alert('❌ Error', 'Failed to reset everything');
    }
  };

  const viewUserInfo = async () => {
    try {
      const userId = await revenuecat.getAppUserId();
      const customerInfo = await revenuecat.getCustomerInfo();
      const isPremium = await revenuecat.isPremium();

      Alert.alert(
        '📱 User Info',
        `User ID: ${userId}\n\n` +
          `Premium: ${isPremium ? '✅ Yes' : '❌ No'}\n\n` +
          `Entitlements: ${Object.keys(customerInfo?.entitlements.active || {}).join(', ') || 'None'}`,
      );
    } catch (error) {
      Alert.alert('❌ Error', 'Failed to get user info');
    }
  };

  // Cancel test subscription (simulates subscription expiry/cancellation)
  const cancelTestSubscription = async () => {
    try {
      console.log('🔄 Simulating subscription cancellation...');
      // Invalidate cache to force refresh from local Test Store
      await Purchases.invalidateCustomerInfoCache();

      // Note: In Test Store, you cannot programmatically cancel.
      // This simulates the effect by clearing cache.
      // User will need to cancel via iOS Settings for real effect.
      Alert.alert(
        '⚠️ Test Store Limitation',
        'Test Store subscriptions cannot be canceled programmatically.\n\n' +
          'To actually cancel, go to:\n' +
          'iOS Settings → [Your Apple ID] → Subscriptions → GeistAI → Cancel\n\n' +
          'Cache cleared. After canceling in Settings, reopen the app to see the change.',
      );
      await checkPremiumStatus();
    } catch (error) {
      Alert.alert('❌ Error', 'Failed to cancel test subscription');
    }
  };

  // Only show in development
  if (!__DEV__) return null;

  return (
    <>
      {/* Floating Debug Button */}
      <TouchableOpacity
        onPress={handleOpenMenu}
        style={styles.floatingButton}
        activeOpacity={0.7}
      >
        <Text style={styles.floatingButtonText}>🛠️</Text>
      </TouchableOpacity>

      {/* Debug Menu Modal */}
      <Modal
        visible={visible}
        transparent
        animationType='slide'
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>🛠️ Debug Menu</Text>
              {premiumStatus !== null && (
                <Text
                  style={[
                    styles.statusBadge,
                    premiumStatus ? styles.premiumBadge : styles.freeBadge,
                  ]}
                >
                  {premiumStatus ? '✅ Premium' : '❌ Free'}
                </Text>
              )}
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Main Reset Button */}
            <TouchableOpacity
              onPress={resetAll}
              style={[styles.button, styles.primaryButton]}
            >
              <Text style={styles.buttonText}>🔄 Reset Everything</Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.sectionDivider} />

            {/* Individual Reset Buttons */}
            <Text style={styles.sectionTitle}>Individual Actions:</Text>

            <TouchableOpacity
              onPress={clearNegotiationCache}
              style={styles.button}
            >
              <Text style={styles.buttonText}>Clear Negotiation Cache</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={clearRevenueCatCache}
              style={styles.button}
            >
              <Text style={styles.buttonText}>Clear RevenueCat Cache</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={logoutRevenueCat} style={styles.button}>
              <Text style={styles.buttonText}>Logout RevenueCat</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={viewUserInfo} style={styles.button}>
              <Text style={styles.buttonText}>📱 View User Info</Text>
            </TouchableOpacity>

            {/* Cancel Test Subscription Button */}
            <TouchableOpacity
              onPress={cancelTestSubscription}
              style={[styles.button, styles.dangerButton]}
            >
              <Text style={styles.buttonText}>❌ Cancel Test Subscription</Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.sectionDivider} />

            {/* Close Button */}
            <TouchableOpacity
              onPress={() => setVisible(false)}
              style={[styles.button, styles.closeButton]}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  floatingButtonText: {
    fontSize: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '90%',
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1F2937',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    fontSize: 14,
    fontWeight: '600',
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  premiumBadge: {
    backgroundColor: '#D1FAE5',
    color: '#065F46',
  },
  freeBadge: {
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginBottom: 16,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  button: {
    backgroundColor: '#6B7280',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  primaryButton: {
    backgroundColor: '#EF4444',
  },
  dangerButton: {
    backgroundColor: '#DC2626',
  },
  closeButton: {
    backgroundColor: '#E5E7EB',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 16,
  },
  closeButtonText: {
    color: '#1F2937',
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 16,
  },
});
