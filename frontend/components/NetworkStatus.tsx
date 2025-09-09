import React, { useEffect, useState } from 'react';
import { Text, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface NetworkStatusProps {
  isOnline?: boolean;
  showAlways?: boolean;
  position?: 'top' | 'bottom';
}

export const NetworkStatus: React.FC<NetworkStatusProps> = ({ 
  isOnline: externalIsOnline,
  showAlways = false,
  position = 'top'
}) => {
  const [isOnline, setIsOnline] = useState(externalIsOnline ?? true);
  const [isVisible, setIsVisible] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(position === 'top' ? -50 : 50))[0];

  useEffect(() => {
    if (externalIsOnline !== undefined) {
      setIsOnline(externalIsOnline);
    }
  }, [externalIsOnline]);

  useEffect(() => {
    if (!isOnline || showAlways) {
      setIsVisible(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: position === 'top' ? -50 : 50,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => setIsVisible(false));
    }
  }, [isOnline, showAlways, fadeAnim, slideAnim, position]);

  if (!isVisible && !showAlways) return null;

  const positionClasses = position === 'top' ? 'top-0' : 'bottom-0';
  const statusClasses = isOnline ? 'bg-green-500' : 'bg-red-500';

  return (
    <Animated.View
      className={`absolute left-0 right-0 flex-row items-center justify-center py-2 px-4 z-50 ${positionClasses} ${statusClasses}`}
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <Ionicons
        name={isOnline ? 'checkmark-circle' : 'alert-circle'}
        size={20}
        color="white"
        className="mr-2"
      />
      <Text className="text-white text-sm font-medium">
        {isOnline ? 'Connected' : 'No connection'}
      </Text>
    </Animated.View>
  );
};