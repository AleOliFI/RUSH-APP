import React from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

interface SignalIndicatorProps {
  quality: number;
  isActive: boolean;
}

export function SignalIndicator({ quality, isActive }: SignalIndicatorProps) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (isActive) {
      pulse.value = withRepeat(withSpring(1.15, { duration: 400 }), -1, true);
    } else {
      pulse.value = withTiming(1);
    }
  }, [isActive]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const qualityColor =
    quality > 0.8 ? '#22C55E' : quality > 0.5 ? '#EAB308' : '#EF4444';
  const qualityLabel =
    quality > 0.8 ? 'Sinal excelente' : quality > 0.5 ? 'Sinal razoável' : 'Ajuste o dedo';

  return (
    <View className="items-center gap-3">
      <Animated.View
        style={[
          animatedStyle,
          {
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: `${qualityColor}20`,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: qualityColor,
          },
        ]}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: qualityColor,
          }}
        />
      </Animated.View>
      {isActive && (
        <Text style={{ color: qualityColor }} className="text-sm font-medium">
          {qualityLabel}
        </Text>
      )}
    </View>
  );
}
