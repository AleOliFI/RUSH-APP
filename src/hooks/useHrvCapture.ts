// ============================================================
// RUSH RUNNING — Captura real de VFC (RMSSD)
// ------------------------------------------------------------
// Duas fontes de sinal, ambas reais:
//
//  1. CÂMERA (PPG) — fotopletismografia por absorção de luz capilar.
//     Referências: Altini & Amft (2016), HRV4Training; Plews et al. (2013),
//     que reportam correlação alta entre PPG de smartphone e ECG.
//
//  2. SENSOR BLE — Heart Rate Service GATT 0x180D / característica 0x2A37,
//     lendo os intervalos R-R brutos quando a cinta os expõe (Polar H10,
//     Garmin, Wahoo). É a fonte de maior precisão.
//
// Em ambos os casos o RMSSD é calculado a partir dos intervalos R-R:
//     RMSSD = sqrt( (1/(N-1)) * Σ (RR[i+1] - RR[i])² )
//
// Quando o sinal não tem qualidade suficiente a captura FALHA com uma
// mensagem clara. Este módulo nunca inventa um valor fisiológico.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';

export type CaptureSource = 'camera' | 'ble';
export type CapturePhase = 'idle' | 'connecting' | 'capturing' | 'done' | 'error';

export interface HrvCaptureResult {
  rmssd_ms: number;
  lnrmssd: number;
  hr_rest_bpm: number;
  rr_count: number;
  duration_seconds: number;
  source: CaptureSource;
  device_name: string | null;
  quality: 'alta' | 'media';
}

export const CAPTURE_DURATION_SECONDS = 60;

/** Faixa fisiologicamente plausível para um intervalo R-R em repouso (ms). */
const RR_MIN_MS = 350;
const RR_MAX_MS = 1800;

/** Mínimo de intervalos válidos para que o RMSSD seja reportável. */
const MIN_RR_FOR_RESULT = 20;
const MIN_RR_FOR_HIGH_QUALITY = 45;

/**
 * RMSSD a partir de uma série de intervalos R-R em milissegundos.
 * Retorna null quando não há amostras suficientes.
 */
export function computeRmssd(rrIntervals: number[]): number | null {
  const clean = rrIntervals.filter((rr) => rr >= RR_MIN_MS && rr <= RR_MAX_MS);
  if (clean.length < MIN_RR_FOR_RESULT) return null;

  let sumSquaredDiffs = 0;
  for (let i = 1; i < clean.length; i++) {
    const diff = clean[i] - clean[i - 1];
    sumSquaredDiffs += diff * diff;
  }

  const rmssd = Math.sqrt(sumSquaredDiffs / (clean.length - 1));
  if (!isFinite(rmssd) || rmssd <= 0) return null;
  return Math.round(rmssd);
}

/** Frequência cardíaca média derivada dos intervalos R-R. */
export function bpmFromRr(rrIntervals: number[]): number | null {
  const clean = rrIntervals.filter((rr) => rr >= RR_MIN_MS && rr <= RR_MAX_MS);
  if (!clean.length) return null;
  const avgRr = clean.reduce((a, b) => a + b, 0) / clean.length;
  return Math.round(60000 / avgRr);
}

export interface UseHrvCapture {
  phase: CapturePhase;
  source: CaptureSource | null;
  secondsRemaining: number;
  liveBpm: number | null;
  rrCount: number;
  signalOk: boolean;
  deviceName: string | null;
  errorMessage: string | null;
  result: HrvCaptureResult | null;
  waveform: number[];
  videoRef: React.RefObject<HTMLVideoElement | null>;
  startCamera: () => Promise<void>;
  startBle: () => Promise<void>;
  cancel: () => void;
  reset: () => void;
  isBleSupported: boolean;
}

