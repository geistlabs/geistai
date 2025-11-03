import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, TouchableOpacity, View } from 'react-native';

import { useColorScheme } from '@/hooks/useColorScheme';
import { queryClient } from '@/lib/queryClient';

import { useAppInitialization } from '../hooks/useAppInitialization';

function AppContent() {
  const colorScheme = useColorScheme();

  // Initialize app services using TanStack Query
  const {
    isDbLoading,
    isRevenueCatLoading,
    dbError,
    revenueCatError,
    hasCriticalError,
    retryDb,
    retryRevenueCat,
  } = useAppInitialization();

  // // Paywall management
  // const { isPaywallVisible, hidePaywall, isPremium, handlePurchaseSuccess } =
  //   usePaywall({
  //     showOnStartup: true,
  //     entitlementIdentifier: 'premium',
  //   });

  // Show loading screen while services initialize
  if (isDbLoading || isRevenueCatLoading) {
    return null;
  }

  // Show error screen if critical services failed
  if (hasCriticalError) {
    return (
      <View className='flex-1 items-center justify-center bg-white p-4'>
        <Text className='text-lg text-red-600 mb-2'>Initialization Error</Text>
        <Text className='text-sm text-gray-600 mb-4 text-center'>
          {dbError?.message ||
            revenueCatError?.message ||
            'Failed to initialize services'}
        </Text>
        <TouchableOpacity
          onPress={() => {
            if (dbError) retryDb();
            if (revenueCatError) retryRevenueCat();
          }}
          className='bg-blue-500 px-4 py-2 rounded'
        >
          <Text className='text-white'>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name='index' options={{ headerShown: false }} />
        <Stack.Screen name='storage' options={{ headerShown: false }} />
        <Stack.Screen name='memory' options={{ headerShown: false }} />
        <Stack.Screen name='+not-found' />
      </Stack>
      <StatusBar style='auto' />

      {/* Paywall Modal */}
      {/* <PaywallModal
        visible={isPaywallVisible}
        onClose={hidePaywall}
        onPurchaseSuccess={handlePurchaseSuccess}
      /> */}
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    // 'Geist-Regular': require('../assets/fonts/geist/Geist-Regular.otf'),
    // 'Geist-Medium': require('../assets/fonts/geist/Geist-Medium.otf'),
    // 'Geist-SemiBold': require('../assets/fonts/geist/Geist-SemiBold.otf'),
    // 'Geist-Bold': require('../assets/fonts/geist/Geist-Bold.otf'),
    // 'GeistMono-Regular': require('../assets/fonts/geist/GeistMono-Regular.otf'),
    // 'GeistMono-Medium': require('../assets/fonts/geist/GeistMono-Medium.otf'),
  });

  if (!loaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
