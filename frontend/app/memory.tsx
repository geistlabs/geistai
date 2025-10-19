import { router } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import {
	Alert,
	FlatList,
	KeyboardAvoidingView,
	Platform,
	Text,
	TextInput,
	TouchableOpacity,
	View,
	ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BackIcon from '../components/BackIcon';
import { useMemoryManager } from '../hooks/useMemoryManager';
import { Memory } from '../lib/memoryService';
import { MemoryStats, memoryStorage } from '../lib/memoryStorage';
import '../global.css';

export default function MemoryScreen() {
	const [memories, setMemories] = useState<Memory[]>([]);
	const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null);
	const [searchText, setSearchText] = useState('');
	const [isLoading, setIsLoading] = useState(true);
	const [isSearching, setIsSearching] = useState(false);

	// Memory manager hook
	const memoryManager = useMemoryManager();

	const loadMemories = useCallback(async () => {
		console.log('[Memory] 🧠 Loading memories...');
		console.log(
			'[Memory] 🧠 Memory manager initialized:',
			memoryManager.isInitialized,
		);

		if (!memoryManager.isInitialized) {
			console.log(
				'[Memory] 🧠 ❌ Memory manager not initialized, skipping load',
			);
			return;
		}

		try {
			setIsLoading(true);
			console.log('[Memory] 🧠 Fetching memories from database...');
			const [allMemories, stats] = await Promise.all([
				memoryStorage.getAllMemories(), // Get all memories
				memoryManager.getMemoryStats(),
			]);
			console.log('[Memory] 🧠 Loaded memories count:', allMemories.length);
			console.log('[Memory] 🧠 Memory stats:', stats);
			setMemories(allMemories);
			setMemoryStats(stats);
		} catch (error) {
			console.error('[Memory] 🧠 ❌ Failed to load memories:', error);
			Alert.alert('Error', 'Failed to load memories');
		} finally {
			setIsLoading(false);
		}
	}, [memoryManager.isInitialized]);

	// Load memories on component mount and when memory manager is initialized
	useEffect(() => {
		loadMemories();
	}, [loadMemories]);

	const handleSearch = async () => {
		if (!searchText.trim()) {
			Alert.alert('Error', 'Please enter search text');
			return;
		}

		try {
			setIsSearching(true);
			const results = await memoryManager.searchMemories(searchText, 0.3);
			setMemories(results.map(r => r.memory));
		} catch (error) {
			console.error('Search failed:', error);
			Alert.alert('Error', 'Failed to search memories');
		} finally {
			setIsSearching(false);
		}
	};

	const handleShowAll = () => {
		setSearchText('');
		loadMemories();
	};

	const handleClearAllMemories = () => {
		Alert.alert(
			'Clear All Memories',
			'Are you sure you want to delete all memories? This action cannot be undone.',
			[
				{ text: 'Cancel', style: 'cancel' },
				{
					text: 'Delete All',
					style: 'destructive',
					onPress: async () => {
						try {
							await memoryManager.clearAllMemories();
							await loadMemories();
						} catch (error) {
							Alert.alert('Error', 'Failed to clear memories');
						}
					},
				},
			],
		);
	};

	const handleBack = () => {
		router.back();
	};

	const renderMemoryItem = ({ item }: { item: Memory }) => (
		<View className='mb-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm'>
			<View className='flex-row items-start justify-between'>
				<View className='flex-1 mr-3'>
					<View className='mb-2 flex-row items-center justify-between'>
						<View className='flex-row items-center'>
							<View
								className={`px-2 py-1 rounded-full mr-2 ${item.category === 'personal'
									? 'bg-blue-100'
									: item.category === 'technical'
										? 'bg-green-100'
										: item.category === 'preference'
											? 'bg-purple-100'
											: item.category === 'context'
												? 'bg-orange-100'
												: 'bg-gray-100'
									}`}
							>
								<Text
									className={`text-xs font-medium ${item.category === 'personal'
										? 'text-blue-800'
										: item.category === 'technical'
											? 'text-green-800'
											: item.category === 'preference'
												? 'text-purple-800'
												: item.category === 'context'
													? 'text-orange-800'
													: 'text-gray-800'
										}`}
								>
									{item.category.toUpperCase()}
								</Text>
							</View>
							<Text className='text-sm font-medium text-gray-900'>
								Chat {item.chatId}
							</Text>
						</View>
						<Text className='text-xs text-gray-500'>
							{new Date(item.extractedAt).toLocaleDateString()}
						</Text>
					</View>

					<Text className='mb-1 text-sm font-medium text-gray-900'>
						Memory:
					</Text>
					<Text className='text-base text-gray-700 leading-5 mb-2'>
						{item.content}
					</Text>

					<Text className='mb-1 text-sm font-medium text-gray-900'>
						Context:
					</Text>
					<Text className='text-sm text-gray-600 leading-4'>
						{item.originalContext}
					</Text>

					<View className='mt-2 flex-row items-center justify-between'>
						<Text className='text-xs text-gray-500'>
							Relevance: {(item.relevanceScore * 100).toFixed(0)}%
						</Text>
						<Text className='text-xs text-gray-500'>
							Messages: {item.messageIds.length}
						</Text>
					</View>
				</View>
				<TouchableOpacity
					onPress={() => {
						Alert.alert(
							'Delete Memory',
							'Are you sure you want to delete this memory?',
							[
								{ text: 'Cancel', style: 'cancel' },
								{
									text: 'Delete',
									style: 'destructive',
									onPress: async () => {
										try {
											await memoryManager.deleteMemory(item.id);
											await loadMemories();
										} catch (error) {
											Alert.alert('Error', 'Failed to delete memory');
										}
									},
								},
							],
						);
					}}
					className='rounded-lg bg-red-50 px-3 py-2'
				>
					<Text className='text-sm font-medium text-red-600'>Delete</Text>
				</TouchableOpacity>
			</View>
		</View>
	);

	return (
		<SafeAreaView className='flex-1 bg-gray-50'>
			<KeyboardAvoidingView
				className='flex-1'
				behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
			>
				{/* Header */}
				<View className='border-b border-gray-200 bg-white'>
					<View className='flex-row items-center px-4 py-3'>
						<TouchableOpacity onPress={handleBack} className='-ml-2 mr-2 p-2'>
							<BackIcon size={20} color='#374151' />
						</TouchableOpacity>
						<Text className='text-lg font-medium text-black'>
							Memory
						</Text>
					</View>
				</View>

				{/* Memory Stats */}
				<View className='bg-white p-4 shadow-sm'>
					<Text className='mb-3 text-lg font-medium text-gray-900'>
						Memory Statistics
					</Text>
					{memoryStats && (
						<View className='space-y-2'>
							<Text className='text-sm text-gray-600'>
								Total Memories:{' '}
								<Text className='font-medium'>
									{memoryStats.totalMemories}
								</Text>
							</Text>
							<View className='flex-row flex-wrap'>
								{Object.entries(memoryStats.memoriesByCategory).map(
									([category, count]) => (
										<View key={category} className='mr-3 mb-2'>
											<Text className='text-xs text-gray-500'>
												{category}:{' '}
												<Text className='font-medium'>{count}</Text>
											</Text>
										</View>
									),
								)}
							</View>
						</View>
					)}
				</View>

				{/* Search Form */}
				<View className='bg-white p-4 shadow-sm'>
					<View className='space-y-3'>
						<View>
							<Text className='mb-1 text-sm font-medium text-gray-700'>
								Search Memories
							</Text>
							<TextInput
								value={searchText}
								onChangeText={setSearchText}
								placeholder='Search for memories by content...'
								className='rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900'
								editable={!isSearching}
							/>
						</View>
						<View className='flex-row space-x-2'>
							<TouchableOpacity
								onPress={handleSearch}
								disabled={isSearching}
								className={`flex-1 rounded-lg px-4 py-3 ${isSearching ? 'bg-gray-400' : 'bg-blue-600'
									}`}
							>
								<View className='flex-row items-center justify-center'>
									{isSearching && (
										<ActivityIndicator
											size='small'
											color='white'
											className='mr-2'
										/>
									)}
									<Text className='text-center text-base font-medium text-white'>
										{isSearching ? 'Searching...' : 'Search Memories'}
									</Text>
								</View>
							</TouchableOpacity>
							<TouchableOpacity
								onPress={handleShowAll}
								className='flex-1 rounded-lg bg-gray-600 px-4 py-3'
							>
								<Text className='text-center text-base font-medium text-white'>
									Show All
								</Text>
							</TouchableOpacity>
							<TouchableOpacity
								onPress={handleClearAllMemories}
								className='rounded-lg bg-red-600 px-4 py-3'
							>
								<Text className='text-center text-base font-medium text-white'>
									Clear All
								</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>

				{/* Memories List */}
				<View className='flex-1 p-4'>
					<View className='mb-3 flex-row items-center justify-between'>
						<Text className='text-lg font-medium text-gray-900'>
							Stored Memories ({memories.length})
						</Text>
						<TouchableOpacity
							onPress={loadMemories}
							className='rounded-lg bg-gray-100 px-3 py-2'
						>
							<Text className='text-sm font-medium text-gray-700'>
								Refresh
							</Text>
						</TouchableOpacity>
					</View>

					{isLoading ? (
						<View className='flex-1 items-center justify-center'>
							<ActivityIndicator size='large' color='#3B82F6' />
							<Text className='mt-2 text-gray-500'>Loading memories...</Text>
						</View>
					) : memories.length === 0 ? (
						<View className='flex-1 items-center justify-center'>
							<Text className='text-center text-gray-500'>
								No memories stored yet.{'\n'}Memories will be automatically extracted from your conversations.
							</Text>
						</View>
					) : (
						<FlatList
							data={memories}
							renderItem={renderMemoryItem}
							keyExtractor={item => item.id}
							showsVerticalScrollIndicator={false}
							contentContainerStyle={{ paddingBottom: 20 }}
						/>
					)}
				</View>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}
