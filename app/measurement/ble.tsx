import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { H2, Body, Caption } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { useBleHeartRate, ACQUISITION_SECONDS } from '../../src/hooks/useBleHeartRate';
import {
  RR_MAX_ARTEFACT_RATE,
  calculateRMSSD,
  filterRRArtefacts,
} from '../../src/lib/algorithms/hrv';

/** Mínimo de intervalos, já filtrados, para um RMSSD confiável. */
const MIN_ACCEPTED_INTERVALS = 20;

export default function BleMeasurementScreen() {
  const {
    stage,
    devices,
    heartRate,
    contact,
    beatCount,
    elapsed,
    error,
    rrUnsupported,
    startScan,
    measure,
    reset,
  } = useBleHeartRate();

  const [rejection, setRejection] = useState<string | null>(null);

  const handleFinish = useCallback((rr: number[]) => {
    // Filtrar antes de calcular não é refinamento: o RMSSD eleva ao quadrado a
    // diferença entre batimentos, então um único batimento perdido — que cabe
    // na faixa fisiológica e passa pelo isPlausibleRR — pode dobrar o valor e
    // devolver uma prescrição de alta intensidade a quem deveria descansar.
    const { accepted, artefactRate } = filterRRArtefacts(rr);

    if (accepted.length < MIN_ACCEPTED_INTERVALS) {
      setRejection(
        `Foram aproveitados apenas ${accepted.length} intervalos. É preciso um sinal estável para calcular a VFC com confiança.`,
      );
      return;
    }

    if (artefactRate > RR_MAX_ARTEFACT_RATE) {
      setRejection(
        `${Math.round(artefactRate * 100)}% dos batimentos foram descartados por irregularidade. Ajuste a cinta, umedeça os eletrodos e meça novamente em repouso.`,
      );
      return;
    }

    const meanRr = accepted.reduce((s, v) => s + v, 0) / accepted.length;

    router.replace({
      pathname: '/measurement/wellbeing',
      params: {
        rmssd: String(Math.round(calculateRMSSD(accepted))),
        rhr: String(Math.round(60000 / meanRr)),
        // A qualidade agora reflete quanto do sinal era limpo. Antes era
        // rr.length/45, que media só a quantidade e era cega a artefato.
        quality: (1 - artefactRate).toFixed(2),
        rrIntervals: JSON.stringify(accepted),
        metric: 'rmssd',
        method: 'ble_hrm',
      },
    });
  }, []);

  const retry = useCallback(() => {
    setRejection(null);
    reset();
  }, [reset]);

  // BLE is a native module; on web the manager throws as soon as it is built.
  if (Platform.OS === 'web') {
    return (
      <SafeAreaView className="flex-1 bg-bg-primary" edges={['top', 'bottom']}>
        <View className="flex-1 items-center justify-center px-8 gap-4">
          <Text className="text-5xl">📱</Text>
          <H2>Disponível no aplicativo</H2>
          <Body className="text-text-secondary text-center">
            A medição por Bluetooth precisa do app instalado no celular — navegadores não
            acessam sensores BLE.
          </Body>
          <Button title="Voltar" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const remaining = ACQUISITION_SECONDS - elapsed;
  const progress = elapsed / ACQUISITION_SECONDS;

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top', 'bottom']}>
      <View className="flex-1 px-6 pt-4 pb-8 gap-6">
        <View className="flex-row items-center justify-between">
          <H2>Medição VFC</H2>
          <TouchableOpacity onPress={() => router.back()}>
            <Text className="text-text-secondary text-base">✕</Text>
          </TouchableOpacity>
        </View>

        {stage === 'idle' && (
          <>
            <View className="flex-1 items-center justify-center gap-6">
              <Text className="text-7xl">⌚</Text>
              <View className="gap-2 items-center">
                <H2>Conecte seu sensor</H2>
                <Body className="text-text-secondary text-center">
                  Ligue sua cinta peitoral ou relógio em modo de transmissão e mantenha o
                  Bluetooth ativo. A medição leva {ACQUISITION_SECONDS}s em repouso.
                </Body>
              </View>
              <Card className="w-full gap-1">
                <Caption className="text-text-secondary text-xs">
                  Cintas peitorais (Polar H10, Garmin HRM, Wahoo) transmitem os intervalos
                  entre batimentos, que é o que a VFC precisa. Relógios que enviam apenas
                  os BPM não conseguem calcular a variabilidade.
                </Caption>
              </Card>
            </View>
            <Button title="Procurar dispositivos" size="lg" onPress={startScan} />
          </>
        )}

        {stage === 'scanning' && (
          <>
            <View className="flex-1 gap-4">
              <View className="flex-row items-center gap-3">
                <ActivityIndicator color="#22C55E" />
                <Caption>Procurando dispositivos...</Caption>
              </View>
              <ScrollView className="flex-1" contentContainerClassName="gap-2">
                {devices.map((d) => (
                  <TouchableOpacity key={d.id} onPress={() => measure(d.id, handleFinish)}>
                    <Card className="flex-row items-center justify-between">
                      <View className="flex-1 gap-0.5">
                        <Text className="text-text-primary font-semibold">{d.name}</Text>
                        <Caption className="text-xs">{d.id}</Caption>
                      </View>
                      <Text className="text-text-muted">›</Text>
                    </Card>
                  </TouchableOpacity>
                ))}
                {devices.length === 0 && (
                  <Caption className="text-center py-8">
                    Nenhum dispositivo ainda. Verifique se o sensor está ligado e próximo.
                  </Caption>
                )}
              </ScrollView>
            </View>
            <Button title="Cancelar" variant="ghost" onPress={reset} />
          </>
        )}

        {stage === 'connecting' && (
          <View className="flex-1 items-center justify-center gap-4">
            <ActivityIndicator color="#22C55E" size="large" />
            <Caption>Conectando...</Caption>
          </View>
        )}

        {stage === 'measuring' && (
          <>
            <View className="flex-1 items-center justify-center gap-8">
              <View className="items-center gap-1">
                <Text className="text-6xl font-black text-brand-green">{heartRate || '--'}</Text>
                <Caption>bpm</Caption>
              </View>

              {contact === 'no_contact' && (
                <View className="bg-yellow-500/15 border border-yellow-500/40 rounded-2xl px-4 py-3">
                  <Text className="text-yellow-400 text-sm font-semibold">
                    ⚠ Sensor sem contato com a pele
                  </Text>
                  <Text className="text-yellow-300/80 text-xs mt-1">
                    Ajuste a cinta e umedeça os eletrodos.
                  </Text>
                </View>
              )}

              {rrUnsupported && (
                <View className="bg-rush-red/15 border border-rush-red/40 rounded-2xl px-4 py-3">
                  <Text className="text-rush-red text-sm font-semibold">
                    Este dispositivo não envia intervalos entre batimentos
                  </Text>
                  <Text className="text-red-300/80 text-xs mt-1">
                    Ele transmite apenas os BPM, o que não permite calcular a VFC. Use uma
                    cinta peitoral.
                  </Text>
                </View>
              )}

              <View className="items-center gap-3 w-full">
                <Text className="text-4xl font-black text-text-primary">{remaining}s</Text>
                <Caption>{beatCount} batimentos captados</Caption>
                <View className="w-full h-2 bg-bg-border rounded-full">
                  <View
                    className="h-2 bg-brand-green rounded-full"
                    style={{ width: `${progress * 100}%` }}
                  />
                </View>
              </View>
            </View>
            <Button title="Cancelar" variant="ghost" onPress={reset} />
          </>
        )}

        {stage === 'error' && (
          <View className="flex-1 items-center justify-center gap-6">
            <Text className="text-6xl">⚠️</Text>
            <View className="items-center gap-2">
              <H2>Não foi possível medir</H2>
              <Body className="text-text-secondary text-center">
                {error ?? 'Verifique se o Bluetooth está ligado e o sensor próximo.'}
              </Body>
            </View>
            <Button title="Tentar novamente" size="lg" onPress={reset} />
          </View>
        )}

        {stage === 'done' && rejection && (
          <View className="flex-1 items-center justify-center gap-6">
            <Text className="text-6xl">⚠️</Text>
            <View className="items-center gap-2">
              <H2>Sinal insuficiente</H2>
              <Body className="text-text-secondary text-center">{rejection}</Body>
            </View>
            <Button title="Tentar novamente" size="lg" onPress={retry} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
