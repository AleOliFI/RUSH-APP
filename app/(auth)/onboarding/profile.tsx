import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { H1, Body, Caption } from '../../../src/components/ui/Typography';
import { Button } from '../../../src/components/ui/Button';
import { supabase } from '../../../src/lib/supabase';
import { useAuthStore } from '../../../src/stores/auth';
import type { HormonalProfile } from '../../../src/types/hrv';

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

const HORMONAL_OPTIONS: { key: HormonalProfile; label: string; desc: string }[] = [
  { key: 'regular', label: 'Sim, regular', desc: 'Ciclo mensal previsível' },
  { key: 'sop', label: 'Irregular / SOP', desc: 'Ciclo irregular ou SOP diagnosticada' },
  { key: 'ahf_reds', label: 'Amenorreia / RED-S', desc: 'Ausência de ciclo ou RED-S diagnosticado' },
  { key: null, label: 'Prefiro não informar', desc: '' },
];

function padTwo(n: string) {
  return n.replace(/\D/g, '').slice(0, 2);
}

function buildDateString(day: string, month: string, year: string): string | null {
  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (!d || !m || !y || y < 2000 || y > 2030) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  if (date > new Date()) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function OnboardingProfile() {
  const { user } = useAuthStore();
  const [level, setLevel] = useState<RunnerLevel>('beginner');
  const [gender, setGender] = useState<Gender>('female');
  const [hormonalProfile, setHormonalProfile] = useState<HormonalProfile>('regular');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [loading, setLoading] = useState(false);

  const dateString = buildDateString(day, month, year);
  const dateValid = day && month && year ? dateString !== null : true;

  async function handleNext() {
    if (!user) return;
    setLoading(true);

    const updates: Record<string, unknown> = { runner_level: level, gender };
    if (gender === 'female') {
      updates.hormonal_profile = hormonalProfile;
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    let cycleError = null;
    if (gender === 'female' && dateString) {
      ({ error: cycleError } = await supabase
        .from('cycle_logs')
        .upsert(
          { user_id: user.id, cycle_start_date: dateString },
          { onConflict: 'user_id,cycle_start_date' },
        ));
    }

    if (profileError || cycleError) {
      console.error('Error saving onboarding profile:', profileError ?? cycleError);
      Alert.alert('Erro', 'Não foi possível salvar seu perfil. Tente novamente.');
      setLoading(false);
      return;
    }

    setLoading(false);
    router.push('/(auth)/onboarding/calibration');
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <ScrollView
        className="flex-1 bg-bg-primary"
        contentContainerClassName="px-6 py-12 gap-8"
        keyboardShouldPersistTaps="handled"
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

        {/* Gender */}
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

        {/* Hormonal profile — female only */}
        {gender === 'female' && (
          <>
            <View className="gap-4">
              <Caption className="text-text-secondary uppercase tracking-widest font-semibold">
                Ciclo Menstrual
              </Caption>
              <Body className="text-text-secondary -mt-2">
                Você tem ciclo menstrual regular?
              </Body>
              <View className="gap-3">
                {HORMONAL_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={String(opt.key)}
                    onPress={() => setHormonalProfile(opt.key)}
                    className={`p-4 rounded-2xl border ${
                      hormonalProfile === opt.key
                        ? 'bg-brand-green/10 border-brand-green'
                        : 'bg-bg-card border-bg-border'
                    }`}
                    activeOpacity={0.7}
                  >
                    <Text
                      className={`font-semibold text-base ${
                        hormonalProfile === opt.key ? 'text-brand-green' : 'text-text-primary'
                      }`}
                    >
                      {opt.label}
                    </Text>
                    {opt.desc ? (
                      <Text className="text-text-secondary text-sm mt-0.5">{opt.desc}</Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Date of last period */}
            {hormonalProfile !== null && (
              <View className="gap-3">
                <Caption className="text-text-secondary uppercase tracking-widest font-semibold">
                  Data da última menstruação (opcional)
                </Caption>
                <View className="flex-row gap-3">
                  <View className="flex-1 gap-1">
                    <Caption className="text-text-muted text-xs">Dia</Caption>
                    <TextInput
                      value={day}
                      onChangeText={(v) => setDay(padTwo(v))}
                      placeholder="DD"
                      keyboardType="numeric"
                      maxLength={2}
                      className="bg-bg-card border border-bg-border rounded-2xl px-4 py-3 text-text-primary text-base text-center"
                      placeholderTextColor="#525252"
                    />
                  </View>
                  <View className="flex-1 gap-1">
                    <Caption className="text-text-muted text-xs">Mês</Caption>
                    <TextInput
                      value={month}
                      onChangeText={(v) => setMonth(padTwo(v))}
                      placeholder="MM"
                      keyboardType="numeric"
                      maxLength={2}
                      className="bg-bg-card border border-bg-border rounded-2xl px-4 py-3 text-text-primary text-base text-center"
                      placeholderTextColor="#525252"
                    />
                  </View>
                  <View className="flex-1 gap-1">
                    <Caption className="text-text-muted text-xs">Ano</Caption>
                    <TextInput
                      value={year}
                      onChangeText={(v) => setYear(v.replace(/\D/g, '').slice(0, 4))}
                      placeholder="AAAA"
                      keyboardType="numeric"
                      maxLength={4}
                      className="bg-bg-card border border-bg-border rounded-2xl px-4 py-3 text-text-primary text-base text-center"
                      placeholderTextColor="#525252"
                    />
                  </View>
                </View>
                {day && month && year && !dateValid && (
                  <Text className="text-red-400 text-xs">
                    Data inválida — verifique o dia, mês e ano.
                  </Text>
                )}
                {dateString && (
                  <Text className="text-brand-green text-xs">
                    ✓ {new Date(dateString + 'T12:00:00').toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </Text>
                )}
              </View>
            )}
          </>
        )}

        {/* Runner level */}
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

        <Button
          title="Continuar"
          size="lg"
          loading={loading}
          disabled={!dateValid}
          onPress={handleNext}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
