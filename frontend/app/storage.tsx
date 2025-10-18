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
import {
  vectorStorage,
  embeddingService,
  VectorEmbedding,
} from '../lib/vectorStorage';
import { useMemoryManager } from '../hooks/useMemoryManager';
import { Memory, MemorySearchResult } from '../lib/memoryService';
import { MemoryStats, memoryStorage } from '../lib/memoryStorage';
import '../global.css';

interface StorageItem extends VectorEmbedding {
  similarity?: number;
}

export default function StorageScreen() {
  const [activeTab, setActiveTab] = useState<'embeddings' | 'memories'>('embeddings');
  const [storageItems, setStorageItems] = useState<StorageItem[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null);
  const [newText, setNewText] = useState('');
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isEmbedding, setIsEmbedding] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Memory manager hook
  const memoryManager = useMemoryManager();

  const loadStorageItems = useCallback(async () => {
    try {
      setIsLoading(true);
      const embeddings = await vectorStorage.getAllEmbeddings();
      setStorageItems(embeddings);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load embeddings:', error);
      Alert.alert('Error', 'Failed to load stored embeddings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMemories = useCallback(async () => {
    if (!memoryManager.isInitialized) return;

    try {
      setIsLoading(true);
      const [allMemories, stats] = await Promise.all([
        memoryStorage.getAllMemories(), // Get all memories
        memoryManager.getMemoryStats(),
      ]);
      setMemories(allMemories);
      setMemoryStats(stats);
    } catch (error) {
      console.error('Failed to load memories:', error);
      Alert.alert('Error', 'Failed to load memories');
    } finally {
      setIsLoading(false);
    }
  }, [memoryManager]);

  const initializeAndLoadItems = useCallback(async () => {
    try {
      await vectorStorage.initDatabase();
      if (activeTab === 'embeddings') {
        await loadStorageItems();
      } else {
        await loadMemories();
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to initialize database:', error);
      Alert.alert('Error', 'Failed to initialize vector storage');
    }
  }, [loadStorageItems, loadMemories, activeTab]);

  // Load all storage items on component mount
  useEffect(() => {
    initializeAndLoadItems();
  }, [initializeAndLoadItems]);

  const handleEmbedAndStore = async () => {
    if (!newText.trim()) {
      Alert.alert('Error', 'Please enter some text to embed');
      return;
    }

    try {
      setIsEmbedding(true);

      // Generate embedding for the text
      const embedding = await embeddingService.generateEmbedding(
        newText.trim(),
      );

      // Store the embedding
      await vectorStorage.storeEmbedding(newText.trim(), embedding);

      // Clear input and refresh list
      setNewText('');
      await loadStorageItems();

      Alert.alert('Success', 'Text embedded and stored successfully!');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to embed and store text:', error);
      Alert.alert('Error', 'Failed to embed and store text');
    } finally {
      setIsEmbedding(false);
    }
  };

  const handleSimilaritySearch = async () => {
    if (!searchText.trim()) {
      Alert.alert('Error', 'Please enter search text');
      return;
    }

    try {
      setIsSearching(true);

      if (activeTab === 'embeddings') {
        // Generate embedding for search query
        const queryEmbedding = await embeddingService.generateEmbedding(
          searchText.trim(),
        );

        // Search for similar embeddings
        const results = await vectorStorage.searchSimilar(queryEmbedding, 10);

        // Convert results to StorageItem format with similarity scores
        const itemsWithSimilarity: StorageItem[] = results.map(result => ({
          id: result.id,
          text: result.text,
          embedding: [], // We don't need to display the full embedding
          created_at: result.created_at,
          similarity: result.similarity,
        }));

        setStorageItems(itemsWithSimilarity);
      } else {
        // Search memories
        const results = await memoryManager.searchMemories(searchText.trim());
        setMemories(results.map(r => r.memory));
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to search:', error);
      Alert.alert('Error', `Failed to search ${activeTab}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleShowAll = async () => {
    if (activeTab === 'embeddings') {
      await loadStorageItems();
    } else {
      await loadMemories();
    }
  };

  const handleClearAllMemories = async () => {
    Alert.alert(
      'Clear All Memories',
      'Are you sure you want to delete all memories? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await memoryManager.clearAllMemories();
              await loadMemories();
              Alert.alert('Success', 'All memories cleared successfully!');
            } catch (error) {
              console.error('Failed to clear memories:', error);
              Alert.alert('Error', 'Failed to clear memories');
            }
          },
        },
      ]
    );
  };

  const handleDeleteItem = async (id: number, text: string) => {
    Alert.alert(
      'Delete Embedding',
      `Are you sure you want to delete this embedding?\n\n"${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await vectorStorage.deleteEmbedding(id);
              await loadStorageItems(); // Refresh the list
              Alert.alert('Success', 'Embedding deleted successfully');
            } catch (error) {
              // eslint-disable-next-line no-console
              console.error('Failed to delete embedding:', error);
              Alert.alert('Error', 'Failed to delete embedding');
            }
          },
        },
      ],
    );
  };

  const handleClearAll = async () => {
    Alert.alert(
      'Clear All Embeddings',
      'Are you sure you want to delete all stored embeddings? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await vectorStorage.clearAllEmbeddings();
              await loadStorageItems();
              Alert.alert('Success', 'All embeddings cleared successfully');
            } catch (error) {
              // eslint-disable-next-line no-console
              console.error('Failed to clear embeddings:', error);
              Alert.alert('Error', 'Failed to clear embeddings');
            }
          },
        },
      ],
    );
  };

  const handleBack = () => {
    router.back();
  };

  const renderStorageItem = ({ item }: { item: StorageItem }) => (
    <View className='mb-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm'>
      <View className='flex-row items-start justify-between'>
        <View className='flex-1 mr-3'>
          <View className='mb-2 flex-row items-center justify-between'>
            <Text className='text-sm font-medium text-gray-900'>
              ID: {item.id}
            </Text>
            <Text className='text-xs text-gray-500'>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>

          {item.similarity !== undefined && (
            <View className='mb-2'>
              <Text className='text-sm font-medium text-blue-600'>
                Similarity: {(item.similarity * 100).toFixed(1)}%
              </Text>
            </View>
          )}

          <Text className='mb-1 text-sm font-medium text-gray-900'>Text:</Text>
          <Text className='text-base text-gray-700 leading-5'>{item.text}</Text>

          <Text className='mt-2 text-xs text-gray-500'>
            Vector dimensions:{' '}
            {item.embedding.length > 0 ? item.embedding.length : '128'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => handleDeleteItem(item.id, item.text)}
          className='rounded-lg bg-red-50 px-3 py-2'
        >
          <Text className='text-sm font-medium text-red-600'>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderMemoryItem = ({ item }: { item: Memory }) => (
    <View className='mb-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm'>
      <View className='flex-row items-start justify-between'>
        <View className='flex-1 mr-3'>
          <View className='mb-2 flex-row items-center justify-between'>
            <View className='flex-row items-center'>
              <View className={`px-2 py-1 rounded-full mr-2 ${item.category === 'personal' ? 'bg-blue-100' :
                item.category === 'technical' ? 'bg-green-100' :
                  item.category === 'preference' ? 'bg-purple-100' :
                    item.category === 'context' ? 'bg-orange-100' : 'bg-gray-100'
                }`}>
                <Text className={`text-xs font-medium ${item.category === 'personal' ? 'text-blue-800' :
                  item.category === 'technical' ? 'text-green-800' :
                    item.category === 'preference' ? 'text-purple-800' :
                      item.category === 'context' ? 'text-orange-800' : 'text-gray-800'
                  }`}>
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

          <Text className='mb-1 text-sm font-medium text-gray-900'>Memory:</Text>
          <Text className='text-base text-gray-700 leading-5 mb-2'>{item.content}</Text>

          <Text className='mb-1 text-sm font-medium text-gray-900'>Context:</Text>
          <Text className='text-sm text-gray-600 leading-4'>{item.originalContext}</Text>

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
              ]
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
              Storage & Memory
            </Text>
          </View>

          {/* Tab Navigation */}
          <View className='flex-row border-t border-gray-200'>
            <TouchableOpacity
              onPress={() => setActiveTab('embeddings')}
              className={`flex-1 py-3 px-4 ${activeTab === 'embeddings' ? 'border-b-2 border-blue-500 bg-blue-50' : ''
                }`}
            >
              <Text className={`text-center font-medium ${activeTab === 'embeddings' ? 'text-blue-600' : 'text-gray-600'
                }`}>
                Embeddings ({storageItems.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('memories')}
              className={`flex-1 py-3 px-4 ${activeTab === 'memories' ? 'border-b-2 border-blue-500 bg-blue-50' : ''
                }`}
            >
              <Text className={`text-center font-medium ${activeTab === 'memories' ? 'text-blue-600' : 'text-gray-600'
                }`}>
                Memories ({memories.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Add New Embedding Form / Memory Stats */}
        {activeTab === 'embeddings' ? (
          <View className='bg-white p-4 shadow-sm'>
            <Text className='mb-3 text-lg font-medium text-gray-900'>
              Add New Text Embedding
            </Text>
          </View>
        ) : (
          <View className='bg-white p-4 shadow-sm'>
            <Text className='mb-3 text-lg font-medium text-gray-900'>
              Memory Statistics
            </Text>
            {memoryStats && (
              <View className='space-y-2'>
                <Text className='text-sm text-gray-600'>
                  Total Memories: <Text className='font-medium'>{memoryStats.totalMemories}</Text>
                </Text>
                <View className='flex-row flex-wrap'>
                  {Object.entries(memoryStats.memoriesByCategory).map(([category, count]) => (
                    <View key={category} className='mr-3 mb-2'>
                      <Text className='text-xs text-gray-500'>
                        {category}: <Text className='font-medium'>{count}</Text>
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {activeTab === 'embeddings' && (
          <View className='space-y-3'>
            <View>
              <Text className='mb-1 text-sm font-medium text-gray-700'>
                Text to Embed
              </Text>
              <TextInput
                value={newText}
                onChangeText={setNewText}
                placeholder='Enter text to convert to vector embedding...'
                className='rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900'
                multiline
                numberOfLines={4}
                editable={!isEmbedding}
              />
            </View>
            <TouchableOpacity
              onPress={handleEmbedAndStore}
              disabled={isEmbedding}
              className={`rounded-lg px-4 py-3 ${isEmbedding ? 'bg-gray-400' : 'bg-blue-600'
                }`}
            >
              <View className='flex-row items-center justify-center'>
                {isEmbedding && (
                  <ActivityIndicator
                    size='small'
                    color='white'
                    className='mr-2'
                  />
                )}
                <Text className='text-center text-base font-medium text-white'>
                  {isEmbedding ? 'Embedding...' : 'Embed & Store'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Search Section */}
        <View className='bg-white p-4 shadow-sm border-t border-gray-100'>
          <Text className='mb-3 text-lg font-medium text-gray-900'>
            {activeTab === 'embeddings' ? 'Search Similar Embeddings' : 'Search Memories'}
          </Text>
          <View className='space-y-3'>
            <View>
              <Text className='mb-1 text-sm font-medium text-gray-700'>
                Search Query
              </Text>
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                placeholder={activeTab === 'embeddings'
                  ? 'Enter text to find similar embeddings...'
                  : 'Enter text to find relevant memories...'
                }
                className='rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900'
                multiline
                numberOfLines={2}
                editable={!isSearching}
              />
            </View>
            <View className='flex-row space-x-3'>
              <TouchableOpacity
                onPress={handleSimilaritySearch}
                disabled={isSearching}
                className={`flex-1 rounded-lg px-4 py-3 ${isSearching ? 'bg-gray-400' : 'bg-green-600'
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
                    {isSearching ? 'Searching...' : `Search ${activeTab === 'embeddings' ? 'Similar' : 'Memories'}`}
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
              {activeTab === 'memories' && (
                <TouchableOpacity
                  onPress={handleClearAllMemories}
                  className='rounded-lg bg-red-600 px-4 py-3'
                >
                  <Text className='text-center text-base font-medium text-white'>
                    Clear All
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Storage Items List */}
        <View className='flex-1 p-4'>
          <View className='mb-3 flex-row items-center justify-between'>
            <Text className='text-lg font-medium text-gray-900'>
              {activeTab === 'embeddings'
                ? `Stored Embeddings (${storageItems.length})`
                : `Stored Memories (${memories.length})`
              }
            </Text>
            <View className='flex-row space-x-2'>
              <TouchableOpacity
                onPress={activeTab === 'embeddings' ? loadStorageItems : loadMemories}
                className='rounded-lg bg-gray-100 px-3 py-2'
              >
                <Text className='text-sm font-medium text-gray-700'>
                  Refresh
                </Text>
              </TouchableOpacity>
              {((activeTab === 'embeddings' && storageItems.length > 0) ||
                (activeTab === 'memories' && memories.length > 0)) && (
                  <TouchableOpacity
                    onPress={activeTab === 'embeddings' ? handleClearAll : handleClearAllMemories}
                    className='rounded-lg bg-red-100 px-3 py-2'
                  >
                    <Text className='text-sm font-medium text-red-600'>
                      Clear All
                    </Text>
                  </TouchableOpacity>
                )}
            </View>
          </View>

          {isLoading ? (
            <View className='flex-1 items-center justify-center'>
              <ActivityIndicator size='large' color='#3B82F6' />
              <Text className='mt-2 text-gray-500'>
                Loading {activeTab}...
              </Text>
            </View>
          ) : (activeTab === 'embeddings' ? storageItems.length === 0 : memories.length === 0) ? (
            <View className='flex-1 items-center justify-center'>
              <Text className='text-center text-gray-500'>
                {activeTab === 'embeddings'
                  ? 'No embeddings stored yet.\nAdd your first text embedding above.'
                  : 'No memories stored yet.\nMemories will be automatically extracted from your conversations.'
                }
              </Text>
            </View>
          ) : (
            <FlatList
              data={activeTab === 'embeddings' ? storageItems : memories}
              renderItem={activeTab === 'embeddings' ? renderStorageItem : renderMemoryItem}
              keyExtractor={item => activeTab === 'embeddings' ? item.id.toString() : item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
