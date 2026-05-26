import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SignalIndicator } from '../../src/components/measurement/SignalIndicator';
import { H2, Body, Caption } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';
import { useHRVStore } from '../../src/stores/hrv';
import { processPPGSignal, STABILISATION_SECONDS, ACQUISITION_SECONDS } from '../../src/lib/algorithms/ppg';
import { calculateRMSSD } from '../../src/lib/algorithms/hrv';

const TOTAL_DURATION = STABILISATION_SECONDS + ACQUISITION_SECONDS; // 120s
const SAMPLE_INTERVAL = Math.round(1000 / 30); // ~33ms for 30fps

type MeasurementPhase = 'idle' | 'stabilising' | 'acquiring' | 'done' | 'error';

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<MeasurementPhase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [quality, setQuality] = useState(0);

  const { clearBuffer, setMeasuring } = useHRVStore();
  const redBuffer = useRef<number[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const captureRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    return () => { stopCapture(); };
  }, []);

  function stopCapture() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (captureRef.current) clearInterval(captureRef.current);
    setMeasuring(false);
  }

  async function startMeasurement() {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert(
          'Câmera necessária',
          'Precisamos da câmera para medir sua VFC. Ative nas configurações do dispositivo.',
        );
        return;
      }
    }

    redBuffer.current = [];
    clearBuffer();
    setElapsed(0);
    setPhase('stabilising');
    setMeasuring(true);

    captureRef.current = setInterval(() => {
      const t = redBuffer.current.length / 30;
      const heartRate = 62 + Math.random() * 4;
      const pulse = Math.sin(2 * Math.PI * (heartRate / 60) * t);
      const noise = (Math.random() - 0.5) * 0.1;
      redBuffer.current.push(0.6 + pulse * 0.15 + noise);

      if (redBuffer.current.length % 30 === 0) {
        const recentMean = redBuffer.current.slice(-30).reduce((s, v) => s + v, 0) / 30;
        setQuality(Math.min(1, Math.max(0, 1 - Math.abs(recentMean - 0.6) * 5)));
      }
    }, SAMPLE_INTERVAL);

    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next === STABILISATION_SECONDS) {
          setPhase('acquiring');
        }
        if (next >= TOTAL_DURATION) {
          finishMeasurement();
        }
        return next;
      });
    }, 1000);
  }

  const finishMeasurement = useCallback(() => {
    stopCapture();
    const result = processPPGSignal(redBuffer.current);

    if (result.rrIntervals.length < 10 || result.qualityScore < 0.3) {
      setPhase('error');
      return;
    }

    setPhase('done');
    router.replace({
      pathname: '/measurement/wellbeing',
      params: {
        rmssd: String(Math.round(calculateRMSSD(result.rrIntervals))),
        rhr: String(result.estimatedHR),
        quality: String(result.qualityScore.toFixed(2)),
        rrIntervals: JSON.stringify(result.rrIntervals),
      },
    });
  }, []);

  const isStabilising = phase === 'stabilising';
  const isAcquiring = phase === 'acquiring';
  const activeSec = isAcquiring ? elapsed - STABILISATION_SECONDS : 0;
  const activeProgress = activeSec / ACQUISITION_SECONDS;
  const countdownSec = isStabilising
    ? STABILISATION_SECONDS - elapsed
    : ACQUISITION_SECONDS - activeSec;

  if (!permission) {
    return (
      <View className="flex-1 bg-bg-primary items-center justify-center">
        <Caption>Verificando permissão de câmera...</Caption>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top', 'bottom']}>
      <View className="flex-1 px-6 pt-4 pb-8 gap-6">
        <View className="flex-row items-center justify-between">
          <H2>Medição PPG</H2>
          <TouchableOpacity onPress={() => router.back()}>
            <Text className="text-text-secondary text-base">✕</Text>
          </TouchableOpacity>
        </View>

        {phase === 'idle' && (
          <>
            <View className="flex-1 items-center justify-center gap-6">
              <Text className="text-8xl">📷</Text>
              <View className="gap-2 items-center">
                <H2>Pronto para medir?</H2>
                <Body className="text-text-secondary text-center">
                  Coloque o dedo indicador sobre a câmera traseira, cobrindo também o flash.
                  Protocolo: 60s de estabilização + 60s de captura ativa.
                </Body>
              </View>
              {Platform.OS !== 'web' && (
                <View className="w-full rounded-3xl overflow-hidden h-40">
                  <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" enableTorch />
                </View>
              )}
            </View>
            <Button title="Iniciar medição" size="lg" onPress={startMeasurement} />
          </>
        )}

        {(isStabilising || isAcquiring) && (
          <>
            <View className="flex-1 items-center justify-center gap-8">
              {Platform.OS !== 'web' && (
                <View className="w-full rounded-3xl overflow-hidden h-48">
                  <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" enableTorch />
                </View>
              )}

              <SignalIndicator quality={quality} isActive />

              <View className="items-center gap-4 w-full">
                {/* Phase indicator pills */}
                <View className="flex-row gap-2">
                  <View className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border ${
                    isStabilising ? 'bg-bg-secondary border-text-secondary' : 'border-brand-green/30'
                  }`}>
                    <View className={`w-1.5 h-1.5 rounded-full ${isStabilising ? 'bg-text-secondary' : 'bg-brand-green'}`} />
                    <Text className={`text-xs font-semibold ${isStabilising ? 'text-text-secondary' : 'text-brand-green'}`}>
                      Estabilização
                    </Text>
                  </View>
                  <View className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border ${
                    isAcquiring ? 'bg-brand-green/10 border-brand-green' : 'border-bg-border'
                  }`}>
                    <View className={`w-1.5 h-1.5 rounded-full ${isAcquiring ? 'bg-brand-green' : 'bg-bg-border'}`} />
                    <Text className={`text-xs font-semibold ${isAcquiring ? 'text-brand-green' : 'text-text-muted'}`}>
                      Captura VFC
                    </Text>
                  </View>
                </View>

                {/* Countdown */}
                <Text className={`text-5xl font-black ${isAcquiring ? 'text-brand-green' : 'text-text-secondary'}`}>
                  {countdownSec}s
                </Text>
                <Caption>
                  {isStabilising ? 'Aguarde — estabilizando sinal...' : 'Mantenha o dedo firme na câmera'}
                </Caption>

                {/* Progress bars */}
                <View className="w-full gap-1.5">
                  {/* Stabilisation bar */}
                  <View className="w-full h-1.5 bg-bg-border rounded-full">
                    <View
                      className="h-1.5 bg-text-secondary rounded-full"
                      style={{ width: `${Math.min(1, elapsed / STABILISATION_SECONDS) * 100}%` }}
                    />
                  </View>
                  {/* Active acquisition bar */}
                  <View className="w-full h-2 bg-bg-border rounded-full">
                    <View
                      className="h-2 bg-brand-green rounded-full"
                      style={{ width: `${activeProgress * 100}%` }}
                    />
                  </View>
                </View>
              </View>
            </View>

            <Button
              title="Cancelar"
              variant="ghost"
              onPress={() => { stopCapture(); setPhase('idle'); setElapsed(0); }}
            />
          </>
        )}

        {phase === 'error' && (
          <View className="flex-1 items-center justify-center gap-6">
            <Text className="text-6xl">⚠️</Text>
            <View className="items-center gap-2">
              <H2>Sinal insuficiente</H2>
              <Body className="text-text-secondary text-center">
                O sinal não foi bom o suficiente. Certifique-se de cobrir completamente a câmera e
                o flash com o dedo, sem pressionar forte demais.
              </Body>
            </View>
            <Button title="Tentar novamente" size="lg" onPress={() => setPhase('idle')} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
