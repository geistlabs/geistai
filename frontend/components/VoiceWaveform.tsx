import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

interface VoiceWaveformProps {
  levels: number[]; // Array of audio levels (0-1)
  isActive: boolean;
  barCount?: number;
  height?: number;
  barWidth?: number;
  barSpacing?: number;
  minBarHeight?: number;
  maxBarHeight?: number;
  color?: string;
  animationDuration?: number;
}

export function VoiceWaveform({
  levels,
  isActive,
  barCount = 20,
  height = 44,
  barWidth = 2,
  barSpacing = 1,
  minBarHeight = 2,
  maxBarHeight = 32,
  color = '#9CA3AF', // gray-400
  animationDuration = 150,
}: VoiceWaveformProps) {
  const animatedValues = useRef(
    Array.from({ length: barCount }, () => new Animated.Value(minBarHeight)),
  ).current;

  // Update bar heights based on audio levels
  useEffect(() => {
    if (isActive && levels.length >= barCount) {
      const animations = animatedValues.map((animatedValue, index) => {
        const level = levels[index] || 0;
        const targetHeight =
          minBarHeight + level * (maxBarHeight - minBarHeight);

        return Animated.timing(animatedValue, {
          toValue: targetHeight,
          duration: animationDuration,
          useNativeDriver: false,
        });
      });

      Animated.parallel(animations).start();
    } else if (!isActive) {
      // Fade to minimum height when not active
      const animations = animatedValues.map(animatedValue =>
        Animated.timing(animatedValue, {
          toValue: minBarHeight,
          duration: animationDuration * 2,
          useNativeDriver: false,
        }),
      );

      Animated.parallel(animations).start();
    }
  }, [
    levels,
    isActive,
    animatedValues,
    barCount,
    minBarHeight,
    maxBarHeight,
    animationDuration,
  ]);

  return (
    <View
      className='flex-1 flex-row items-center justify-center'
      style={{
        height,
        paddingHorizontal: barSpacing * 2,
      }}
    >
      {animatedValues.map((animatedValue, index) => (
        <Animated.View
          key={index}
          className='rounded-full'
          style={{
            width: barWidth,
            height: animatedValue,
            backgroundColor: color,
            marginHorizontal: barSpacing / 2,
          }}
        />
      ))}
    </View>
  );
}

// Alternative circular/dots waveform style
export function VoiceWaveformDots({
  levels,
  isActive,
  dotCount = 15,
  height = 44,
  dotSize = 4,
  dotSpacing = 2,
  minOpacity = 0.2,
  maxOpacity = 1,
  color = '#9CA3AF',
  animationDuration = 150,
}: {
  levels: number[];
  isActive: boolean;
  dotCount?: number;
  height?: number;
  dotSize?: number;
  dotSpacing?: number;
  minOpacity?: number;
  maxOpacity?: number;
  color?: string;
  animationDuration?: number;
}) {
  const animatedValues = useRef(
    Array.from({ length: dotCount }, () => new Animated.Value(minOpacity)),
  ).current;

  useEffect(() => {
    if (isActive && levels.length >= dotCount) {
      const animations = animatedValues.map((animatedValue, index) => {
        const level = levels[index] || 0;
        const targetOpacity = minOpacity + level * (maxOpacity - minOpacity);

        return Animated.timing(animatedValue, {
          toValue: targetOpacity,
          duration: animationDuration,
          useNativeDriver: false,
        });
      });

      Animated.parallel(animations).start();
    } else if (!isActive) {
      const animations = animatedValues.map(animatedValue =>
        Animated.timing(animatedValue, {
          toValue: minOpacity,
          duration: animationDuration * 2,
          useNativeDriver: false,
        }),
      );

      Animated.parallel(animations).start();
    }
  }, [
    levels,
    isActive,
    animatedValues,
    dotCount,
    minOpacity,
    maxOpacity,
    animationDuration,
  ]);

  return (
    <View
      className='flex-1 flex-row items-center justify-center'
      style={{
        height,
        paddingHorizontal: dotSpacing * 2,
      }}
    >
      {animatedValues.map((animatedValue, index) => (
        <Animated.View
          key={index}
          className='rounded-full'
          style={{
            width: dotSize,
            height: dotSize,
            backgroundColor: color,
            opacity: animatedValue,
            marginHorizontal: dotSpacing / 2,
          }}
        />
      ))}
    </View>
  );
}

// Pulse style waveform (single expanding circle)
export function VoiceWaveformPulse({
  averageLevel,
  isActive,
  size = 44,
  minScale = 0.3,
  maxScale = 1.2,
  color = '#9CA3AF',
  animationDuration = 150,
}: {
  averageLevel: number;
  isActive: boolean;
  size?: number;
  minScale?: number;
  maxScale?: number;
  color?: string;
  animationDuration?: number;
}) {
  const scaleValue = useRef(new Animated.Value(minScale)).current;
  const opacityValue = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (isActive) {
      const targetScale = minScale + averageLevel * (maxScale - minScale);
      const targetOpacity = 0.3 + averageLevel * 0.7;

      Animated.parallel([
        Animated.timing(scaleValue, {
          toValue: targetScale,
          duration: animationDuration,
          useNativeDriver: true,
        }),
        Animated.timing(opacityValue, {
          toValue: targetOpacity,
          duration: animationDuration,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleValue, {
          toValue: minScale,
          duration: animationDuration * 2,
          useNativeDriver: true,
        }),
        Animated.timing(opacityValue, {
          toValue: 0.2,
          duration: animationDuration * 2,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [
    averageLevel,
    isActive,
    scaleValue,
    opacityValue,
    minScale,
    maxScale,
    animationDuration,
  ]);

  return (
    <View
      className='flex-1 items-center justify-center'
      style={{ height: size }}
    >
      <Animated.View
        className='rounded-full'
        style={{
          width: size * 0.6,
          height: size * 0.6,
          backgroundColor: color,
          transform: [{ scale: scaleValue }],
          opacity: opacityValue,
        }}
      />
    </View>
  );
}
