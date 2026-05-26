import React from 'react';
import { View, Text } from 'react-native';
import type { ReadinessColor } from '../../types/readiness';

const colorMap: Record<ReadinessColor, { bg: string; text: string; dot: string }> = {
  green: { bg: 'bg-brand-green/20', text: 'text-brand-green', dot: 'bg-brand-green' },
  yellow: { bg: 'bg-brand-yellow/20', text: 'text-brand-yellow', dot: 'bg-brand-yellow' },
  orange: { bg: 'bg-brand-orange/20', text: 'text-brand-orange', dot: 'bg-brand-orange' },
  red: { bg: 'bg-brand-red/20', text: 'text-brand-red', dot: 'bg-brand-red' },
  dark_red: { bg: 'bg-red-900/30', text: 'text-red-300', dot: 'bg-red-700' },
  gray: { bg: 'bg-bg-card', text: 'text-text-secondary', dot: 'bg-text-muted' },
};

interface BadgeProps {
  color: ReadinessColor;
  label: string;
}

export function ReadinessBadge({ color, label }: BadgeProps) {
  const c = colorMap[color];
  return (
    <View className={`${c.bg} flex-row items-center gap-1.5 px-3 py-1 rounded-full self-start`}>
      <View className={`w-2 h-2 rounded-full ${c.dot}`} />
      <Text className={`${c.text} text-sm font-medium`}>{label}</Text>
    </View>
  );
}
