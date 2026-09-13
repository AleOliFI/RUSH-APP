// ============================================================
// RUSH RUNNING — Sensores BLE
// ------------------------------------------------------------
// Pareamento real via Web Bluetooth. O navegador não expõe varredura
// em segundo plano: quem lista os dispositivos próximos é o seletor
// nativo, aberto por requestDevice(). Por isso não existe aqui um
// "radar" com aparelhos encontrados sozinho.
//
// Lemos de fato o serviço Heart Rate (GATT 0x180D) — batimentos e, quando
// o sensor expõe, o nível de bateria (0x180F). Potência e cadência
// (footpods como o Stryd) usam serviços que este app ainda não lê, então
// aparecem como cadastro manual, sem leitura ao vivo.
//
// Os pares ficam registrados em /api/users/devices.
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { users } from '../../api';

export interface PairedDevice {
  id: string;
  brand: string;
  device_id: string;
  device_type: string;
  is_active: number;
}

interface BleHardwareModalProps {
  isOpen: boolean;
  devices: PairedDevice[];
  onClose: () => void;
  onReloadDevices: () => Promise<void>;
}

const DEVICE_TYPE_LABEL: Record<string, string> = {
  heart_rate: 'Monitor cardíaco',
  footpod: 'Footpod / cadência',
  power: 'Medidor de potência',
  watch: 'Relógio',
  other: 'Sensor',
};

const DEVICE_TYPE_ICON: Record<string, string> = {
  heart_rate: 'monitor_heart',
  footpod: 'directions_run',
  power: 'bolt',
  watch: 'watch',
  other: 'sensors',
};

