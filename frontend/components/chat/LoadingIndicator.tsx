import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Animated } from 'react-native';

const loadingWords = [
  'Mulling',
  'Kneading',
  'Brewing',
  'Steeping',
  'Simmering',
  'Fermenting',
  'Distilling',
  'Sifting',
  'Folding',
  'Whirring',
  'Circling',
  'Spinning',
  'Weaving',
  'Threading',
  'Stirring',
  'Mixing',
  'Shaping',
  'Layering',
  'Blending',
  'Flowing',
  'Pulsing',
  'Humming',
  'Buzzing',
  'Murmuring',
  'Whispering',
  'Echoing',
  'Reverberating',
  'Drifting',
  'Wandering',
  'Looping',
  'Polishing',
  'Sharpening',
  'Etching',
  'Carving',
  'Casting',
  'Forging',
  'Pressing',
  'Seeding',
  'Sprouting',
  'Blooming',
  'Gathering',
  'Stacking',
  'Nesting',
  'Aligning',
  'Balancing',
  'Settling',
  'Grounding',
  'Rooting',
  'Warming',
  'Kindling',
];

interface LoadingIndicatorProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
}

export function LoadingIndicator({
  size = 'medium',
  showText = true,
}: LoadingIndicatorProps) {
  const [currentWord, setCurrentWord] = useState('');
  const pulseAnimation = useRef(new Animated.Value(1)).current;

  // Get random word on mount (no switching after that)
  useEffect(() => {
    const getRandomWord = () => {
      const randomIndex = Math.floor(Math.random() * loadingWords.length);
      return loadingWords[randomIndex];
    };

    // Set initial word and keep it throughout the loading
    setCurrentWord(getRandomWord());
  }, []);

  // Pulsing animation
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );

    pulse.start();

    return () => pulse.stop();
  }, [pulseAnimation]);

  const circleSize = {
    small: 10,
    medium: 16,
    large: 20,
  }[size];

  const textSize = {
    small: 'text-base',
    medium: 'text-lg',
    large: 'text-xl',
  }[size];

  return (
    <View className='flex-row items-center space-x-2'>
      <Animated.View
        style={{
          opacity: pulseAnimation,
          width: circleSize,
          height: circleSize,
        }}
        className='bg-gray-800 rounded-full'
      />
      {showText && (
        <Text className={`text-gray-700 ${textSize}`}>{currentWord}...</Text>
      )}
    </View>
  );
}
