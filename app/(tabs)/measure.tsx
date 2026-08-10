import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { H2, Body, Caption } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';

const METHODS = [
  {
    icon: '⌚',
    title: 'Cinta ou relógio (Bluetooth)',
    desc: 'Conecta ao sensor e lê os intervalos entre batimentos. Precisão de ~1ms.',
    recommended: true,
    route: '/measurement/ble' as const,
  },
];

export default function MeasureScreen() {
  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
      <View className="flex-1 px-5 pt-4 pb-8 gap-6">
        <View className="gap-1">
          <H2>Medir VFC</H2>
          <Body className="text-text-secondary">
            Meça ao acordar, em repouso, antes do café.
          </Body>
        </View>

        <View className="gap-3">
          {METHODS.map((m) => (
            <TouchableOpacity
              key={m.title}
              onPress={() => router.push(m.route)}
              activeOpacity={0.8}
            >
              <Card className="flex-row gap-4 items-start">
                <Text className="text-4xl">{m.icon}</Text>
                <View className="flex-1 gap-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-text-primary font-semibold text-base">{m.title}</Text>
                    {m.recommended && (
                      <View className="bg-brand-green/20 px-2 py-0.5 rounded-full">
                        <Text className="text-brand-green text-xs font-semibold">Recomendado</Text>
                      </View>
                    )}
                  </View>
                  <Caption>{m.desc}</Caption>
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </View>

        <Card className="bg-bg-card/50 gap-3">
          <Text className="text-text-primary font-semibold">Dicas para melhor resultado</Text>
          {[
            'Meça sempre no mesmo horário (ao acordar)',
            'Fique em repouso por 2 min antes',
            'Use cinta peitoral e mantenha os eletrodos umedecidos',
            'Ambiente calmo e temperatura agradável',
            'Não meça após café ou exercício',
          ].map((tip) => (
            <View key={tip} className="flex-row gap-2 items-start">
              <Text className="text-brand-green">✓</Text>
              <Caption className="flex-1">{tip}</Caption>
            </View>
          ))}
        </Card>
      </View>
    </SafeAreaView>
  );
}
