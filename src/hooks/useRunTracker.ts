// ============================================================
// RUSH RUNNING — Rastreamento real de corrida
// ------------------------------------------------------------
// Distância por GNSS (Geolocation API) com fórmula de Haversine e
// filtragem de ruído, cronômetro pausável, pace instantâneo e médio,
// voltas, e frequência cardíaca ao vivo de uma cinta BLE (GATT 0x180D)
// quando o atleta conecta uma.
//
// Métricas que o navegador NÃO expõe (cadência, potência, contagem de
// satélites) não são estimadas: ficam nulas e a interface mostra "—".
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';

export type RunStage = 'idle' | 'acquiring' | 'ready' | 'running' | 'paused' | 'finished' | 'error';

export interface RunLap {
  index: number;
  distanceKm: number;
  durationSeconds: number;
  avgPace: string;
}

export interface RunTrackPoint {
  lat: number;
  lon: number;
  timestamp: number;
  accuracy: number;
  /** Altitude do GNSS em metros. Null quando o aparelho não a reporta. */
  altitude: number | null;
}

/** Precisão pior que isto (metros) é descartada. */
const MAX_ACCURACY_M = 35;
/** Velocidade acima disto (m/s) indica salto de GPS, não corrida. */
const MAX_PLAUSIBLE_SPEED_MS = 9;
/** Janela usada para o pace instantâneo. */
const INSTANT_PACE_WINDOW_MS = 30000;

