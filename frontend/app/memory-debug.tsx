import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MemoryDebugger } from '../components/MemoryDebugger';
import BackIcon from '../components/BackIcon';

export default function MemoryDebugScreen() {
	return (
		<SafeAreaView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
			{/* Header */}
			<View style={{
				flexDirection: 'row',
				alignItems: 'center',
				padding: 16,
				borderBottomWidth: 1,
				borderBottomColor: '#e5e5e5',
				backgroundColor: 'white',
			}}>
				<TouchableOpacity
					onPress={() => router.back()}
					style={{ marginRight: 16 }}
				>
					<BackIcon size={24} color="#374151" />
				</TouchableOpacity>
				<Text style={{ fontSize: 18, fontWeight: '600', color: '#374151' }}>
					Memory System Debug
				</Text>
			</View>

			{/* Debug Component */}
			<MemoryDebugger />
		</SafeAreaView>
	);
}
