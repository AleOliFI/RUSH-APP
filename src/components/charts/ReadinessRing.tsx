import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import type { ReadinessColor } from '../../types/readiness';
import { READINESS_COLOR_HEX } from '../../lib/algorithms/readiness';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ReadinessRingProps {
  score: number;
  color: ReadinessColor;
  size?: number;
}

export function ReadinessRing({ score, color, size = 160 }: ReadinessRingProps) {
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(score / 100, {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    });
  }, [score]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const hex = READINESS_COLOR_HEX[color];

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#2A2A2A"
          strokeWidth={8}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={hex}
          strokeWidth={8}
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View
        style={{ position: 'absolute', alignItems: 'center' }}
      >
        <Text style={{ color: hex, fontSize: 32, fontWeight: '800' }}>{score}</Text>
        <Text className="text-text-muted text-xs font-medium uppercase tracking-widest">
          prontidão
        </Text>
      </View>
    </View>
  );
}
