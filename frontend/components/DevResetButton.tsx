import React from 'react';
import { Alert, Text, TouchableOpacity } from 'react-native';

import { useRevenueCat } from '@/hooks/useRevenueCat';

/**
 * Development-only reset button for RevenueCat
 * This button calls Purchases.logOut() to reset the anonymous user ID
 * Only visible in development mode (__DEV__ === true)
 */
export function DevResetButton() {
  const { reset, isResetting } = useRevenueCat();

  const handleReset = async () => {
    Alert.alert(
      'Reset RevenueCat User',
      'This will log out the current user and create a new anonymous ID. Continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await reset();
              Alert.alert(
                'Success',
                'User reset successfully! New anonymous ID created.',
              );
            } catch (error) {
              console.error('Failed to reset user:', error);
              Alert.alert(
                'Error',
                'Failed to reset user. Check console for details.',
              );
            }
          },
        },
      ],
    );
  };

  // Only show in development mode
  if (!__DEV__) {
    return null;
  }

  return (
    <TouchableOpacity
      onPress={handleReset}
      disabled={isResetting}
      className='absolute top-12 right-4 bg-red-500 px-3 py-2 rounded-lg shadow-lg z-50'
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
      }}
    >
      <Text className='text-white text-xs font-semibold'>
        {isResetting ? 'Resetting...' : 'Reset RC'}
      </Text>
    </TouchableOpacity>
  );
}
