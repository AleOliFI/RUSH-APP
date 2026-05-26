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
import { processPPGSignal } from '../../src/lib/algorithms/ppg';

const MEASUREMENT_DURATION = 60; // seconds
const SAMPLE_INTERVAL = Math.round(1000 / 30); // ~33ms for 30fps

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<'idle' | 'measuring' | 'done' | 'error'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [quality, setQuality] = useState(0);

  const { clearBuffer, setMeasuring } = useHRVStore();
  const redBuffer = useRef<number[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const captureRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    return () => {
      stopCapture();
    };
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
    setPhase('measuring');
    setMeasuring(true);

    // Simulate red channel capture (real implementation uses frame processor)
    captureRef.current = setInterval(() => {
      // In production: read actual pixel values from camera frame
      // Simulated realistic PPG signal for development
      const t = redBuffer.current.length / 30;
      const heartRate = 62 + Math.random() * 4;
      const pulse = Math.sin(2 * Math.PI * (heartRate / 60) * t);
      const noise = (Math.random() - 0.5) * 0.1;
      const value = 0.6 + pulse * 0.15 + noise;
      redBuffer.current.push(value);

      // Update signal quality estimate
      if (redBuffer.current.length % 30 === 0) {
        const recentMean =
          redBuffer.current.slice(-30).reduce((s, v) => s + v, 0) / 30;
        const q = Math.min(1, Math.max(0, 1 - Math.abs(recentMean - 0.6) * 5));
        setQuality(q);
      }
    }, SAMPLE_INTERVAL);

    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= MEASUREMENT_DURATION) {
          finishMeasurement();
          return next;
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
        rmssd: result.rrIntervals.length > 0
          ? String(Math.round(calculateRMSSD(result.rrIntervals)))
          : '0',
        rhr: String(result.estimatedHR),
        quality: String(result.qualityScore.toFixed(2)),
        rrIntervals: JSON.stringify(result.rrIntervals),
      },
    });
  }, []);

  const progress = elapsed / MEASUREMENT_DURATION;

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
        {/* Header */}
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
                  Mantenha firme por 60 segundos.
                </Body>
              </View>
              {Platform.OS !== 'web' && (
                <View className="w-full rounded-3xl overflow-hidden h-40">
                  <CameraView
                    ref={cameraRef}
                    style={{ flex: 1 }}
                    facing="back"
                    enableTorch={true}
                  />
                </View>
              )}
            </View>
            <Button title="Iniciar medição" size="lg" onPress={startMeasurement} />
          </>
        )}

        {phase === 'measuring' && (
          <>
            <View className="flex-1 items-center justify-center gap-8">
              {Platform.OS !== 'web' && (
                <View className="w-full rounded-3xl overflow-hidden h-48">
                  <CameraView
                    ref={cameraRef}
                    style={{ flex: 1 }}
                    facing="back"
                    enableTorch={true}
                  />
                </View>
              )}

              <SignalIndicator quality={quality} isActive />

              {/* Progress ring */}
              <View className="items-center gap-2">
                <Text className="text-text-primary text-5xl font-black">
                  {MEASUREMENT_DURATION - elapsed}s
                </Text>
                <Caption>Mantenha o dedo firme na câmera</Caption>
                <View className="w-48 h-2 bg-bg-border rounded-full">
                  <View
                    className="h-2 bg-brand-green rounded-full"
                    style={{ width: `${progress * 100}%` }}
                  />
                </View>
              </View>
            </View>

            <Button
              title="Cancelar"
              variant="ghost"
              onPress={() => {
                stopCapture();
                setPhase('idle');
              }}
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
                o flash com o dedo.
              </Body>
            </View>
            <Button title="Tentar novamente" size="lg" onPress={() => setPhase('idle')} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function calculateRMSSD(rr: number[]): number {
  if (rr.length < 2) return 0;
  const diffs = [];
  for (let i = 1; i < rr.length; i++) {
    diffs.push((rr[i] - rr[i - 1]) ** 2);
  }
  return Math.sqrt(diffs.reduce((s, v) => s + v, 0) / diffs.length);
}
