// ============================================================
// RUSH RUNNING — Telemetria Cinética PRO
// ------------------------------------------------------------
// Todas as métricas desta tela são calculadas a partir de dados
// registrados pelo atleta:
//   - ACWR (carga aguda x crônica) vem de /api/activities/training-load
//   - VO2máx e tendência vêm das estimativas gravadas
//   - Limiar e zonas vêm do teste de campo
//   - A série de lnRMSSD vem do histórico de VFC
// Não há curva de lactato: lactato sanguíneo só se mede em laboratório,
// e o app não tem como estimá-lo.
// ============================================================

import React, { useMemo, useState } from 'react';
import { AthleteProfile, PhysiologicalReadiness } from '../types';

export interface TrainingLoad {
  acute_load: number;
  chronic_weekly_load: number;
  acwr: number | null;
  zone: 'destreinamento' | 'ideal' | 'atencao' | 'sobrecarga' | null;
  sessions_28d: number;
  sessions_without_rpe: number;
  has_enough_history: boolean;
}

export interface HrvHistoryPoint {
  timestamp: string;
  lnrmssd: number;
  rmssd_ms: number;
}

export interface PairedDevice {
  id: string;
  brand: string;
  device_id: string;
  device_type: string;
  is_active: number;
}

interface ProScreenProps {
  athlete: AthleteProfile;
  readiness: PhysiologicalReadiness;
  trainingLoad: TrainingLoad | null;
  hrvHistory: HrvHistoryPoint[];
  vo2maxTrendPercent: number | null;
  hrZones: Record<string, { name: string; minBpm: number; maxBpm: number }> | null;
  zonePaces: Record<string, string> | null;
  devices: PairedDevice[];
  subscription: { is_pro: boolean; status: string; trial_days_left: number } | null;
  onOpenCheckout?: () => void;
  onOpenFieldProtocol?: () => void;
  onOpenBleHardware?: () => void;
  onOpenGearGarage?: () => void;
  onOpenStoryExporter?: () => void;
  onExportCsv: () => void;
}

const ACWR_ZONE_META: Record<string, { label: string; color: string; risk: string }> = {
  destreinamento: { label: 'ABAIXO DA FAIXA', color: '#3B82F6', risk: 'DESTREINAMENTO' },
  ideal: { label: 'SWEET SPOT IDEAL', color: '#22C55E', risk: 'MUITO BAIXO' },
  atencao: { label: 'ACIMA DA FAIXA', color: '#FACC15', risk: 'MODERADO' },
  sobrecarga: { label: 'SOBRECARGA', color: '#EF4444', risk: 'ELEVADO' },
};

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

