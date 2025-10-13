import React from 'react';
import { View } from 'react-native';

interface BackIconProps {
  size?: number;
  color?: string;
}

export default function BackIcon({ size = 20, color = '#374151' }: BackIconProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {/* Simple back arrow using View components */}
      <View
        style={{
          width: size * 0.6,
          height: 2,
          backgroundColor: color,
          transform: [{ rotate: '-45deg' }],
          position: 'absolute',
          top: size * 0.3,
          left: size * 0.2,
        }}
      />
      <View
        style={{
          width: size * 0.6,
          height: 2,
          backgroundColor: color,
          transform: [{ rotate: '45deg' }],
          position: 'absolute',
          bottom: size * 0.3,
          left: size * 0.2,
        }}
      />
    </View>
  );
}