export const BleHardwareModal: React.FC<BleHardwareModalProps> = ({
  isOpen,
  devices,
  onClose,
  onReloadDevices,
}) => {
  const [liveBpm, setLiveBpm] = useState<number | null>(null);
  const [batteryPct, setBatteryPct] = useState<number | null>(null);
  const [connectedName, setConnectedName] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState({ brand: '', device_type: 'footpod' });

  const deviceRef = useRef<any>(null);
  const charRef = useRef<any>(null);

  const isSupported = typeof navigator !== 'undefined' && 'bluetooth' in navigator;

  const disconnect = useCallback(() => {
    try {
      charRef.current?.stopNotifications?.();
    } catch {
      /* já desconectado */
    }
    if (deviceRef.current?.gatt?.connected) {
      try {
        deviceRef.current.gatt.disconnect();
      } catch {
        /* ignorado */
      }
    }
    charRef.current = null;
    deviceRef.current = null;
    setLiveBpm(null);
    setBatteryPct(null);
    setConnectedName(null);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      disconnect();
      setError(null);
      setNotice(null);
      setManualOpen(false);
    }
  }, [isOpen, disconnect]);

  useEffect(() => disconnect, [disconnect]);

  if (!isOpen) return null;

  /** Abre o seletor nativo, conecta e registra o sensor cardíaco. */
  const handlePairHeartRate = async () => {
    setError(null);
    setNotice(null);

    const nav: any = navigator;
    if (!nav.bluetooth) {
      setError('Este navegador não suporta Web Bluetooth. Use Chrome ou Edge em Android ou desktop.');
      return;
    }

    setIsConnecting(true);
    try {
      const device = await nav.bluetooth.requestDevice({
        filters: [{ services: ['heart_rate'] }],
        optionalServices: ['battery_service'],
      });

      deviceRef.current = device;
      const name = device.name || 'Sensor Cardíaco BLE';
      setConnectedName(name);

      device.addEventListener('gattserverdisconnected', () => {
        setConnectedName(null);
        setLiveBpm(null);
        setBatteryPct(null);
      });

      const server = await device.gatt.connect();

      // Bateria é opcional no padrão: nem todo sensor expõe.
      try {
        const batteryService = await server.getPrimaryService('battery_service');
        const batteryChar = await batteryService.getCharacteristic('battery_level');
        const value = await batteryChar.readValue();
        setBatteryPct(value.getUint8(0));
      } catch {
        setBatteryPct(null);
      }

      const service = await server.getPrimaryService('heart_rate');
      const characteristic = await service.getCharacteristic('heart_rate_measurement');
      charRef.current = characteristic;

      characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
        const value: DataView = event.target.value;
        if (!value || value.byteLength < 2) return;
        const flags = value.getUint8(0);
        const bpm = (flags & 0x01) !== 0 ? value.getUint16(1, true) : value.getUint8(1);
        if (bpm > 30 && bpm < 240) setLiveBpm(bpm);
      });
      await characteristic.startNotifications();

      await users.registerDevice({
        brand: name,
        device_id: device.id || name,
        device_type: 'heart_rate',
      });
      await onReloadDevices();
      setNotice(`${name} pareado e recebendo batimentos.`);
    } catch (err: any) {
      if (err?.name === 'NotFoundError') {
        // O usuário fechou o seletor de dispositivos.
        setNotice(null);
      } else {
        setError(err?.message || 'Não foi possível parear o sensor.');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!manualForm.brand.trim()) {
      setError('Informe o nome do sensor.');
      return;
    }

    try {
      await users.registerDevice({
        brand: manualForm.brand.trim(),
        device_id: `manual-${manualForm.brand.trim().toLowerCase().replace(/\s+/g, '-')}`,
        device_type: manualForm.device_type,
      });
      await onReloadDevices();
      setManualForm({ brand: '', device_type: 'footpod' });
      setManualOpen(false);
      setNotice('Sensor cadastrado.');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível cadastrar o sensor.');
    }
  };

  const handleRemove = async (device: PairedDevice) => {
    setBusyId(device.id);
    setError(null);
    try {
      await users.removeDevice(device.id);
      await onReloadDevices();
      if (connectedName === device.brand) disconnect();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível remover o sensor.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ble-modal-title"
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/85 backdrop-blur-md transition-opacity"
    >
      <div className="flex-1 w-full" onClick={onClose} />

      <div className="relative w-full max-w-xl mx-auto max-h-[92vh] flex flex-col bg-[#0D0D0D] rounded-t-3xl border-t border-[#FF5500]/50 shadow-[0_-12px_40px_rgba(0,0,0,0.9)] overflow-hidden">
        <div className="w-full flex items-center justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-[#353534]" />
        </div>

        <div className="px-5 py-3 flex items-center justify-between border-b border-[#262626] gap-3">
          <div className="min-w-0">
            <span className="font-label-sm text-[10px] text-[#FF5500] tracking-widest uppercase block">
              HARDWARE & CONECTIVIDADE
            </span>
            <h2 id="ble-modal-title" className="font-headline text-2xl text-[#F7F5F3] uppercase tracking-normal">
              Sensores BLE
            </h2>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 shrink-0 rounded-full bg-[#1C1C1C] text-[#A1A1AA] hover:text-[#F7F5F3] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Fechar sensores"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Conexão ao vivo */}
          <div
            className={`p-4 rounded-2xl border shadow-lg space-y-3 ${
              connectedName ? 'bg-[#22C55E]/10 border-[#22C55E]/40' : 'bg-[#1C1C1C] border-[#262626]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-label-caps text-xs text-[#A1A1AA] uppercase tracking-wider">
                Conexão ativa
              </span>
              <span
                className={`w-2.5 h-2.5 rounded-full ${connectedName ? 'bg-[#22C55E] animate-pulse' : 'bg-[#737373]'}`}
              />
            </div>

            {connectedName ? (
              <>
                <div className="flex items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-headline text-2xl text-[#F7F5F3] uppercase truncate block">
                      {connectedName}
                    </span>
                    <span className="font-telemetry text-[11px] text-[#A1A1AA]">
                      {batteryPct !== null ? `Bateria ${batteryPct}%` : 'Bateria não informada pelo sensor'}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-metric-hero-mobile text-[#EF4444]">{liveBpm ?? '--'}</span>
                    <span className="font-label-sm text-xs text-[#A1A1AA] uppercase ml-1">BPM</span>
                  </div>
                </div>

                <button
                  onClick={disconnect}
                  className="w-full h-10 rounded-lg bg-[#101010] border border-[#262626] text-[11px] font-bold uppercase text-[#A1A1AA] hover:text-[#F7F5F3] cursor-pointer"
                >
                  Desconectar
                </button>
              </>
            ) : (
              <p className="text-xs text-[#A1A1AA] leading-relaxed">
                Nenhum sensor conectado agora. Pareie uma cinta para ver os batimentos ao vivo e usá-la nas
                medições e corridas.
              </p>
            )}
          </div>

          {notice && (
            <p className="text-xs text-[#22C55E] font-bold" role="status">
              {notice}
            </p>
          )}
          {error && (
            <p className="text-xs text-[#EF4444] font-bold" role="alert">
              {error}
            </p>
          )}

          {/* Pareados */}
          <div className="space-y-3">
            <h3 className="font-headline text-lg text-[#F7F5F3] uppercase tracking-normal">
              Sensores pareados ({devices.length})
            </h3>

            {devices.length === 0 && (
              <div className="bg-[#1C1C1C] rounded-2xl border border-dashed border-[#262626] p-6 text-center">
                <span className="material-symbols-outlined text-[30px] text-[#404040]">bluetooth_searching</span>
                <p className="text-xs text-[#737373] mt-2 leading-relaxed">
                  Nenhum sensor pareado ainda.
                </p>
              </div>
            )}

            {devices.map((device) => (
              <div
                key={device.id}
                className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="material-symbols-outlined text-[#FF5500] text-[22px] shrink-0">
                    {DEVICE_TYPE_ICON[device.device_type] || 'sensors'}
                  </span>
                  <div className="min-w-0">
                    <span className="font-body text-sm font-bold text-[#F7F5F3] block truncate">
                      {device.brand}
                    </span>
                    <span className="font-telemetry text-[10px] text-[#737373] block truncate">
                      {DEVICE_TYPE_LABEL[device.device_type] || 'Sensor'}
                      {connectedName === device.brand ? ' • conectado agora' : ''}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleRemove(device)}
                  disabled={busyId === device.id}
                  className="shrink-0 h-9 px-3 rounded-lg bg-[#101010] border border-[#262626] text-[11px] font-bold uppercase text-[#A1A1AA] hover:text-[#EF4444] disabled:opacity-50 cursor-pointer"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>

          {/* Cadastro manual */}
          {manualOpen && (
            <form onSubmit={handleAddManual} className="bg-[#1C1C1C] rounded-2xl border border-[#FF5500]/40 p-4 space-y-3">
              <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase block">
                Cadastrar sensor manualmente
              </span>

              <div className="space-y-1">
                <label htmlFor="device-brand" className="font-label-sm text-[10px] text-[#737373] uppercase block">
                  Nome / modelo
                </label>
                <input
                  id="device-brand"
                  value={manualForm.brand}
                  onChange={(e) => setManualForm({ ...manualForm, brand: e.target.value })}
                  placeholder="ex.: Stryd Next Gen"
                  className="w-full h-10 rounded-lg bg-[#101010] border border-[#262626] px-3 text-xs text-[#F7F5F3] focus:outline-none focus:border-[#FF5500]"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="device-type" className="font-label-sm text-[10px] text-[#737373] uppercase block">
                  Tipo
                </label>
                <select
                  id="device-type"
                  value={manualForm.device_type}
                  onChange={(e) => setManualForm({ ...manualForm, device_type: e.target.value })}
                  className="w-full h-10 rounded-lg bg-[#101010] border border-[#262626] px-3 text-xs text-[#F7F5F3] focus:outline-none focus:border-[#FF5500] cursor-pointer"
                >
                  <option value="footpod">Footpod / cadência</option>
                  <option value="power">Medidor de potência</option>
                  <option value="watch">Relógio</option>
                  <option value="other">Outro</option>
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setManualOpen(false)}
                  className="h-10 px-4 rounded-lg bg-[#101010] border border-[#262626] text-[#A1A1AA] hover:text-[#F7F5F3] text-xs font-bold uppercase cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 h-10 rounded-lg bg-[#FF5500] hover:bg-[#FF6B00] text-[#0D0D0D] text-xs font-black uppercase tracking-wider cursor-pointer"
                >
                  Cadastrar
                </button>
              </div>
            </form>
          )}

          {/* Ações */}
          <div className="space-y-2.5">
            <button
              onClick={handlePairHeartRate}
              disabled={!isSupported || isConnecting}
              className="w-full min-h-[52px] py-3.5 px-4 bg-[#FF5500] hover:bg-[#FF6B00] disabled:bg-[#262626] disabled:text-[#737373] disabled:cursor-not-allowed text-[#0D0D0D] rounded-xl flex items-center justify-center gap-2 shadow-lg font-headline text-base uppercase tracking-wider transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[22px]">bluetooth_searching</span>
              <span>
                {!isSupported
                  ? 'Web Bluetooth indisponível'
                  : isConnecting
                    ? 'Abrindo seletor…'
                    : 'Parear cinta cardíaca'}
              </span>
            </button>

            {!manualOpen && (
              <button
                onClick={() => setManualOpen(true)}
                className="w-full min-h-[44px] py-3 px-4 bg-[#262626] hover:bg-[#353534] text-[#F7F5F3] rounded-xl border border-[#353534] font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Cadastrar outro sensor manualmente
              </button>
            )}
          </div>

          {/* Nota de protocolo */}
          <p className="text-[10px] text-[#737373] leading-relaxed">
            O pareamento usa o Heart Rate Service do padrão Bluetooth SIG (GATT 0x180D), o mesmo de cintas Polar,
            Garmin e Wahoo, lendo os intervalos R-R quando o sensor os publica. A varredura de dispositivos é
            feita pelo próprio sistema: o navegador só expõe o seletor nativo, sem lista em segundo plano.
            Footpods e medidores de potência podem ser cadastrados para registro, mas o app ainda não lê seus
            dados ao vivo.
          </p>
        </div>
      </div>
    </div>
  );
};
