import {
	DarkTheme,
	DefaultTheme,
	ThemeProvider,
} from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { DebugMenu } from '@/components/DebugMenu';
import { PremiumGate } from '@/components/PremiumGate';
import { useColorScheme } from '@/hooks/useColorScheme';
import { initializeDatabase } from '@/lib/chatStorage';
import { revenuecat } from '@/lib/revenuecat';

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

	// Initialize database and RevenueCat on app start
	useEffect(() => {
		const initApp = async () => {
			try {
				// Initialize database
				await initializeDatabase();
				setDbReady(true);

				// Initialize RevenueCat
				await revenuecat.initialize();
			} catch (error) {
				// eslint-disable-next-line no-console
				console.error('App-level initialization failed:', error);
				setDbError(
					error instanceof Error ? error.message : 'App initialization failed',
				);
			}
		};
		initApp();
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
			<PremiumGate>
				<Stack>
					<Stack.Screen name='index' options={{ headerShown: false }} />
					<Stack.Screen name='storage' options={{ headerShown: false }} />
					<Stack.Screen name='memory' options={{ headerShown: false }} />
					<Stack.Screen name='+not-found' />
				</Stack>
			</PremiumGate>
			<DebugMenu />
			<StatusBar style='auto' />
		</ThemeProvider>
	);
}
