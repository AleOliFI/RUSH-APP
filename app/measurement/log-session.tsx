import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { H2, Body, Caption, Label } from '../../src/components/ui/Typography';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/stores/auth';
import { localToday } from '../../src/lib/dates';

type SessionType = 'easy' | 'tempo' | 'interval' | 'long_run' | 'race' | 'cross_training' | 'rest';

const SESSION_TYPES: { key: SessionType; label: string; icon: string }[] = [
  { key: 'easy', label: 'Leve / Z2', icon: '🟢' },
  { key: 'tempo', label: 'Tempo / Z3', icon: '🟡' },
  { key: 'interval', label: 'Intervalado', icon: '🔴' },
  { key: 'long_run', label: 'Longo', icon: '🔵' },
  { key: 'race', label: 'Prova', icon: '🏆' },
  { key: 'cross_training', label: 'Cross Training', icon: '💪' },
  { key: 'rest', label: 'Repouso', icon: '😴' },
];

/** Banister TRIMP estimate: duration × (avg_hr / hrMax) × exp(y × avg_hr / hrMax) */
function estimateTRIMP(
  durationMin: number,
  avgHR: number,
  maxHR: number,
  gender: 'male' | 'female' | 'other',
): number {
  if (durationMin <= 0 || avgHR <= 0 || maxHR <= 0) return 0;
  const y = gender === 'female' ? 1.67 : 1.92;
  const ratio = avgHR / maxHR;
  return Math.round(durationMin * ratio * Math.exp(y * ratio));
}

export default function LogSessionScreen() {
  const { user, profile } = useAuthStore();
  const queryClient = useQueryClient();
  const [sessionType, setSessionType] = useState<SessionType>('easy');
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [avgHR, setAvgHR] = useState('');
  const [maxHR, setMaxHR] = useState('190');
  const [loading, setLoading] = useState(false);

  const durationNum = parseInt(duration, 10) || 0;
  const avgHRNum = parseInt(avgHR, 10) || 0;
  const maxHRNum = parseInt(maxHR, 10) || 190;
  const gender = profile?.gender ?? 'male';
  const trimp = estimateTRIMP(durationNum, avgHRNum, maxHRNum, gender as any);

  async function handleSave() {
    if (!user) return;
    if (!duration) {
      Alert.alert('Duração obrigatória', 'Informe a duração do treino em minutos.');
      return;
    }
    setLoading(true);
    try {
      const today = localToday();
      const { error } = await supabase.from('training_sessions').insert({
        user_id: user.id,
        session_date: today,
        session_type: sessionType,
        distance_km: distance ? parseFloat(distance) : null,
        duration_minutes: durationNum,
        avg_heart_rate: avgHRNum || null,
        max_heart_rate: maxHRNum || null,
        trimp_score: trimp > 0 ? trimp : null,
        source: 'manual',
        external_id: `manual-${today}-${Date.now()}`,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['readiness'] });
      queryClient.invalidateQueries({ queryKey: ['readiness-history'] });
      queryClient.invalidateQueries({ queryKey: ['hrv-history'] });
      router.back();
    } catch (e) {
      console.error('Error saving session:', e);
      Alert.alert('Erro', 'Não foi possível salvar o treino. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <SafeAreaView className="flex-1 bg-bg-primary" edges={['top', 'bottom']}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pt-4 pb-8 gap-5"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-row items-center justify-between">
            <H2>Registrar treino</H2>
            <TouchableOpacity onPress={() => router.back()}>
              <Text className="text-text-secondary text-base">✕</Text>
            </TouchableOpacity>
          </View>

          {/* Session type */}
          <Card className="gap-3">
            <Label>Tipo de sessão</Label>
            <View className="flex-row flex-wrap gap-2">
              {SESSION_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => setSessionType(t.key)}
                  className={`flex-row items-center gap-1.5 px-3 py-2 rounded-2xl border ${
                    sessionType === t.key
                      ? 'bg-brand-green/10 border-brand-green'
                      : 'bg-bg-secondary border-bg-border'
                  }`}
                  activeOpacity={0.7}
                >
                  <Text className="text-sm">{t.icon}</Text>
                  <Text
                    className={`text-sm font-medium ${
                      sessionType === t.key ? 'text-brand-green' : 'text-text-secondary'
                    }`}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          {/* Metrics */}
          {sessionType !== 'rest' && (
            <Card className="gap-4">
              <Label>Métricas</Label>
              <View className="flex-row gap-3">
                <View className="flex-1 gap-1.5">
                  <Caption className="text-text-muted text-xs uppercase tracking-wide">
                    Duração (min) *
                  </Caption>
                  <TextInput
                    value={duration}
                    onChangeText={(v) => setDuration(v.replace(/\D/g, ''))}
                    placeholder="45"
                    keyboardType="numeric"
                    className="bg-bg-secondary border border-bg-border rounded-2xl px-4 py-3 text-text-primary text-base"
                    placeholderTextColor="#525252"
                  />
                </View>
                <View className="flex-1 gap-1.5">
                  <Caption className="text-text-muted text-xs uppercase tracking-wide">
                    Distância (km)
                  </Caption>
                  <TextInput
                    value={distance}
                    onChangeText={(v) => setDistance(v.replace(/[^\d.]/g, ''))}
                    placeholder="10.5"
                    keyboardType="decimal-pad"
                    className="bg-bg-secondary border border-bg-border rounded-2xl px-4 py-3 text-text-primary text-base"
                    placeholderTextColor="#525252"
                  />
                </View>
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1 gap-1.5">
                  <Caption className="text-text-muted text-xs uppercase tracking-wide">
                    FC média (bpm)
                  </Caption>
                  <TextInput
                    value={avgHR}
                    onChangeText={(v) => setAvgHR(v.replace(/\D/g, ''))}
                    placeholder="145"
                    keyboardType="numeric"
                    className="bg-bg-secondary border border-bg-border rounded-2xl px-4 py-3 text-text-primary text-base"
                    placeholderTextColor="#525252"
                  />
                </View>
                <View className="flex-1 gap-1.5">
                  <Caption className="text-text-muted text-xs uppercase tracking-wide">
                    FC máx (bpm)
                  </Caption>
                  <TextInput
                    value={maxHR}
                    onChangeText={(v) => setMaxHR(v.replace(/\D/g, ''))}
                    placeholder="190"
                    keyboardType="numeric"
                    className="bg-bg-secondary border border-bg-border rounded-2xl px-4 py-3 text-text-primary text-base"
                    placeholderTextColor="#525252"
                  />
                </View>
              </View>
            </Card>
          )}

          {/* TRIMP preview */}
          {trimp > 0 && (
            <View className="bg-brand-green/8 border border-brand-green/20 rounded-2xl px-4 py-3 flex-row items-center justify-between">
              <View>
                <Text className="text-brand-green font-semibold text-sm">TRIMP estimado</Text>
                <Caption className="text-xs">
                  Carga de treino (Banister · {gender === 'female' ? 'y=1.67' : 'y=1.92'})
                </Caption>
              </View>
              <Text className="text-brand-green font-black text-2xl">{trimp}</Text>
            </View>
          )}

          {trimp >= 200 && (
            <View className="bg-orange-500/10 border border-orange-500/30 rounded-2xl px-4 py-3">
              <Text className="text-orange-400 text-xs font-semibold">
                ⚠ Carga alta — TRIMP ≥ 200 aciona a deteção de estresse catabólico T:C.
              </Text>
            </View>
          )}

          <Button
            title={loading ? 'Salvando...' : 'Salvar treino'}
            size="lg"
            loading={loading}
            onPress={handleSave}
          />
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
