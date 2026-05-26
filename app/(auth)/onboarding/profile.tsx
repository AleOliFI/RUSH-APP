import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { H1, Body, Caption } from '../../../src/components/ui/Typography';
import { Button } from '../../../src/components/ui/Button';
import { supabase } from '../../../src/lib/supabase';
import { useAuthStore } from '../../../src/stores/auth';

type RunnerLevel = 'beginner' | 'intermediate' | 'advanced';
type Gender = 'male' | 'female' | 'other';

const LEVELS: { key: RunnerLevel; label: string; desc: string }[] = [
  { key: 'beginner', label: 'Iniciante', desc: 'Menos de 1 ano correndo ou até 20 km/semana' },
  { key: 'intermediate', label: 'Intermediário', desc: '1-3 anos, provas de 5K a meia maratona' },
  { key: 'advanced', label: 'Avançado', desc: 'Mais de 3 anos, volume alto, maratona+' },
];

const GENDERS: { key: Gender; label: string }[] = [
  { key: 'female', label: 'Feminino' },
  { key: 'male', label: 'Masculino' },
  { key: 'other', label: 'Outro' },
];

export default function OnboardingProfile() {
  const { user } = useAuthStore();
  const [level, setLevel] = useState<RunnerLevel>('beginner');
  const [gender, setGender] = useState<Gender>('female');
  const [loading, setLoading] = useState(false);

  async function handleNext() {
    if (!user) return;
    setLoading(true);
    await supabase.from('profiles').update({ runner_level: level, gender }).eq('id', user.id);
    setLoading(false);
    router.push('/(auth)/onboarding/calibration');
  }

  return (
    <ScrollView
      className="flex-1 bg-bg-primary"
      contentContainerClassName="px-6 py-12 gap-8"
    >
      <View className="gap-1">
        <Text className="text-brand-green text-sm font-semibold uppercase tracking-widest">
          Passo 1 de 2
        </Text>
        <H1>Fale sobre você</H1>
        <Body className="text-text-secondary">
          Isso calibra sua prescrição de treino personalizada.
        </Body>
      </View>

      <View className="gap-4">
        <Caption className="text-text-secondary uppercase tracking-widest font-semibold">
          Gênero
        </Caption>
        <View className="flex-row gap-3">
          {GENDERS.map((g) => (
            <TouchableOpacity
              key={g.key}
              onPress={() => setGender(g.key)}
              className={`flex-1 py-3 rounded-2xl items-center border ${
                gender === g.key
                  ? 'bg-brand-green border-brand-green'
                  : 'bg-bg-card border-bg-border'
              }`}
              activeOpacity={0.7}
            >
              <Text
                className={`font-semibold text-sm ${
                  gender === g.key ? 'text-bg-primary' : 'text-text-secondary'
                }`}
              >
                {g.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View className="gap-4">
        <Caption className="text-text-secondary uppercase tracking-widest font-semibold">
          Nível como corredor
        </Caption>
        <View className="gap-3">
          {LEVELS.map((l) => (
            <TouchableOpacity
              key={l.key}
              onPress={() => setLevel(l.key)}
              className={`p-4 rounded-2xl border ${
                level === l.key
                  ? 'bg-brand-green/10 border-brand-green'
                  : 'bg-bg-card border-bg-border'
              }`}
              activeOpacity={0.7}
            >
              <Text
                className={`font-semibold text-base ${
                  level === l.key ? 'text-brand-green' : 'text-text-primary'
                }`}
              >
                {l.label}
              </Text>
              <Text className="text-text-secondary text-sm mt-0.5">{l.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Button title="Continuar" size="lg" loading={loading} onPress={handleNext} />
    </ScrollView>
  );
}
