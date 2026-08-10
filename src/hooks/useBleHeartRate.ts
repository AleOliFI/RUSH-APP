import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import { BleManager, type Device, type Subscription } from 'react-native-ble-plx';
import {
  HEART_RATE_SERVICE,
  HEART_RATE_MEASUREMENT_CHAR,
  base64ToBytes,
  isPlausibleRR,
  parseHeartRateMeasurement,
  type SensorContact,
} from '../lib/ble/heartRate';

/** Seconds of RR collection once the strap is connected. */
export const ACQUISITION_SECONDS = 60;

export type BleStage =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'measuring'
  | 'done'
  | 'error';

export interface BleDevice {
  id: string;
  name: string;
}

let manager: BleManager | null = null;
function getManager(): BleManager {
  if (!manager) manager = new BleManager();
  return manager;
}

/**
 * Devolve o manager apenas se ele já existir.
 *
 * A limpeza roda em todo unmount, inclusive no web, onde a tela nem chega a
 * usar BLE — e construir um BleManager ali lança. Usar getManager() na limpeza
 * anularia a guarda `Platform.OS === 'web'` da tela: não há o que limpar antes
 * de haver o que criar.
 */
function peekManager(): BleManager | null {
  return manager;
}

/** Android 12+ needs the new BLE runtime permissions; older needs location. */
async function ensureAndroidPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : 0;

  const wanted =
    apiLevel >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

  const granted = await PermissionsAndroid.requestMultiple(wanted);
  return wanted.every((p) => granted[p] === PermissionsAndroid.RESULTS.GRANTED);
}

export function useBleHeartRate() {
  const [stage, setStage] = useState<BleStage>('idle');
  const [devices, setDevices] = useState<BleDevice[]>([]);
  const [heartRate, setHeartRate] = useState(0);
  const [contact, setContact] = useState<SensorContact>('unsupported');
  const [beatCount, setBeatCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  /** True when the connected device never sends RR intervals (BPM only). */
  const [rrUnsupported, setRrUnsupported] = useState(false);

  const rrRef = useRef<number[]>([]);
  const subRef = useRef<Subscription | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const framesRef = useRef(0);
  const elapsedRef = useRef(0);
  /**
   * Identifica a medição corrente. Toda limpeza o incrementa, então qualquer
   * await que estava em voo percebe que foi cancelado e não escreve estado —
   * sair da tela durante "Conectando..." deixava subscription e timer vivos,
   * que depois navegavam a partir de uma tela já desmontada.
   */
  const runIdRef = useRef(0);

  const cleanup = useCallback(() => {
    runIdRef.current += 1;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    subRef.current?.remove();
    subRef.current = null;
    peekManager()?.stopDeviceScan();
    deviceRef.current?.cancelConnection().catch(() => {});
    deviceRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const startScan = useCallback(async () => {
    setError(null);
    setDevices([]);

    if (!(await ensureAndroidPermissions())) {
      setError('Permissão de Bluetooth negada.');
      setStage('error');
      return;
    }

    setStage('scanning');
    const seen = new Map<string, BleDevice>();

    getManager().startDeviceScan([HEART_RATE_SERVICE], null, (err, device) => {
      if (err) {
        setError(err.message);
        setStage('error');
        return;
      }
      if (!device?.id || seen.has(device.id)) return;
      seen.set(device.id, {
        id: device.id,
        name: device.name ?? device.localName ?? 'Dispositivo sem nome',
      });
      setDevices([...seen.values()]);
    });
  }, []);

  const stopScan = useCallback(() => {
    // Parar não deve criar o manager: se ele não existe, não há varredura.
    peekManager()?.stopDeviceScan();
    if (stage === 'scanning') setStage('idle');
  }, [stage]);

  /** Connect and stream RR intervals for ACQUISITION_SECONDS. */
  const measure = useCallback(
    async (deviceId: string, onFinish: (rr: number[]) => void) => {
      getManager().stopDeviceScan();
      // Invalida qualquer medição anterior ainda em voo e reserva este id.
      runIdRef.current += 1;
      const runId = runIdRef.current;
      const cancelled = () => runIdRef.current !== runId;

      setStage('connecting');
      setError(null);
      rrRef.current = [];
      framesRef.current = 0;
      elapsedRef.current = 0;
      setBeatCount(0);
      setElapsed(0);
      setRrUnsupported(false);

      try {
        const device = await getManager().connectToDevice(deviceId);
        if (cancelled()) {
          await device.cancelConnection().catch(() => {});
          return;
        }
        deviceRef.current = device;

        await device.discoverAllServicesAndCharacteristics();
        if (cancelled()) return;

        setStage('measuring');

        subRef.current = device.monitorCharacteristicForService(
          HEART_RATE_SERVICE,
          HEART_RATE_MEASUREMENT_CHAR,
          (err, characteristic) => {
            if (cancelled()) return;

            // Erro do monitor significa cinta que caiu ou falha de GATT.
            // Ignorar em silêncio fazia uma leitura interrompida aos 20 s ser
            // gravada como medição completa de 60 s.
            if (err) {
              cleanup();
              setError(
                'A conexão com o sensor caiu durante a medição. Aproxime o dispositivo e tente de novo.',
              );
              setStage('error');
              return;
            }
            if (!characteristic?.value) return;

            const parsed = parseHeartRateMeasurement(base64ToBytes(characteristic.value));
            if (!parsed) return;

            framesRef.current += 1;
            setHeartRate(parsed.heartRate);
            setContact(parsed.sensorContact);

            const valid = parsed.rrIntervals.filter(isPlausibleRR);
            if (valid.length > 0) {
              rrRef.current.push(...valid);
              setBeatCount(rrRef.current.length);
            } else if (framesRef.current >= 10 && rrRef.current.length === 0) {
              // Ten frames in with no RR at all: this device reports BPM only.
              setRrUnsupported(true);
            }
          },
        );

        // O contador vive num ref e o efeito colateral fica fora do updater do
        // setState. Dentro dele, a dupla invocação do StrictMode encerrava a
        // conexão duas vezes e navegava duas vezes.
        timerRef.current = setInterval(() => {
          if (cancelled()) return;

          elapsedRef.current += 1;
          setElapsed(elapsedRef.current);

          if (elapsedRef.current >= ACQUISITION_SECONDS) {
            const collected = rrRef.current;
            cleanup();
            setStage('done');
            onFinish(collected);
          }
        }, 1000);
      } catch (e) {
        if (cancelled()) return;
        cleanup();
        setError((e as Error).message);
        setStage('error');
      }
    },
    [cleanup],
  );

  const reset = useCallback(() => {
    cleanup();
    elapsedRef.current = 0;
    framesRef.current = 0;
    rrRef.current = [];
    setStage('idle');
    setDevices([]);
    setHeartRate(0);
    // Sem isto, o aviso "sensor sem contato" da medição anterior reaparecia
    // no início da próxima, antes de qualquer leitura nova.
    setContact('unsupported');
    setBeatCount(0);
    setElapsed(0);
    setError(null);
    setRrUnsupported(false);
  }, [cleanup]);

  return {
    stage,
    devices,
    heartRate,
    contact,
    beatCount,
    elapsed,
    error,
    rrUnsupported,
    startScan,
    stopScan,
    measure,
    reset,
  };
}
