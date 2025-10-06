import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';

interface TranscribingAnimationProps {
  isActive: boolean;
  height?: number;
  color?: string;
}

export function TranscribingAnimation({
  isActive,
  height = 44,
  color = '#6B7280',
}: TranscribingAnimationProps) {
  const animatedValues = useRef(
    Array.from({ length: 5 }, () => new Animated.Value(0.3)),
  ).current;

  useEffect(() => {
    if (isActive) {
      // Create staggered animation for each bar
      const animations = animatedValues.map((animValue, index) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(animValue, {
              toValue: 1,
              duration: 600,
              delay: index * 100,
              useNativeDriver: false,
            }),
            Animated.timing(animValue, {
              toValue: 0.3,
              duration: 600,
              delay: (4 - index) * 100,
              useNativeDriver: false,
            }),
          ]),
        );
      });

      // Start all animations
      Animated.parallel(animations).start();
    } else {
      // Stop animations and reset to initial state
      animatedValues.forEach(animValue => {
        animValue.stopAnimation();
        animValue.setValue(0.3);
      });
    }
  }, [isActive, animatedValues]);

  return (
    <View
      className='flex-row items-center justify-center px-4'
      style={{ height }}
    >
      <View className='flex-row items-center space-x-1'>
        {animatedValues.map((animValue, index) => (
          <Animated.View
            key={index}
            style={{
              width: 3,
              height: animValue.interpolate({
                inputRange: [0.3, 1],
                outputRange: [height * 0.2, height * 0.8],
              }),
              backgroundColor: color,
              borderRadius: 1.5,
              opacity: animValue.interpolate({
                inputRange: [0.3, 1],
                outputRange: [0.4, 1],
              }),
            }}
          />
        ))}
      </View>
      <Text className='ml-3 text-sm text-gray-500'>Transcribing...</Text>
    </View>
  );
}
