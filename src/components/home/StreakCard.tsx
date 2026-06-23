import React from 'react';
import { View, Text } from 'react-native';
import { Card } from '../ui/Card';
import { Label, Caption } from '../ui/Typography';
import type { StreakData } from '../../hooks/useStreak';

interface StreakCardProps {
  streak: StreakData;
}

export function StreakCard({ streak }: StreakCardProps) {
  const { currentStreak, longestStreak, monthlyDays, monthlyTotal, monthlyPct, measuredToday } =
    streak;

  const flameColor =
    currentStreak >= 7
      ? 'text-rush-orange'
      : currentStreak >= 3
        ? 'text-yellow-400'
        : 'text-text-secondary';

  const consistencyColor =
    monthlyPct >= 80
      ? 'bg-brand-green'
      : monthlyPct >= 50
        ? 'bg-yellow-400'
        : 'bg-rush-red';

  return (
    <Card className="gap-4">
      <View className="flex-row items-center justify-between">
        <Label>Consistência</Label>
        {!measuredToday && currentStreak > 0 && (
          <Caption className="text-yellow-400 text-xs">⚡ Medir hoje para manter</Caption>
        )}
      </View>

      {/* Streak + monthly side by side */}
      <View className="flex-row gap-3">
        {/* Current streak */}
        <View className="flex-1 bg-bg-secondary rounded-2xl p-4 items-center gap-1">
          <Text className={`text-3xl font-black ${flameColor}`}>
            {currentStreak > 0 ? '🔥' : '💤'}
          </Text>
          <Text className="text-text-primary text-2xl font-black">{currentStreak}</Text>
          <Caption className="text-center text-xs">
            {currentStreak === 1 ? 'dia seguido' : 'dias seguidos'}
          </Caption>
        </View>

        {/* Monthly consistency */}
        <View className="flex-1 bg-bg-secondary rounded-2xl p-4 items-center gap-1">
          <Text className="text-text-primary text-2xl font-black">{monthlyPct}%</Text>
          <Caption className="text-center text-xs">
            {monthlyDays}/{monthlyTotal} dias esse mês
          </Caption>
          {/* Progress dots for the month */}
          <View className="flex-row flex-wrap gap-0.5 mt-1 justify-center">
            {Array.from({ length: Math.min(monthlyTotal, 30) }, (_, i) => (
              <View
                key={i}
                className={`w-2 h-2 rounded-full ${
                  i < monthlyDays ? consistencyColor : 'bg-bg-border'
                }`}
              />
            ))}
          </View>
        </View>
      </View>

      {/* Record badge */}
      {longestStreak > 1 && (
        <View className="flex-row items-center justify-between px-1">
          <Caption className="text-xs">Recorde pessoal</Caption>
          <Caption className="text-xs font-semibold text-text-primary">
            🏆 {longestStreak} dias
          </Caption>
        </View>
      )}
    </Card>
  );
}
