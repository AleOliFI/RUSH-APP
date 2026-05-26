import React from 'react';
import { View, Text } from 'react-native';
import type { ReadinessColor } from '../../types/readiness';

const colorMap: Record<ReadinessColor, { bg: string; text: string; dot: string }> = {
  green:  { bg: 'bg-rush-lime/10',   text: 'text-rush-lime',      dot: 'bg-rush-lime' },
  orange: { bg: 'bg-rush-orange/10', text: 'text-rush-orange',    dot: 'bg-rush-orange' },
  red:    { bg: 'bg-rush-red/10',    text: 'text-rush-red',       dot: 'bg-rush-red' },
  gray:   { bg: 'bg-bg-card',        text: 'text-text-secondary', dot: 'bg-text-muted' },
};

interface BadgeProps {
  color: ReadinessColor;
  label: string;
}

export function ReadinessBadge({ color, label }: BadgeProps) {
  const c = colorMap[color];
  return (
    <View className={`${c.bg} flex-row items-center gap-1.5 px-3 py-1 rounded-sm border border-bg-border self-start`}>
      <View className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      <Text className={`${c.text} text-xs font-bold uppercase tracking-widest`}>{label}</Text>
    </View>
  );
}
