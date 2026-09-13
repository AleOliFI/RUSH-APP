// ============================================================
// RUSH RUNNING — Protocolo de Campo (limiar e VO₂máx)
// ------------------------------------------------------------
// Executar o protocolo abre o HUD de corrida. Ao registrar o
// resultado, os dados vão para POST /api/users/field-test, que
// calcula e persiste as zonas individualizadas de FC e pace; no
// protocolo de Cooper o backend também grava o VO₂máx estimado
// pela fórmula original de Cooper (1968).
// ============================================================

import React, { useState } from 'react';
import { users } from '../../api';

interface FieldProtocolModalProps {
  isOpen: boolean;
  /** Zonas atuais devolvidas pelo agente, para comparação. */
  hrZones: Record<string, { name: string; minBpm: number; maxBpm: number }> | null;
  /** Sensores pareados, para indicar o que está disponível. */
  devices: { brand: string; device_type: string }[];
  onClose: () => void;
  onStartProtocol: () => void;
  onCalibrated: () => Promise<void>;
}

type ProtocolId = 'friel' | 'cooper' | 'ramp';

const PROTOCOLS: {
  id: ProtocolId;
  name: string;
  desc: string;
  testType: string;
  defaultDurationMin: number;
  fixedDuration: boolean;
}[] = [
  {
    id: 'friel',
    name: '01. Teste Friel 30 min (Recomendado)',
    desc: 'All-out contínuo de 30 minutos. A FC média dos últimos 20 minutos define o LTHR.',
    testType: 'friel_30min',
    defaultDurationMin: 30,
    fixedDuration: true,
  },
  {
    id: 'cooper',
    name: '02. Teste de Cooper 12 min',
    desc: 'Distância máxima percorrida em 12 minutos. Permite estimar o VO₂máx indireto.',
    testType: 'cooper_12min',
    defaultDurationMin: 12,
    fixedDuration: true,
  },
  {
    id: 'ramp',
    name: '03. Teste máximo escalonado (rampa)',
    desc: 'Aumento progressivo de intensidade até a exaustão volitiva.',
    testType: 'ramp_max',
    defaultDurationMin: 0,
    fixedDuration: false,
  },
];

const ZONE_COLORS: Record<string, string> = {
  Z1: '#3B82F6',
  Z2: '#22C55E',
  Z3: '#FACC15',
  Z4: '#FF5500',
  Z5: '#EF4444',
};

