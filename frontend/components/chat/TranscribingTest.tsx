import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { TranscribingAnimation } from './TranscribingAnimation';

export function TranscribingTest() {
  const [isActive, setIsActive] = useState(false);

  return (
    <View className='p-4'>
      <Text className='text-lg font-semibold mb-4'>
        Transcribing Animation Test
      </Text>

      <TouchableOpacity
        onPress={() => setIsActive(!isActive)}
        className='bg-blue-500 px-4 py-2 rounded-lg mb-4'
      >
        <Text className='text-white text-center'>
          {isActive ? 'Stop Animation' : 'Start Animation'}
        </Text>
      </TouchableOpacity>

      <View className='bg-gray-100 rounded-lg p-4'>
        <TranscribingAnimation
          isActive={isActive}
          height={60}
          color='#3B82F6'
        />
      </View>
    </View>
  );
}

