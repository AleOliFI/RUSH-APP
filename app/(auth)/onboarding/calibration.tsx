import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { H1, Body } from '../../../src/components/ui/Typography';
import { Button } from '../../../src/components/ui/Button';

const STEPS = [
  {
    icon: '📸',
    title: 'Meça todo dia ao acordar',
    desc: '60 segundos em repouso com sua cinta ou relógio conectado. Quanto mais consistente, mais precisa a prescrição.',
  },
  {
    icon: '📊',
    title: 'Período de calibração: 7 dias',
    desc: 'O app aprende sua VFC basal pessoal. Durante este período, continue seu treino normal.',
  },
  {
    icon: '🎯',
    title: 'Prescrição personalizada',
    desc: 'A partir da 8ª medição, você recebe sua diretiva de treino diária calibrada ao seu perfil único.',
  },
];

export default function OnboardingCalibration() {
  return (
    <ScrollView
      className="flex-1 bg-bg-primary"
      contentContainerClassName="px-6 py-12 gap-8"
    >
      <View className="gap-1">
        <Text className="text-brand-green text-sm font-semibold uppercase tracking-widest">
          Passo 2 de 2
        </Text>
        <H1>Como funciona</H1>
        <Body className="text-text-secondary">
          A ciência por trás da sua recuperação.
        </Body>
      </View>

      <View className="gap-4">
        {STEPS.map((s, i) => (
          <View key={i} className="bg-bg-card rounded-3xl p-5 gap-3 flex-row">
            <Text className="text-4xl">{s.icon}</Text>
            <View className="flex-1 gap-1">
              <Text className="text-text-primary font-semibold text-base">{s.title}</Text>
              <Text className="text-text-secondary text-sm leading-5">{s.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <View className="bg-brand-green/10 border border-brand-green/30 rounded-3xl p-5 gap-2">
        <Text className="text-brand-green font-semibold text-base">
          VFC • FC Repouso • Bem-estar
        </Text>
        <Body className="text-text-secondary text-sm">
          Três dimensões de dados para eliminar a adivinhação do seu treino. Método validado pela
          ciência do esporte de elite, agora acessível a qualquer corredor.
        </Body>
      </View>

      <Button
        title="Fazer minha primeira medição"
        size="lg"
        onPress={() => router.replace('/measurement/ble')}
      />
    </ScrollView>
  );
}