export const FieldProtocolModal: React.FC<FieldProtocolModalProps> = ({
  isOpen,
  hrZones,
  devices,
  onClose,
  onStartProtocol,
  onCalibrated,
}) => {
  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolId>('friel');
  const [checklist1, setChecklist1] = useState(false);
  const [checklist2, setChecklist2] = useState(false);
  const [checklist3, setChecklist3] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const [form, setForm] = useState({ distance_km: '', duration_min: '', avg_hr: '', max_hr: '', rest_hr: '' });

  if (!isOpen) return null;

  const protocol = PROTOCOLS.find((p) => p.id === selectedProtocol)!;
  const checklistDone = checklist1 && checklist2 && checklist3;
  const hrDevice = devices.find((d) => d.device_type === 'heart_rate');

  const handleSubmitResult = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const distance = Number(form.distance_km);
    const durationMin = protocol.fixedDuration ? protocol.defaultDurationMin : Number(form.duration_min);
    const avgHr = Number(form.avg_hr);
    const maxHr = Number(form.max_hr);
    const restHr = form.rest_hr ? Number(form.rest_hr) : null;

    if (!isFinite(distance) || distance <= 0 || distance > 50) {
      setError('Informe a distância percorrida, entre 0 e 50 km.');
      return;
    }
    if (!isFinite(durationMin) || durationMin < 5 || durationMin > 180) {
      setError('A duração do teste deve ficar entre 5 e 180 minutos.');
      return;
    }
    if (!isFinite(avgHr) || avgHr < 60 || avgHr > 230) {
      setError('A FC média deve ficar entre 60 e 230 bpm.');
      return;
    }
    if (!isFinite(maxHr) || maxHr < 100 || maxHr > 230) {
      setError('A FC máxima deve ficar entre 100 e 230 bpm.');
      return;
    }
    if (maxHr < avgHr) {
      setError('A FC máxima não pode ser menor que a FC média.');
      return;
    }
    if (restHr !== null && (!isFinite(restHr) || restHr < 30 || restHr > 120)) {
      setError('A FC de repouso deve ficar entre 30 e 120 bpm.');
      return;
    }

    setIsSaving(true);
    try {
      const response = await users.fieldTest({
        test_type: protocol.testType,
        distance_km: distance,
        duration_seconds: Math.round(durationMin * 60),
        avg_hr: avgHr,
        max_hr: maxHr,
        rest_hr: restHr ?? undefined,
      });
      setResult(response);
      await onCalibrated();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível processar o teste.');
    } finally {
      setIsSaving(false);
    }
  };

  const reset = () => {
    setResult(null);
    setIsLogging(false);
    setForm({ distance_km: '', duration_min: '', avg_hr: '', max_hr: '', rest_hr: '' });
    setError(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="protocol-title"
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/92 backdrop-blur-md transition-opacity"
    >
      <div className="flex-1 w-full" onClick={onClose} />

      <div className="relative w-full max-w-xl mx-auto max-h-[94vh] flex flex-col bg-[#0D0D0D] rounded-t-3xl border-t border-[#FF5500]/60 shadow-[0_-12px_45px_rgba(0,0,0,0.95)] overflow-hidden">
        <div className="w-full flex items-center justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-[#353534]" />
        </div>

        <div className="px-5 py-3 flex items-center justify-between border-b border-[#262626] gap-3">
          <div className="min-w-0">
            <span className="font-label-sm text-[10px] text-[#FF5500] tracking-widest uppercase block">
              LABORATÓRIO FISIOLÓGICO RUSH
            </span>
            <h2 id="protocol-title" className="font-headline text-2xl text-[#F7F5F3] uppercase tracking-normal">
              Protocolo de Campo
            </h2>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 shrink-0 rounded-full bg-[#1C1C1C] text-[#A1A1AA] hover:text-[#F7F5F3] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Fechar protocolo de campo"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Resultado do teste */}
          {result ? (
            <div className="space-y-4">
              <div className="bg-[#22C55E]/10 border border-[#22C55E]/40 rounded-2xl p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-[#22C55E]">
                  <span className="material-symbols-outlined text-[22px]">verified</span>
                  <span className="font-label-caps text-xs uppercase font-extrabold tracking-wider">
                    ZONAS RECALIBRADAS
                  </span>
                </div>
                <p className="text-xs text-[#e5e2e1] leading-relaxed">{result.message}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 font-telemetry text-xs text-[#A1A1AA]">
                  <span>
                    Pace do teste: <strong className="text-[#FF5500]">{result.test_pace}</strong>
                  </span>
                  <span>
                    FC máx: <strong className="text-[#F7F5F3]">{result.max_hr} bpm</strong>
                  </span>
                  {result.vo2max && (
                    <span>
                      VO₂máx: <strong className="text-[#22C55E]">{result.vo2max} mL/kg/min</strong>
                    </span>
                  )}
                </div>
              </div>

              {result.zones && (
                <div className="space-y-2">
                  <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase block">
                    Novas zonas individualizadas
                  </span>
                  <div className="space-y-1.5">
                    {Object.entries(result.zones).map(([key, zone]: [string, any]) => (
                      <div
                        key={key}
                        className="bg-[#1C1C1C] p-3 rounded-xl border border-[#262626] flex items-center justify-between gap-3"
                      >
                        <span className="font-headline text-sm shrink-0" style={{ color: ZONE_COLORS[key] }}>
                          {key}
                        </span>
                        <span className="font-telemetry text-xs text-[#F7F5F3]">
                          {zone.minBpm}–{zone.maxBpm} bpm
                        </span>
                        <span className="font-telemetry text-xs text-[#A1A1AA] text-right truncate">
                          {zone.pace}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={reset}
                  className="flex-1 h-12 rounded-xl bg-[#262626] hover:bg-[#353534] text-[#F7F5F3] text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Registrar outro teste
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 h-12 rounded-xl bg-[#FF5500] hover:bg-[#FF6B00] text-[#0D0D0D] font-headline text-sm uppercase tracking-wider cursor-pointer"
                >
                  Concluir
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Sensores disponíveis */}
              <div
                className={`p-4 rounded-2xl border shadow-md flex items-center justify-between gap-3 ${
                  hrDevice ? 'bg-[#1C1C1C] border-[#262626]' : 'bg-[#FACC15]/10 border-[#FACC15]/40'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-xl bg-[#101010] flex items-center justify-center border border-[#262626] shrink-0 ${
                      hrDevice ? 'text-[#22C55E]' : 'text-[#FACC15]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[24px]">
                      {hrDevice ? 'verified' : 'warning'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="font-headline text-base text-[#F7F5F3] uppercase tracking-wide block truncate">
                      {hrDevice ? hrDevice.brand : 'Nenhuma cinta pareada'}
                    </span>
                    <span className="text-xs text-[#A1A1AA] leading-snug block">
                      {hrDevice
                        ? 'A FC do teste pode ser lida direto da cinta durante a corrida.'
                        : 'Sem cinta, informe a FC média e máxima manualmente ao registrar o resultado.'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Seleção do protocolo */}
              <div className="space-y-2">
                <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase block">
                  Selecione o protocolo de teste
                </span>
                <div className="space-y-2">
                  {PROTOCOLS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProtocol(p.id)}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        selectedProtocol === p.id
                          ? 'bg-[#1C1C1C] border-[#FF5500] shadow-lg shadow-[#FF5500]/10'
                          : 'bg-[#101010] border-[#262626] hover:border-[#444]'
                      }`}
                    >
                      <span
                        className={`font-headline text-sm uppercase block ${
                          selectedProtocol === p.id ? 'text-[#FF5500]' : 'text-[#F7F5F3]'
                        }`}
                      >
                        {p.name}
                      </span>
                      <span className="text-xs text-[#A1A1AA] leading-relaxed block mt-0.5">{p.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Zonas atuais */}
              <div className="space-y-2">
                <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase block">
                  {hrZones ? 'Zonas atuais (serão recalibradas)' : 'Zonas ainda não individualizadas'}
                </span>

                {hrZones ? (
                  <div className="grid grid-cols-5 gap-1.5 text-center font-telemetry text-xs">
                    {(['Z1', 'Z2', 'Z3', 'Z4', 'Z5'] as const).map((key) => (
                      <div
                        key={key}
                        className="bg-[#1C1C1C] p-2 rounded-lg border"
                        style={{ borderColor: key === 'Z4' ? ZONE_COLORS.Z4 : '#262626' }}
                      >
                        <span className="text-[9px] font-bold block" style={{ color: ZONE_COLORS[key] }}>
                          {key}
                        </span>
                        <span className="text-[#F7F5F3] block mt-0.5 text-[10px]">
                          {hrZones[key] ? `${hrZones[key].minBpm}-${hrZones[key].maxBpm}` : '—'}
                        </span>
                        <span className="text-[8px] text-[#737373] truncate block">
                          {hrZones[key]?.name?.split(' ')[0] || ''}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#737373] leading-relaxed bg-[#101010] p-3 rounded-xl border border-[#262626]">
                    Registre uma medição matinal de VFC para o app calcular suas zonas de referência, ou rode um
                    protocolo de campo para individualizá-las a partir do seu limiar real.
                  </p>
                )}
              </div>

              {/* Formulário de resultado */}
              {isLogging ? (
                <form onSubmit={handleSubmitResult} className="bg-[#1C1C1C] rounded-2xl border border-[#FF5500]/40 p-4 space-y-3">
                  <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase block">
                    Resultado do {protocol.name.replace(/^\d+\.\s*/, '')}
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label htmlFor="ft-distance" className="font-label-sm text-[10px] text-[#737373] uppercase block">
                        Distância (km) *
                      </label>
                      <input
                        id="ft-distance"
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={form.distance_km}
                        onChange={(e) => setForm({ ...form, distance_km: e.target.value })}
                        placeholder="ex.: 2.85"
                        className="w-full h-10 rounded-lg bg-[#101010] border border-[#262626] px-3 text-xs text-[#F7F5F3] font-telemetry focus:outline-none focus:border-[#FF5500]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="ft-duration" className="font-label-sm text-[10px] text-[#737373] uppercase block">
                        Duração (min) *
                      </label>
                      <input
                        id="ft-duration"
                        type="number"
                        inputMode="numeric"
                        value={protocol.fixedDuration ? protocol.defaultDurationMin : form.duration_min}
                        onChange={(e) => setForm({ ...form, duration_min: e.target.value })}
                        disabled={protocol.fixedDuration}
                        className="w-full h-10 rounded-lg bg-[#101010] border border-[#262626] px-3 text-xs text-[#F7F5F3] font-telemetry disabled:opacity-60 focus:outline-none focus:border-[#FF5500]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="ft-avg-hr" className="font-label-sm text-[10px] text-[#737373] uppercase block">
                        FC média (bpm) *
                      </label>
                      <input
                        id="ft-avg-hr"
                        type="number"
                        inputMode="numeric"
                        value={form.avg_hr}
                        onChange={(e) => setForm({ ...form, avg_hr: e.target.value })}
                        placeholder="ex.: 172"
                        className="w-full h-10 rounded-lg bg-[#101010] border border-[#262626] px-3 text-xs text-[#F7F5F3] font-telemetry focus:outline-none focus:border-[#FF5500]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="ft-max-hr" className="font-label-sm text-[10px] text-[#737373] uppercase block">
                        FC máxima (bpm) *
                      </label>
                      <input
                        id="ft-max-hr"
                        type="number"
                        inputMode="numeric"
                        value={form.max_hr}
                        onChange={(e) => setForm({ ...form, max_hr: e.target.value })}
                        placeholder="ex.: 188"
                        className="w-full h-10 rounded-lg bg-[#101010] border border-[#262626] px-3 text-xs text-[#F7F5F3] font-telemetry focus:outline-none focus:border-[#FF5500]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="ft-rest-hr" className="font-label-sm text-[10px] text-[#737373] uppercase block">
                      FC de repouso (bpm)
                    </label>
                    <input
                      id="ft-rest-hr"
                      type="number"
                      inputMode="numeric"
                      value={form.rest_hr}
                      onChange={(e) => setForm({ ...form, rest_hr: e.target.value })}
                      placeholder="opcional"
                      className="w-full h-10 rounded-lg bg-[#101010] border border-[#262626] px-3 text-xs text-[#F7F5F3] font-telemetry focus:outline-none focus:border-[#FF5500]"
                    />
                  </div>

                  {error && (
                    <p className="text-xs text-[#EF4444] font-bold" role="alert">
                      {error}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsLogging(false)}
                      className="h-11 px-4 rounded-xl bg-[#101010] border border-[#262626] text-[#A1A1AA] hover:text-[#F7F5F3] text-xs font-bold uppercase cursor-pointer"
                    >
                      Voltar
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="flex-1 h-11 rounded-xl bg-[#FF5500] hover:bg-[#FF6B00] disabled:opacity-60 disabled:cursor-wait text-[#0D0D0D] text-xs font-black uppercase tracking-wider cursor-pointer"
                    >
                      {isSaving ? 'Processando…' : 'Calcular e salvar zonas'}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {/* Checklist */}
                  <div className="bg-[#1C1C1C] p-3.5 rounded-xl border border-[#262626] space-y-2 text-xs">
                    <span className="font-label-caps text-[10px] text-[#A1A1AA] uppercase tracking-wider block font-bold">
                      Checklist antes de começar
                    </span>
                    <label className="flex items-center gap-2 cursor-pointer min-h-[36px]">
                      <input
                        type="checkbox"
                        checked={checklist1}
                        onChange={(e) => setChecklist1(e.target.checked)}
                        className="accent-[#FF5500] w-4 h-4 rounded cursor-pointer shrink-0"
                      />
                      <span className="text-[#e5e2e1]">Aquecimento de 15 a 20 minutos concluído</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer min-h-[36px]">
                      <input
                        type="checkbox"
                        checked={checklist2}
                        onChange={(e) => setChecklist2(e.target.checked)}
                        className="accent-[#FF5500] w-4 h-4 rounded cursor-pointer shrink-0"
                      />
                      <span className="text-[#e5e2e1]">Percurso plano, sem cruzamentos ou paradas</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer min-h-[36px]">
                      <input
                        type="checkbox"
                        checked={checklist3}
                        onChange={(e) => setChecklist3(e.target.checked)}
                        className="accent-[#FF5500] w-4 h-4 rounded cursor-pointer shrink-0"
                      />
                      <span className="text-[#e5e2e1]">Sem fadiga acumulada de treinos intensos recentes</span>
                    </label>
                  </div>

                  {error && (
                    <p className="text-xs text-[#EF4444] font-bold" role="alert">
                      {error}
                    </p>
                  )}

                  <div className="space-y-2.5">
                    <button
                      onClick={() => {
                        onClose();
                        onStartProtocol();
                      }}
                      disabled={!checklistDone}
                      className="w-full min-h-[54px] py-4 px-6 bg-[#FF5500] hover:bg-[#FF6B00] disabled:bg-[#262626] disabled:text-[#737373] disabled:cursor-not-allowed active:scale-[0.98] text-[#0D0D0D] rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-[#FF5500]/30 font-headline text-lg uppercase tracking-wider transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[24px]">play_arrow</span>
                      <span>{checklistDone ? 'Iniciar protocolo agora' : 'Conclua o checklist'}</span>
                    </button>

                    <button
                      onClick={() => setIsLogging(true)}
                      className="w-full min-h-[48px] py-3 px-4 bg-[#262626] hover:bg-[#353534] text-[#F7F5F3] rounded-xl border border-[#353534] font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                    >
                      Já fiz o teste — registrar resultado
                    </button>
                  </div>

                  <p className="text-[10px] text-[#737373] leading-relaxed">
                    O cálculo das zonas usa o pace do teste como referência de limiar e a FC máxima registrada.
                    No protocolo de Cooper o VO₂máx é estimado pela fórmula original de Cooper (1968), válida
                    apenas para um esforço máximo de 12 minutos.
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