function haversineMeters(a: RunTrackPoint, b: RunTrackPoint): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function formatPaceMinKm(secondsPerKm: number | null): string {
  if (secondsPerKm == null || !isFinite(secondsPerKm) || secondsPerKm <= 0 || secondsPerKm > 3600) return '—';
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export interface RunTrackerState {
  stage: RunStage;
  distanceKm: number;
  elapsedSeconds: number;
  instantPace: string;
  avgPace: string;
  gpsAccuracyM: number | null;
  heartRate: number | null;
  maxHeartRate: number | null;
  hrDeviceName: string | null;
  laps: RunLap[];
  errorMessage: string | null;
  track: RunTrackPoint[];
  isBleSupported: boolean;
  prepare: () => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  lap: () => void;
  finish: () => RunSummary;
  reset: () => void;
  connectHeartRate: () => Promise<void>;
}

export interface HrSample {
  /** Segundos decorridos desde a largada. */
  t: number;
  bpm: number;
}

export interface RunSummary {
  distanceKm: number;
  durationSeconds: number;
  avgPace: string;
  avgHr: number | null;
  maxHr: number | null;
  laps: RunLap[];
  track: RunTrackPoint[];
  hrSamples: HrSample[];
  startedAt: string;
}

export function useRunTracker(): RunTrackerState {
  const [stage, setStage] = useState<RunStage>('idle');
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [gpsAccuracyM, setGpsAccuracyM] = useState<number | null>(null);
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [maxHeartRate, setMaxHeartRate] = useState<number | null>(null);
  const [hrDeviceName, setHrDeviceName] = useState<string | null>(null);
  const [laps, setLaps] = useState<RunLap[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [track, setTrack] = useState<RunTrackPoint[]>([]);
  const [instantPaceSeconds, setInstantPaceSeconds] = useState<number | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPointRef = useRef<RunTrackPoint | null>(null);
  const stageRef = useRef<RunStage>('idle');
  const distanceRef = useRef(0);
  const elapsedRef = useRef(0);
  const lapStartRef = useRef({ distance: 0, elapsed: 0 });
  const recentRef = useRef<{ t: number; d: number }[]>([]);
  const hrSamplesRef = useRef<HrSample[]>([]);
  const startedAtRef = useRef<string | null>(null);
  const bleDeviceRef = useRef<any>(null);
  const bleCharRef = useRef<any>(null);

  const isBleSupported = typeof navigator !== 'undefined' && 'bluetooth' in navigator;

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  /* ----------------------- GNSS ----------------------- */

  const handlePosition = useCallback((position: GeolocationPosition) => {
    const point: RunTrackPoint = {
      lat: position.coords.latitude,
      lon: position.coords.longitude,
      timestamp: position.timestamp,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude ?? null,
    };

    setGpsAccuracyM(Math.round(point.accuracy));

    if (point.accuracy > MAX_ACCURACY_M) return;

    if (stageRef.current === 'acquiring') {
      setStage('ready');
    }

    const previous = lastPointRef.current;
    lastPointRef.current = point;

    if (stageRef.current !== 'running' || !previous) return;

    const meters = haversineMeters(previous, point);
    const seconds = (point.timestamp - previous.timestamp) / 1000;
    if (seconds <= 0) return;

    // Descarta saltos de GPS e ruído de posição parada.
    const speed = meters / seconds;
    if (speed > MAX_PLAUSIBLE_SPEED_MS) return;
    if (meters < Math.max(point.accuracy * 0.5, 2)) return;

    distanceRef.current += meters;
    setDistanceMeters(distanceRef.current);
    setTrack((prev) => [...prev, point]);

    recentRef.current.push({ t: point.timestamp, d: meters });
    const cutoff = point.timestamp - INSTANT_PACE_WINDOW_MS;
    recentRef.current = recentRef.current.filter((s) => s.t >= cutoff);

    const windowMeters = recentRef.current.reduce((sum, s) => sum + s.d, 0);
    const windowSeconds = recentRef.current.length
      ? (point.timestamp - recentRef.current[0].t) / 1000
      : 0;
    setInstantPaceSeconds(
      windowMeters > 20 && windowSeconds > 5 ? (windowSeconds / windowMeters) * 1000 : null,
    );
  }, []);

  const handlePositionError = useCallback((err: GeolocationPositionError) => {
    const messages: Record<number, string> = {
      1: 'Permissão de localização negada. Autorize o acesso ao GPS para medir a distância.',
      2: 'Sinal de GNSS indisponível. Vá para uma área aberta e tente novamente.',
      3: 'Tempo esgotado ao obter a posição. Verifique o GPS do aparelho.',
    };
    setErrorMessage(messages[err.code] || 'Não foi possível obter a localização.');
    if (stageRef.current === 'acquiring') setStage('error');
  }, []);

  const startWatching = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setErrorMessage('Este navegador não expõe a API de geolocalização.');
      setStage('error');
      return;
    }
    if (watchIdRef.current != null) return;

    watchIdRef.current = navigator.geolocation.watchPosition(handlePosition, handlePositionError, {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 20000,
    });
  }, [handlePosition, handlePositionError]);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  /* ----------------------- cronômetro ----------------------- */

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsedSeconds(elapsedRef.current);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /* ----------------------- cinta cardíaca ----------------------- */

  const connectHeartRate = useCallback(async () => {
    const nav: any = navigator;
    if (!nav.bluetooth) {
      setErrorMessage('Web Bluetooth indisponível neste navegador.');
      return;
    }

    try {
      const device = await nav.bluetooth.requestDevice({
        filters: [{ services: ['heart_rate'] }],
      });
      bleDeviceRef.current = device;
      setHrDeviceName(device.name || 'Cinta Cardíaca');

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService('heart_rate');
      const characteristic = await service.getCharacteristic('heart_rate_measurement');
      bleCharRef.current = characteristic;

      characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
        const value: DataView = event.target.value;
        if (!value || value.byteLength < 2) return;
        const flags = value.getUint8(0);
        const bpm = (flags & 0x01) !== 0 ? value.getUint16(1, true) : value.getUint8(1);
        if (bpm > 30 && bpm < 240) {
          setHeartRate(bpm);
          setMaxHeartRate((prev) => (prev == null ? bpm : Math.max(prev, bpm)));
          hrSamplesRef.current.push({ t: elapsedRef.current, bpm });
        }
      });
      await characteristic.startNotifications();
    } catch (err: any) {
      if (err?.name !== 'NotFoundError') {
        setErrorMessage(`Não foi possível conectar a cinta: ${err?.message || 'tente novamente.'}`);
      }
    }
  }, []);

  const disconnectHeartRate = useCallback(() => {
    try {
      bleCharRef.current?.stopNotifications?.();
    } catch {
      /* já desconectado */
    }
    if (bleDeviceRef.current?.gatt?.connected) {
      try {
        bleDeviceRef.current.gatt.disconnect();
      } catch {
        /* ignorado */
      }
    }
    bleCharRef.current = null;
    bleDeviceRef.current = null;
  }, []);

  /* ----------------------- controles ----------------------- */

  const prepare = useCallback(() => {
    setErrorMessage(null);
    setStage('acquiring');
    startWatching();
  }, [startWatching]);

  const start = useCallback(() => {
    setErrorMessage(null);
    distanceRef.current = 0;
    elapsedRef.current = 0;
    lapStartRef.current = { distance: 0, elapsed: 0 };
    recentRef.current = [];
    hrSamplesRef.current = [];
    startedAtRef.current = new Date().toISOString();
    lastPointRef.current = null;
    setDistanceMeters(0);
    setElapsedSeconds(0);
    setLaps([]);
    setTrack([]);
    setStage('running');
    startWatching();
    startTimer();
  }, [startWatching, startTimer]);

  const pause = useCallback(() => {
    setStage('paused');
    stopTimer();
    // Zera a referência para o trecho pausado não virar distância.
    lastPointRef.current = null;
  }, [stopTimer]);

  const resume = useCallback(() => {
    setStage('running');
    startTimer();
  }, [startTimer]);

  const lap = useCallback(() => {
    const lapDistanceKm = (distanceRef.current - lapStartRef.current.distance) / 1000;
    const lapSeconds = elapsedRef.current - lapStartRef.current.elapsed;
    lapStartRef.current = { distance: distanceRef.current, elapsed: elapsedRef.current };

    setLaps((prev) => [
      ...prev,
      {
        index: prev.length + 1,
        distanceKm: +lapDistanceKm.toFixed(3),
        durationSeconds: lapSeconds,
        avgPace: formatPaceMinKm(lapDistanceKm > 0 ? lapSeconds / lapDistanceKm : null),
      },
    ]);
  }, []);

  const finish = useCallback((): RunSummary => {
    stopTimer();
    stopWatching();
    disconnectHeartRate();
    setStage('finished');

    const distanceKm = +(distanceRef.current / 1000).toFixed(3);
    const durationSeconds = elapsedRef.current;
    const samples = hrSamplesRef.current;
    const bpms = samples.map((s) => s.bpm);

    return {
      distanceKm,
      durationSeconds,
      avgPace: formatPaceMinKm(distanceKm > 0 ? durationSeconds / distanceKm : null),
      avgHr: bpms.length ? Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length) : null,
      maxHr: bpms.length ? Math.max(...bpms) : null,
      laps,
      track,
      hrSamples: samples,
      startedAt: startedAtRef.current || new Date().toISOString(),
    };
  }, [stopTimer, stopWatching, disconnectHeartRate, laps, track]);

  const reset = useCallback(() => {
    stopTimer();
    stopWatching();
    disconnectHeartRate();
    distanceRef.current = 0;
    elapsedRef.current = 0;
    lapStartRef.current = { distance: 0, elapsed: 0 };
    recentRef.current = [];
    hrSamplesRef.current = [];
    lastPointRef.current = null;
    setStage('idle');
    setDistanceMeters(0);
    setElapsedSeconds(0);
    setLaps([]);
    setTrack([]);
    setHeartRate(null);
    setMaxHeartRate(null);
    setHrDeviceName(null);
    setGpsAccuracyM(null);
    setInstantPaceSeconds(null);
    setErrorMessage(null);
  }, [stopTimer, stopWatching, disconnectHeartRate]);

  useEffect(
    () => () => {
      stopTimer();
      stopWatching();
      disconnectHeartRate();
    },
    [stopTimer, stopWatching, disconnectHeartRate],
  );

  const distanceKm = distanceMeters / 1000;

  return {
    stage,
    distanceKm,
    elapsedSeconds,
    instantPace: formatPaceMinKm(instantPaceSeconds),
    avgPace: formatPaceMinKm(distanceKm > 0.05 ? elapsedSeconds / distanceKm : null),
    gpsAccuracyM,
    heartRate,
    maxHeartRate,
    hrDeviceName,
    laps,
    errorMessage,
    track,
    isBleSupported,
    prepare,
    start,
    pause,
    resume,
    lap,
    finish,
    reset,
    connectHeartRate,
  };
}
