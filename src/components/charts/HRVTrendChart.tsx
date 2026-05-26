import React from 'react';
import { View, Text, Dimensions } from 'react-native';
import type { ReadinessAssessment } from '../../types/readiness';
import { READINESS_COLOR_HEX } from '../../lib/algorithms/readiness';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 48;
const CHART_HEIGHT = 120;

interface HRVTrendChartProps {
  assessments: ReadinessAssessment[];
}

export function HRVTrendChart({ assessments }: HRVTrendChartProps) {
  if (assessments.length < 2) {
    return (
      <View
        style={{ height: CHART_HEIGHT }}
        className="items-center justify-center"
      >
        <Text className="text-text-muted text-sm">
          Dados insuficientes para o gráfico
        </Text>
      </View>
    );
  }

  const sorted = [...assessments].reverse();
  const scores = sorted.map((a) => a.readiness_score);
  const maxScore = Math.max(...scores, 100);
  const minScore = Math.min(...scores, 0);
  const range = maxScore - minScore || 1;

  const barWidth = (CHART_WIDTH - (sorted.length - 1) * 4) / sorted.length;

  return (
    <View>
      <View
        style={{ height: CHART_HEIGHT, width: CHART_WIDTH }}
        className="flex-row items-end gap-1"
      >
        {sorted.map((a, i) => {
          const height = ((scores[i] - minScore) / range) * (CHART_HEIGHT - 16) + 8;
          const color = READINESS_COLOR_HEX[a.readiness_color];
          return (
            <View
              key={a.id}
              style={{
                width: barWidth,
                height,
                backgroundColor: color,
                borderRadius: 4,
                opacity: 0.85,
              }}
            />
          );
        })}
      </View>
      <View className="flex-row justify-between mt-1">
        <Text className="text-text-muted text-xs">
          {new Date(sorted[0].assessed_at).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
          })}
        </Text>
        <Text className="text-text-muted text-xs">Hoje</Text>
      </View>
    </View>
  );
}