export function useHrvCapture(): UseHrvCapture {
  const [phase, setPhase] = useState<CapturePhase>('idle');
  const [source, setSource] = useState<CaptureSource | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(CAPTURE_DURATION_SECONDS);
  const [liveBpm, setLiveBpm] = useState<number | null>(null);
  const [rrCount, setRrCount] = useState(0);
  const [signalOk, setSignalOk] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<HrvCaptureResult | null>(null);
  const [waveform, setWaveform] = useState<number[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rrRef = useRef<number[]>([]);
  const peaksRef = useRef<number[]>([]);
  const samplesRef = useRef<{ time: number; val: number }[]>([]);
  const bleDeviceRef = useRef<any>(null);
  const bleCharRef = useRef<any>(null);
  const activeRef = useRef(false);

  const isBleSupported = typeof navigator !== 'undefined' && 'bluetooth' in navigator;

  /* ---------------- limpeza ---------------- */

  const teardown = useCallback(() => {
    activeRef.current = false;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (bleCharRef.current) {
      try {
        bleCharRef.current.stopNotifications?.();
      } catch {
        /* dispositivo já desconectado */
      }
      bleCharRef.current = null;
    }
    if (bleDeviceRef.current?.gatt?.connected) {
      try {
        bleDeviceRef.current.gatt.disconnect();
      } catch {
        /* ignorado */
      }
    }
    bleDeviceRef.current = null;
  }, []);

  useEffect(() => teardown, [teardown]);

  const reset = useCallback(() => {
    teardown();
    rrRef.current = [];
    peaksRef.current = [];
    samplesRef.current = [];
    setPhase('idle');
    setSource(null);
    setSecondsRemaining(CAPTURE_DURATION_SECONDS);
    setLiveBpm(null);
    setRrCount(0);
    setSignalOk(false);
    setDeviceName(null);
    setErrorMessage(null);
    setResult(null);
    setWaveform([]);
  }, [teardown]);

  const cancel = useCallback(() => {
    teardown();
    setPhase('idle');
    setSecondsRemaining(CAPTURE_DURATION_SECONDS);
  }, [teardown]);

  /* ---------------- finalização comum ---------------- */

  const finish = useCallback(
    (capturedSource: CaptureSource, device: string | null) => {
      teardown();

      const rr = rrRef.current;
      const rmssd = computeRmssd(rr);
      const bpm = bpmFromRr(rr);

      if (rmssd == null || bpm == null) {
        setPhase('error');
        setErrorMessage(
          `Sinal insuficiente: apenas ${rr.length} intervalos R-R válidos foram captados (mínimo ${MIN_RR_FOR_RESULT}). ` +
            'Refaça a medição em repouso absoluto ou informe os valores manualmente.',
        );
        return;
      }

      // O backend valida RMSSD entre 10 e 200 ms e FC entre 30 e 120 bpm.
      if (rmssd < 10 || rmssd > 200 || bpm < 30 || bpm > 120) {
        setPhase('error');
        setErrorMessage(
          `Resultado fora da faixa fisiológica esperada em repouso (RMSSD ${rmssd} ms, FC ${bpm} bpm). ` +
            'Refaça a medição deitado ou sentado, sem falar nem se mover.',
        );
        return;
      }

      setResult({
        rmssd_ms: rmssd,
        lnrmssd: +Math.log(rmssd).toFixed(4),
        hr_rest_bpm: bpm,
        rr_count: rr.length,
        duration_seconds: CAPTURE_DURATION_SECONDS,
        source: capturedSource,
        device_name: device,
        quality: rr.length >= MIN_RR_FOR_HIGH_QUALITY ? 'alta' : 'media',
      });
      setPhase('done');
    },
    [teardown],
  );

  /* ---------------- fonte 1: câmera (PPG) ---------------- */

  const startCamera = useCallback(async () => {
    reset();
    setSource('camera');
    setPhase('connecting');

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setPhase('error');
      setErrorMessage('Este navegador não expõe acesso à câmera. Use um sensor BLE ou a entrada manual.');
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 320 }, height: { ideal: 240 } },
      });
    } catch {
      setPhase('error');
      setErrorMessage(
        'Não foi possível acessar a câmera traseira. Autorize o acesso à câmera ou informe os valores manualmente.',
      );
      return;
    }

    streamRef.current = stream;
    activeRef.current = true;

    // Liga a lanterna quando o dispositivo suporta — melhora muito o sinal PPG.
    const track = stream.getVideoTracks()[0];
    const capabilities: any = track.getCapabilities?.();
    if (capabilities?.torch) {
      try {
        await track.applyConstraints({ advanced: [{ torch: true } as any] });
      } catch {
        /* lanterna indisponível */
      }
    }

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      try {
        await videoRef.current.play();
      } catch {
        /* autoplay bloqueado: o loop trata readyState */
      }
    }

    setPhase('capturing');
    setSecondsRemaining(CAPTURE_DURATION_SECONDS);

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 48;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // O cronômetro só avança enquanto o dedo estiver cobrindo a lente.
    let elapsedMs = 0;
    let lastTick = performance.now();

    const processFrame = () => {
      if (!activeRef.current) return;

      const video = videoRef.current;
      if (!ctx || !video || video.readyState !== 4) {
        rafRef.current = requestAnimationFrame(processFrame);
        return;
      }

      ctx.drawImage(video, 0, 0, 64, 48);
      const { data } = ctx.getImageData(0, 0, 64, 48);

      let red = 0;
      let green = 0;
      let blue = 0;
      const pixels = 64 * 48;
      for (let i = 0; i < data.length; i += 4) {
        red += data[i];
        green += data[i + 1];
        blue += data[i + 2];
      }
      const avgRed = red / pixels;
      const avgGreen = green / pixels;
      const avgBlue = blue / pixels;

      // Dedo sobre lente + flash: o canal vermelho domina fortemente.
      const covering = avgRed > 60 && avgRed > avgGreen * 1.3 && avgRed > avgBlue * 1.5;
      setSignalOk(covering);

      const now = performance.now();
      const delta = now - lastTick;
      lastTick = now;

      if (covering) {
        elapsedMs += delta;

        samplesRef.current.push({ time: Date.now(), val: avgRed });
        if (samplesRef.current.length > 300) samplesRef.current.shift();

        setWaveform((prev) => {
          const next = [...prev, avgRed];
          return next.length > 90 ? next.slice(next.length - 90) : next;
        });

        detectPeak();

        const remaining = Math.max(0, Math.ceil(CAPTURE_DURATION_SECONDS - elapsedMs / 1000));
        setSecondsRemaining(remaining);

        if (elapsedMs / 1000 >= CAPTURE_DURATION_SECONDS) {
          finish('camera', 'Câmera (PPG)');
          return;
        }
      }

      rafRef.current = requestAnimationFrame(processFrame);
    };

    /** Detecção de pico sistólico local acima da média móvel. */
    const detectPeak = () => {
      const samples = samplesRef.current;
      if (samples.length < 20) return;

      const values = samples.map((s) => s.val);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const current = values[values.length - 1];
      const prev = values[values.length - 2];
      const prev2 = values[values.length - 3];

      if (prev > current && prev > prev2 && prev > mean) {
        const peakTime = samples[samples.length - 2].time;
        const lastPeak = peaksRef.current[peaksRef.current.length - 1];

        if (!lastPeak) {
          peaksRef.current.push(peakTime);
          return;
        }

        const rr = peakTime - lastPeak;
        if (rr >= RR_MIN_MS && rr <= RR_MAX_MS) {
          peaksRef.current.push(peakTime);
          rrRef.current.push(rr);
          setRrCount(rrRef.current.length);

          const instantBpm = Math.round(60000 / rr);
          if (instantBpm >= 35 && instantBpm <= 170) setLiveBpm(instantBpm);
        }
      }
    };

    rafRef.current = requestAnimationFrame(processFrame);
  }, [reset, finish]);

  /* ---------------- fonte 2: sensor BLE ---------------- */

  const startBle = useCallback(async () => {
    reset();
    setSource('ble');
    setPhase('connecting');

    const nav: any = navigator;
    if (!nav.bluetooth) {
      setPhase('error');
      setErrorMessage(
        'Este navegador não suporta Web Bluetooth. Use Chrome/Edge em Android ou desktop, ou meça pela câmera.',
      );
      return;
    }

    let device: any;
    try {
      device = await nav.bluetooth.requestDevice({
        filters: [{ services: ['heart_rate'] }],
        optionalServices: ['battery_service'],
      });
    } catch (err: any) {
      // NotFoundError = o usuário fechou o seletor de dispositivos.
      setPhase('idle');
      if (err?.name !== 'NotFoundError') {
        setErrorMessage(`Não foi possível conectar ao sensor: ${err?.message || 'tente novamente.'}`);
      }
      return;
    }

    bleDeviceRef.current = device;
    setDeviceName(device.name || 'Sensor Cardíaco BLE');

    try {
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService('heart_rate');
      const characteristic = await service.getCharacteristic('heart_rate_measurement');
      bleCharRef.current = characteristic;

      characteristic.addEventListener('characteristicvaluechanged', handleBleData);
      await characteristic.startNotifications();
    } catch (err: any) {
      teardown();
      setPhase('error');
      setErrorMessage(`Falha ao ler o serviço de frequência cardíaca: ${err?.message || 'sensor indisponível.'}`);
      return;
    }

    device.addEventListener('gattserverdisconnected', () => {
      if (activeRef.current) {
        teardown();
        setPhase('error');
        setErrorMessage('O sensor desconectou durante a medição. Reaproxime a cinta e tente novamente.');
      }
    });

    activeRef.current = true;
    setPhase('capturing');
    setSecondsRemaining(CAPTURE_DURATION_SECONDS);
    setSignalOk(true);

    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          finish('ble', device.name || 'Sensor Cardíaco BLE');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    /** Decodifica a característica 0x2A37 (Bluetooth SIG Heart Rate Measurement). */
    function handleBleData(event: any) {
      const value: DataView = event.target.value;
      if (!value || value.byteLength < 2) return;

      const flags = value.getUint8(0);
      const hr16Bit = (flags & 0x01) !== 0;
      const energyPresent = (flags & 0x08) !== 0;
      const rrPresent = (flags & 0x10) !== 0;

      let offset = 1;
      let bpm: number;
      if (hr16Bit) {
        bpm = value.getUint16(offset, true);
        offset += 2;
      } else {
        bpm = value.getUint8(offset);
        offset += 1;
      }

      if (bpm > 30 && bpm < 240) setLiveBpm(bpm);
      if (energyPresent) offset += 2;

      if (!rrPresent) return;

      while (offset + 1 < value.byteLength) {
        const rawRr = value.getUint16(offset, true);
        offset += 2;
        // Unidade do padrão: 1/1024 de segundo.
        const rrMs = Math.round((rawRr / 1024) * 1000);
        if (rrMs >= RR_MIN_MS && rrMs <= RR_MAX_MS) {
          rrRef.current.push(rrMs);
        }
      }
      setRrCount(rrRef.current.length);
    }
  }, [reset, finish, teardown]);

  return {
    phase,
    source,
    secondsRemaining,
    liveBpm,
    rrCount,
    signalOk,
    deviceName,
    errorMessage,
    result,
    waveform,
    videoRef,
    startCamera,
    startBle,
    cancel,
    reset,
    isBleSupported,
  };
}
