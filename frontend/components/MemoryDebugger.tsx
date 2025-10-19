import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';

import { useMemoryManager } from '../hooks/useMemoryManager';
import { memoryService } from '../lib/memoryService';

export function MemoryDebugger() {
	const [isLoading, setIsLoading] = useState(false);
	const [logs, setLogs] = useState<string[]>([]);
	const memoryManager = useMemoryManager();

	const addLog = (message: string) => {
		setLogs(prev => [
			...prev,
			`${new Date().toLocaleTimeString()}: ${message}`,
		]);
	};

	const testMemoryExtraction = async () => {
		setIsLoading(true);
		setLogs([]);
		addLog('Starting memory extraction test...');

		try {
			// Override console.log temporarily to capture logs
			const originalLog = console.log;
			console.log = (...args) => {
				const message = args
					.map(arg =>
						typeof arg === 'object'
							? JSON.stringify(arg, null, 2)
							: String(arg),
					)
					.join(' ');
				addLog(message);
				originalLog(...args);
			};

			await memoryService.debugMemoryExtraction();

			// Restore console.log
			console.log = originalLog;

			addLog('Memory extraction test completed!');
		} catch (error) {
			addLog(
				`Error: ${error instanceof Error ? error.message : String(error)}`,
			);
		} finally {
			setIsLoading(false);
		}
	};

	const testMemoryExtractionFromQuestion = async () => {
		setIsLoading(true);
		setLogs([]);
		addLog('Starting memory extraction from question test...');

		try {
			// Override console.log temporarily to capture logs
			const originalLog = console.log;
			console.log = (...args) => {
				const message = args
					.map(arg =>
						typeof arg === 'object'
							? JSON.stringify(arg, null, 2)
							: String(arg),
					)
					.join(' ');
				addLog(message);
				originalLog(...args);
			};

			await memoryService.testMemoryExtractionFromQuestion();

			// Restore console.log
			console.log = originalLog;

			addLog('Memory extraction from question test completed!');
		} catch (error) {
			addLog(
				`Error: ${error instanceof Error ? error.message : String(error)}`,
			);
		} finally {
			setIsLoading(false);
		}
	};

	const testMemoryStorage = async () => {
		setIsLoading(true);
		addLog('Testing memory storage...');

		try {
			if (!memoryManager.isInitialized) {
				addLog('Memory manager not initialized');
				return;
			}

			const stats = await memoryManager.getMemoryStats();
			addLog(`Memory stats: ${JSON.stringify(stats, null, 2)}`);

			// Get all memories from storage directly
			const { memoryStorage } = await import('../lib/memoryStorage');
			const allMemories = await memoryStorage.getAllMemories();
			addLog(`Total memories: ${allMemories.length}`);

			if (allMemories.length > 0) {
				addLog(`Sample memory: ${JSON.stringify(allMemories[0], null, 2)}`);
			}
		} catch (error) {
			addLog(
				`Storage test error: ${error instanceof Error ? error.message : String(error)}`,
			);
		} finally {
			setIsLoading(false);
		}
	};

	const testApiEndpoint = async () => {
		setIsLoading(true);
		setLogs([]);
		addLog('Testing API endpoint...');

		try {
			// Override console.log temporarily to capture logs
			const originalLog = console.log;
			console.log = (...args) => {
				const message = args
					.map(arg =>
						typeof arg === 'object'
							? JSON.stringify(arg, null, 2)
							: String(arg),
					)
					.join(' ');
				addLog(message);
				originalLog(...args);
			};

			await memoryService.testApiEndpoint();

			// Restore console.log
			console.log = originalLog;

			addLog('API endpoint test completed!');
		} catch (error) {
			addLog(
				`Error: ${error instanceof Error ? error.message : String(error)}`,
			);
		} finally {
			setIsLoading(false);
		}
	};

	const clearLogs = () => {
		setLogs([]);
	};

	return (
		<View style={{ flex: 1, padding: 20, backgroundColor: '#f5f5f5' }}>
			<Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
				Memory System Debugger
			</Text>

			<View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
				<TouchableOpacity
					onPress={testApiEndpoint}
					disabled={isLoading}
					style={{
						backgroundColor: isLoading ? '#ccc' : '#FF9500',
						padding: 15,
						borderRadius: 8,
						flex: 1,
					}}
				>
					<Text
						style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}
					>
						Test API
					</Text>
				</TouchableOpacity>

				<TouchableOpacity
					onPress={testMemoryExtraction}
					disabled={isLoading}
					style={{
						backgroundColor: isLoading ? '#ccc' : '#007AFF',
						padding: 15,
						borderRadius: 8,
						flex: 1,
					}}
				>
					<Text
						style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}
					>
						Test Extraction
					</Text>
				</TouchableOpacity>
			</View>

			<View style={{ marginBottom: 10 }}>
				<TouchableOpacity
					onPress={testMemoryExtractionFromQuestion}
					disabled={isLoading}
					style={{
						backgroundColor: isLoading ? '#ccc' : '#34C759',
						padding: 15,
						borderRadius: 8,
					}}
				>
					<Text
						style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}
					>
						Test Memory Extraction from Question
					</Text>
				</TouchableOpacity>
			</View>

			<View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
				<TouchableOpacity
					onPress={testMemoryStorage}
					disabled={isLoading}
					style={{
						backgroundColor: isLoading ? '#ccc' : '#34C759',
						padding: 15,
						borderRadius: 8,
						flex: 1,
					}}
				>
					<Text
						style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}
					>
						Test Storage
					</Text>
				</TouchableOpacity>

				<TouchableOpacity
					onPress={clearLogs}
					style={{
						backgroundColor: '#FF3B30',
						padding: 15,
						borderRadius: 8,
						flex: 1,
					}}
				>
					<Text
						style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}
					>
						Clear Logs
					</Text>
				</TouchableOpacity>
			</View>

			<ScrollView
				style={{
					flex: 1,
					backgroundColor: '#000',
					padding: 15,
					borderRadius: 8,
				}}
				showsVerticalScrollIndicator={true}
			>
				{logs.map((log, index) => (
					<Text
						key={index}
						style={{
							color: '#00FF00',
							fontFamily: 'monospace',
							fontSize: 12,
							marginBottom: 5,
						}}
					>
						{log}
					</Text>
				))}
				{logs.length === 0 && (
					<Text style={{ color: '#666', fontStyle: 'italic' }}>
						No logs yet. Press a test button to start.
					</Text>
				)}
			</ScrollView>
		</View>
	);
}
