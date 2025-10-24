import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';

import { useColorScheme } from '@/hooks/useColorScheme';
import { initializeDatabase } from '@/lib/chatStorage';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    // 'Geist-Regular': require('../assets/fonts/geist/Geist-Regular.otf'),
    // 'Geist-Medium': require('../assets/fonts/geist/Geist-Medium.otf'),
    // 'Geist-SemiBold': require('../assets/fonts/geist/Geist-SemiBold.otf'),
    // 'Geist-Bold': require('../assets/fonts/geist/Geist-Bold.otf'),
    // 'GeistMono-Regular': require('../assets/fonts/geist/GeistMono-Regular.otf'),
    // 'GeistMono-Medium': require('../assets/fonts/geist/GeistMono-Medium.otf'),
  });
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  // Initialize database on app start
  useEffect(() => {
    const initDb = async () => {
      try {
        await initializeDatabase();
        setDbReady(true);
      } catch (error) {
        console.error('App-level database initialization failed:', error);
        setDbError(
          error instanceof Error
            ? error.message
            : 'Database initialization failed',
        );
      }
    };
    initDb();
  }, []);

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  // Show loading screen while database initializes
  if (!dbReady) {
    return (
      <View className='flex-1 items-center justify-center bg-white'>
        <Text className='text-lg text-gray-600'>
          {dbError ? `Database Error: ${dbError}` : 'Initializing...'}
        </Text>
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
    </ThemeProvider>
  );
}
