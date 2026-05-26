import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import type { WellbeingInput } from '../../types/hrv';
import { Button } from '../ui/Button';
import { H2, Body, Caption } from '../ui/Typography';

interface Question {
  key: keyof WellbeingInput;
  label: string;
  lowLabel: string;
  highLabel: string;
  inverted: boolean;
}

const QUESTIONS: Question[] = [
  {
    key: 'sleep_quality',
    label: 'Qualidade do Sono',
    lowLabel: 'Péssimo',
    highLabel: 'Excelente',
    inverted: false,
  },
  {
    key: 'doms_level',
    label: 'Dor Muscular (DOMS)',
    lowLabel: 'Nenhuma',
    highLabel: 'Intensa',
    inverted: true,
  },
  {
    key: 'stress_level',
    label: 'Estresse Mental',
    lowLabel: 'Relaxado',
    highLabel: 'Muito estressado',
    inverted: true,
  },
  {
    key: 'fatigue_level',
    label: 'Fadiga Geral',
    lowLabel: 'Descansado',
    highLabel: 'Exausto',
    inverted: true,
  },
];

interface WellbeingFormProps {
  onSubmit: (data: WellbeingInput) => void;
  loading?: boolean;
}

export function WellbeingForm({ onSubmit, loading = false }: WellbeingFormProps) {
  const [values, setValues] = useState<WellbeingInput>({
    sleep_quality: 3,
    doms_level: 1,
    stress_level: 1,
    fatigue_level: 1,
  });

  const SCALE = [1, 2, 3, 4, 5];

  return (
    <ScrollView className="flex-1" contentContainerClassName="p-6 gap-6">
      <View className="gap-1">
        <H2>Como você está se sentindo?</H2>
        <Body className="text-text-secondary">
          Responda ao acordar para calibrar sua prescrição do dia.
        </Body>
      </View>

      {QUESTIONS.map((q) => (
        <View key={q.key} className="gap-3">
          <Text className="text-text-primary font-semibold text-base">{q.label}</Text>
          <View className="flex-row gap-2">
            {SCALE.map((v) => {
              const selected = values[q.key] === v;
              return (
                <TouchableOpacity
                  key={v}
                  onPress={() => setValues((prev) => ({ ...prev, [q.key]: v }))}
                  className={`flex-1 aspect-square rounded-2xl items-center justify-center border ${
                    selected
                      ? 'bg-brand-green border-brand-green'
                      : 'bg-bg-card border-bg-border'
                  }`}
                  activeOpacity={0.7}
                >
                  <Text
                    className={`text-lg font-bold ${
                      selected ? 'text-bg-primary' : 'text-text-secondary'
                    }`}
                  >
                    {v}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View className="flex-row justify-between">
            <Caption>{q.lowLabel}</Caption>
            <Caption>{q.highLabel}</Caption>
          </View>
        </View>
      ))}

      <Button
        title="Ver Prescrição do Dia"
        size="lg"
        loading={loading}
        onPress={() => onSubmit(values)}
        className="mt-4"
      />
    </ScrollView>
  );
}
