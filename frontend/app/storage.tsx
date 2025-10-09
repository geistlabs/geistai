import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import BackIcon from '../components/BackIcon';
import '../global.css';

interface StorageItem {
  key: string;
  value: string;
}

export default function StorageScreen() {
  const [storageItems, setStorageItems] = useState<StorageItem[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Load all storage items on component mount
  useEffect(() => {
    loadStorageItems();
  }, []);

  const loadStorageItems = async () => {
    try {
      setIsLoading(true);
      // Get all keys from AsyncStorage
      const keys = await getStorageKeys();
      const items: StorageItem[] = [];
      
      // Get values for each key
      for (const key of keys) {
        try {
          const value = await getStorageValue(key);
          if (value !== null) {
            items.push({ key, value });
          }
        } catch (error) {
          console.warn(`Failed to get value for key ${key}:`, error);
        }
      }
      
      setStorageItems(items);
    } catch (error) {
      console.error('Failed to load storage items:', error);
      Alert.alert('Error', 'Failed to load storage items');
    } finally {
      setIsLoading(false);
    }
  };

  const getStorageKeys = async (): Promise<string[]> => {
    try {
      // Use AsyncStorage to get all keys
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const keys = await AsyncStorage.getAllKeys();
      return keys || [];
    } catch (error) {
      console.error('Failed to get storage keys:', error);
      return [];
    }
  };

  const getStorageValue = async (key: string): Promise<string | null> => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error(`Failed to get value for key ${key}:`, error);
      return null;
    }
  };

  const setStorageValue = async (key: string, value: string): Promise<boolean> => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.error(`Failed to set value for key ${key}:`, error);
      return false;
    }
  };

  const removeStorageValue = async (key: string): Promise<boolean> => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Failed to remove key ${key}:`, error);
      return false;
    }
  };

  const handleAddItem = async () => {
    if (!newKey.trim() || !newValue.trim()) {
      Alert.alert('Error', 'Please enter both key and value');
      return;
    }

    const success = await setStorageValue(newKey.trim(), newValue.trim());
    if (success) {
      setNewKey('');
      setNewValue('');
      await loadStorageItems(); // Refresh the list
      Alert.alert('Success', 'Item added successfully');
    } else {
      Alert.alert('Error', 'Failed to add item');
    }
  };

  const handleDeleteItem = async (key: string) => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${key}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await removeStorageValue(key);
            if (success) {
              await loadStorageItems(); // Refresh the list
              Alert.alert('Success', 'Item deleted successfully');
            } else {
              Alert.alert('Error', 'Failed to delete item');
            }
          },
        },
      ]
    );
  };

  const handleBack = () => {
    router.back();
  };

  const renderStorageItem = ({ item }: { item: StorageItem }) => (
    <View className='mb-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm'>
      <View className='flex-row items-start justify-between'>
        <View className='flex-1 mr-3'>
          <Text className='mb-1 text-sm font-medium text-gray-900'>Key:</Text>
          <Text className='mb-3 text-base text-gray-700'>{item.key}</Text>
          <Text className='mb-1 text-sm font-medium text-gray-900'>Value:</Text>
          <Text className='text-base text-gray-700'>{item.value}</Text>
        </View>
        <TouchableOpacity
          onPress={() => handleDeleteItem(item.key)}
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
        <View className='border-b border-gray-200 bg-white px-4 py-3'>
          <View className='flex-row items-center'>
            <TouchableOpacity
              onPress={handleBack}
              className='-ml-2 mr-2 p-2'
            >
              <BackIcon size={20} color='#374151' />
            </TouchableOpacity>
            <Text className='text-lg font-medium text-black'>Local Storage</Text>
          </View>
        </View>

        {/* Add New Item Form */}
        <View className='bg-white p-4 shadow-sm'>
          <Text className='mb-3 text-lg font-medium text-gray-900'>
            Add New Item
          </Text>
          <View className='space-y-3'>
            <View>
              <Text className='mb-1 text-sm font-medium text-gray-700'>Key</Text>
              <TextInput
                value={newKey}
                onChangeText={setNewKey}
                placeholder='Enter key'
                className='rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900'
                autoCapitalize='none'
                autoCorrect={false}
              />
            </View>
            <View>
              <Text className='mb-1 text-sm font-medium text-gray-700'>Value</Text>
              <TextInput
                value={newValue}
                onChangeText={setNewValue}
                placeholder='Enter value'
                className='rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900'
                multiline
                numberOfLines={3}
              />
            </View>
            <TouchableOpacity
              onPress={handleAddItem}
              className='rounded-lg bg-blue-600 px-4 py-3'
            >
              <Text className='text-center text-base font-medium text-white'>
                Add Item
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Storage Items List */}
        <View className='flex-1 p-4'>
          <View className='mb-3 flex-row items-center justify-between'>
            <Text className='text-lg font-medium text-gray-900'>
              Stored Items ({storageItems.length})
            </Text>
            <TouchableOpacity
              onPress={loadStorageItems}
              className='rounded-lg bg-gray-100 px-3 py-2'
            >
              <Text className='text-sm font-medium text-gray-700'>Refresh</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View className='flex-1 items-center justify-center'>
              <Text className='text-gray-500'>Loading...</Text>
            </View>
          ) : storageItems.length === 0 ? (
            <View className='flex-1 items-center justify-center'>
              <Text className='text-center text-gray-500'>
                No items stored yet.{'\n'}Add your first key-value pair above.
              </Text>
            </View>
          ) : (
            <FlatList
              data={storageItems}
              renderItem={renderStorageItem}
              keyExtractor={(item) => item.key}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