export const ProScreen: React.FC<ProScreenProps> = ({
  athlete,
  readiness,
  trainingLoad,
  hrvHistory,
  vo2maxTrendPercent,
  hrZones,
  zonePaces,
  devices,
  subscription,
  onOpenCheckout,
  onOpenFieldProtocol,
  onOpenBleHardware,
  onOpenGearGarage,
  onOpenStoryExporter,
  onExportCsv,
}) => {
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const acwr = trainingLoad?.has_enough_history ? trainingLoad.acwr : null;
  const zoneMeta = trainingLoad?.zone ? ACWR_ZONE_META[trainingLoad.zone] : null;

  // Posição do marcador na barra: 0 a 2.0 mapeado para 0-100%.
  const acwrPinPct = acwr != null ? Math.min(100, Math.max(0, (acwr / 2) * 100)) : null;

  /* ---------- série de lnRMSSD ---------- */
  const hrvChart = useMemo(() => {
    const points = hrvHistory.filter((p) => typeof p.lnrmssd === 'number' && isFinite(p.lnrmssd));
    if (points.length < 2) return null;

    const values = points.map((p) => p.lnrmssd);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;

    const path = points
      .map((p, i) => {
        const x = (i / (points.length - 1)) * 300;
        const y = 110 - ((p.lnrmssd - min) / range) * 95;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');

    const meanY = 110 - ((mean - min) / range) * 95;

    return {
      path,
      meanY,
      mean: mean.toFixed(2),
      count: points.length,
      firstDate: new Date(points[0].timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      lastDate: new Date(points[points.length - 1].timestamp).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      }),
    };
  }, [hrvHistory]);

  const handleExportCsv = () => {
    onExportCsv();
    setExportMessage('Histórico exportado em CSV.');
    setTimeout(() => setExportMessage(null), 3000);
  };

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto px-4 sm:px-5 space-y-5 pt-2 pb-8">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b border-[#262626] pb-3 gap-3">
        <div className="min-w-0">
          <div className="flex items-center space-x-1.5">
            <span className="font-label-caps text-[10px] text-[#FACC15] uppercase tracking-widest font-extrabold block">
              DIAGNÓSTICO AVANÇADO
            </span>
            <span className="bg-[#FF5500] text-[#0D0D0D] font-telemetry text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
              PRO HUD
            </span>
          </div>
          <h1 className="font-headline-md text-[#F7F5F3] uppercase tracking-tight">TELEMETRIA CINÉTICA PRO</h1>
        </div>

        {subscription?.is_pro ? (
          <div className="shrink-0 px-3 py-1.5 rounded-xl bg-[#22C55E]/15 border border-[#22C55E]/40 text-center">
            <span className="font-telemetry text-[10px] text-[#22C55E] font-black uppercase block">
              PRO ATIVO
            </span>
            {subscription.trial_days_left > 0 && (
              <span className="font-telemetry text-[9px] text-[#A1A1AA]">
                teste: {subscription.trial_days_left}d
              </span>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenCheckout}
            className="shrink-0 px-3 py-1.5 rounded-xl bg-[#FF5500] hover:bg-[#FF6B00] text-[#0D0D0D] font-headline text-xs uppercase tracking-wider font-extrabold flex items-center space-x-1.5 shadow-md shadow-[#FF5500]/25 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">workspace_premium</span>
            <span>UPGRADE PRO</span>
          </button>
        )}
      </div>

      {/* Atalhos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <button
          onClick={onOpenFieldProtocol}
          className="min-h-[52px] p-3 rounded-xl bg-[#1C1C1C] hover:bg-[#262626] border border-[#262626] flex flex-col items-center justify-center gap-1 text-center cursor-pointer transition-all shadow"
        >
          <span className="material-symbols-outlined text-[#FF5500] text-[22px]">biotech</span>
          <span className="font-label-caps text-[9px] uppercase font-bold text-[#F7F5F3]">Protocolo LTHR</span>
        </button>

        <button
          onClick={onOpenStoryExporter}
          className="min-h-[52px] p-3 rounded-xl bg-[#1C1C1C] hover:bg-[#262626] border border-[#262626] flex flex-col items-center justify-center gap-1 text-center cursor-pointer transition-all shadow"
        >
          <span className="material-symbols-outlined text-[#22C55E] text-[22px]">auto_stories</span>
          <span className="font-label-caps text-[9px] uppercase font-bold text-[#F7F5F3]">Stories & TikTok 9:16</span>
        </button>

        <button
          onClick={onOpenGearGarage}
          className="min-h-[52px] p-3 rounded-xl bg-[#1C1C1C] hover:bg-[#262626] border border-[#262626] flex flex-col items-center justify-center gap-1 text-center cursor-pointer transition-all shadow"
        >
          <span className="material-symbols-outlined text-[#FACC15] text-[22px]">footprint</span>
          <span className="font-label-caps text-[9px] uppercase font-bold text-[#F7F5F3]">Garagem de Tênis</span>
        </button>

        <button
          onClick={onOpenBleHardware}
          className="min-h-[52px] p-3 rounded-xl bg-[#1C1C1C] hover:bg-[#262626] border border-[#262626] flex flex-col items-center justify-center gap-1 text-center cursor-pointer transition-all shadow"
        >
          <span className="material-symbols-outlined text-[#3B82F6] text-[22px]">bluetooth</span>
          <span className="font-label-caps text-[9px] uppercase font-bold text-[#F7F5F3]">Sensores BLE</span>
        </button>
      </div>

      {exportMessage && (
        <div className="bg-[#22C55E]/15 border border-[#22C55E] text-[#22C55E] p-3 rounded-lg text-xs font-body font-bold flex items-center space-x-2">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{exportMessage}</span>
        </div>
      )}

      {/* 1. ACWR */}
      <div className="rounded-xl bg-[#1C1C1C] p-5 border border-[#262626] shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-3 gap-2">
          <span className="font-label-caps text-xs text-[#FF5500] uppercase font-extrabold tracking-wider">
            CARGA AGUDA : CRÔNICA (ACWR)
          </span>
          {zoneMeta && acwr != null && (
            <span
              className="font-telemetry text-xs px-2 py-0.5 rounded font-bold border shrink-0"
              style={{
                color: zoneMeta.color,
                backgroundColor: `${zoneMeta.color}1A`,
                borderColor: `${zoneMeta.color}33`,
              }}
            >
              {zoneMeta.label} ({acwr})
            </span>
          )}
        </div>

        {acwr == null ? (
          <div className="bg-[#101010] p-4 rounded-lg border border-[#202020]">
            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              A razão carga aguda/crônica precisa de pelo menos quatro semanas de treinos registrados.
              {trainingLoad ? ` Você tem ${trainingLoad.sessions_28d} sessão(ões) nos últimos 28 dias.` : ''}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <span className="font-metric-hero-mobile text-[#F7F5F3]">{acwr.toFixed(2)}</span>
                <span className="font-telemetry text-[10px] text-[#737373] block mt-0.5">
                  Faixa alvo 0.8 – 1.3
                </span>
              </div>
              <div className="text-right font-telemetry text-[10px] text-[#737373] shrink-0">
                <span className="block">Risco de lesão</span>
                <span className="font-bold text-xs" style={{ color: zoneMeta?.color }}>
                  {zoneMeta?.risk}
                </span>
              </div>
            </div>

            <div className="w-full h-3 bg-[#101010] rounded-full overflow-hidden relative border border-[#202020] my-2">
              {/* Faixa segura: 0.8 a 1.3 numa escala de 0 a 2.0 */}
              <div className="absolute top-0 bottom-0 bg-[#22C55E]/30" style={{ left: '40%', width: '25%' }} />
              <div
                className="absolute top-0 bottom-0 w-2.5 bg-[#FF5500] rounded-full shadow-[0_0_8px_#FF5500]"
                style={{ left: `calc(${acwrPinPct}% - 5px)` }}
              />
            </div>

            <div className="flex justify-between font-label-sm text-[9px] text-[#737373]">
              <span>0.0</span>
              <span className="text-[#22C55E] font-bold">0.8 – 1.3 (Zona Segura)</span>
              <span className="text-[#EF4444]">1.5+ (Sobrecarga)</span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="bg-[#101010] p-2.5 rounded-lg border border-[#262626]">
                <span className="font-label-sm text-[9px] text-[#737373] uppercase block">CARGA 7 DIAS</span>
                <span className="font-telemetry text-sm text-[#F7F5F3] font-bold">
                  {trainingLoad?.acute_load.toLocaleString('pt-BR')}
                </span>
              </div>
              <div className="bg-[#101010] p-2.5 rounded-lg border border-[#262626]">
                <span className="font-label-sm text-[9px] text-[#737373] uppercase block">MÉDIA SEMANAL 28D</span>
                <span className="font-telemetry text-sm text-[#F7F5F3] font-bold">
                  {trainingLoad?.chronic_weekly_load.toLocaleString('pt-BR')}
                </span>
              </div>
            </div>

            <p className="text-[10px] text-[#737373] leading-relaxed mt-2.5">
              Carga por sessão = duração × PSE (Foster, 1998); razão aguda/crônica conforme Gabbett (2016).
              {trainingLoad && trainingLoad.sessions_without_rpe > 0 && (
                <>
                  {' '}
                  {trainingLoad.sessions_without_rpe} sessão(ões) sem PSE registrada entraram apenas pela duração,
                  o que subestima a carga.
                </>
              )}
            </p>
          </>
        )}
      </div>

      {/* 2. VO2 máx e limiar */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#1C1C1C] p-4 rounded-xl border border-[#262626]">
          <div className="flex items-center justify-between text-[#737373]">
            <span className="font-label-caps text-[10px] uppercase font-bold">VO₂ MÁX ESTIMADO</span>
            <span className="material-symbols-outlined text-[16px] text-[#FF5500]">speed</span>
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="font-headline-lg-mobile text-[#F7F5F3]">
              {athlete.vo2Max > 0 ? athlete.vo2Max : '—'}
            </span>
            <span className="font-label-sm text-[10px] text-[#737373] font-bold">mL/kg/min</span>
          </div>
          <span
            className={`font-label-sm text-[10px] font-bold block mt-1 ${
              vo2maxTrendPercent == null
                ? 'text-[#737373]'
                : vo2maxTrendPercent >= 0
                  ? 'text-[#22C55E]'
                  : 'text-[#EF4444]'
            }`}
          >
            {vo2maxTrendPercent == null
              ? 'sem histórico para comparar'
              : `${vo2maxTrendPercent >= 0 ? '+' : ''}${vo2maxTrendPercent}% no período`}
          </span>
        </div>

        <div className="bg-[#1C1C1C] p-4 rounded-xl border border-[#262626]">
          <div className="flex items-center justify-between text-[#737373]">
            <span className="font-label-caps text-[10px] uppercase font-bold">LIMIAR ANAERÓBICO</span>
            <span className="material-symbols-outlined text-[16px] text-[#FF5500]">timeline</span>
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="font-headline-lg-mobile text-[#FF5500]">{athlete.thresholdPace}</span>
          </div>
          <span className="font-label-sm text-[10px] text-[#737373] block mt-1">
            {hrZones?.Z4
              ? `Z4: ${hrZones.Z4.minBpm}–${hrZones.Z4.maxBpm} bpm`
              : 'rode o teste de campo para individualizar'}
          </span>
        </div>
      </div>

      {/* 3. Série de lnRMSSD */}
      <div className="rounded-xl bg-[#1C1C1C] p-5 border border-[#262626] shadow-xl space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-label-caps text-xs text-[#F7F5F3] uppercase font-bold tracking-wider">
            SÉRIE DE lnRMSSD
          </span>
          <span className="font-telemetry text-xs text-[#FF5500] shrink-0">
            {hrvChart ? `média ${hrvChart.mean}` : 'sem dados'}
          </span>
        </div>

        <div className="h-44 w-full bg-[#101010] rounded-lg p-3 relative border border-[#202020] flex flex-col justify-end">
          {hrvChart ? (
            <>
              <svg className="w-full h-full" viewBox="0 0 300 120" preserveAspectRatio="none">
                <line x1="0" y1="30" x2="300" y2="30" stroke="#222" strokeDasharray="3,3" />
                <line x1="0" y1="60" x2="300" y2="60" stroke="#222" strokeDasharray="3,3" />
                <line x1="0" y1="90" x2="300" y2="90" stroke="#222" strokeDasharray="3,3" />

                {/* Linha da média do período */}
                <line
                  x1="0"
                  y1={hrvChart.meanY}
                  x2="300"
                  y2={hrvChart.meanY}
                  stroke="#22C55E"
                  strokeWidth="1"
                  strokeDasharray="4,4"
                />

                <path d={hrvChart.path} fill="none" stroke="#FF5500" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>

              <div className="flex justify-between text-[10px] font-telemetry text-[#737373] mt-1">
                <span>{hrvChart.firstDate}</span>
                <span className="text-[#22C55E]">linha tracejada = média do período</span>
                <span>{hrvChart.lastDate}</span>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <span className="material-symbols-outlined text-[30px] text-[#404040]">monitoring</span>
              <p className="text-xs text-[#737373] mt-1.5 max-w-xs leading-relaxed">
                Faça medições matinais por alguns dias para formar a série de variabilidade cardíaca.
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-[#101010] p-2.5 rounded-lg border border-[#262626]">
            <span className="font-label-sm text-[9px] text-[#737373] uppercase block">RMSSD HOJE</span>
            <span className="font-telemetry text-sm text-[#FF5500] font-bold">
              {readiness.hrvRmssd || '—'} ms
            </span>
          </div>
          <div className="bg-[#101010] p-2.5 rounded-lg border border-[#262626]">
            <span className="font-label-sm text-[9px] text-[#737373] uppercase block">VS. BASELINE</span>
            <span className="font-telemetry text-sm text-[#F7F5F3] font-bold">
              {readiness.hrvPercentage || '—'}%
            </span>
          </div>
          <div className="bg-[#101010] p-2.5 rounded-lg border border-[#262626]">
            <span className="font-label-sm text-[9px] text-[#737373] uppercase block">MEDIÇÕES</span>
            <span className="font-telemetry text-sm text-[#F7F5F3] font-bold">{hrvChart?.count ?? 0}</span>
          </div>
        </div>
      </div>

      {/* 4. Sensores pareados */}
      <div className="rounded-xl bg-[#1C1C1C] p-5 border border-[#262626] space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-label-caps text-xs text-[#F7F5F3] uppercase font-extrabold tracking-wider">
            HUB DE SENSORES PERIFÉRICOS (BLE)
          </span>
          <span
            className={`w-2 h-2 rounded-full ${devices.length ? 'bg-[#22C55E] animate-pulse' : 'bg-[#737373]'}`}
          />
        </div>

        {devices.length === 0 ? (
          <div className="bg-[#101010] p-4 rounded-lg border border-[#202020] text-center">
            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              Nenhum sensor pareado ainda.
            </p>
            <button
              onClick={onOpenBleHardware}
              className="mt-2 text-xs text-[#FF5500] font-bold uppercase hover:underline cursor-pointer"
            >
              Parear sensor BLE
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {devices.map((device) => (
              <div
                key={device.id}
                className="p-3 rounded-lg border bg-[#201f1f] border-[#FF5500]/40 flex items-center justify-between gap-3"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <span className="material-symbols-outlined text-[#FF5500] text-[20px] shrink-0">
                    {DEVICE_TYPE_ICON[device.device_type] || 'sensors'}
                  </span>
                  <div className="min-w-0">
                    <span className="font-body text-xs font-bold text-[#F7F5F3] block truncate uppercase">
                      {device.brand}
                    </span>
                    <span className="font-telemetry text-[10px] text-[#737373] truncate block">
                      {DEVICE_TYPE_LABEL[device.device_type] || 'Sensor'}
                    </span>
                  </div>
                </div>
                <span className="font-label-sm text-[10px] text-[#22C55E] font-bold shrink-0">PAREADO</span>
              </div>
            ))}

            <button
              onClick={onOpenBleHardware}
              className="w-full h-10 rounded-lg bg-[#101010] border border-[#262626] text-xs font-bold uppercase text-[#A1A1AA] hover:text-[#F7F5F3] cursor-pointer"
            >
              Gerenciar sensores
            </button>
          </div>
        )}

        <p className="text-[10px] text-[#737373] leading-relaxed">
          O nível de bateria do sensor só aparece enquanto ele está conectado, na tela de pareamento.
        </p>
      </div>

      {/* 5. Exportação */}
      <div className="rounded-xl bg-[#141414] p-4 border border-[#262626] space-y-3">
        <span className="font-label-caps text-[10px] text-[#737373] uppercase font-bold tracking-wider block">
          EXPORTAÇÃO DE DADOS
        </span>
        <button
          onClick={handleExportCsv}
          className="w-full h-11 rounded bg-[#1C1C1C] hover:bg-[#FF5500] hover:text-[#0D0D0D] text-[#F7F5F3] text-xs font-telemetry font-bold border border-[#262626] transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
          <span>BAIXAR HISTÓRICO (.CSV)</span>
        </button>
        <p className="text-[10px] text-[#737373] leading-relaxed">
          Exporta suas atividades com data, distância, duração, ritmo e frequência cardíaca. Arquivos .FIT e
          sincronização com Strava dependem de integração externa ainda não configurada.
        </p>
      </div>
    </div>
  );
};
