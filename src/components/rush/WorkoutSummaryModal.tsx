// ============================================================
// RUSH RUNNING — Resumo da Sessão Concluída
// ------------------------------------------------------------
// Todos os números vêm do rastreamento real da corrida:
// distância e traçado do GNSS, tempo do cronômetro, voltas
// marcadas pelo atleta e frequência cardíaca da cinta BLE.
//
// Métricas que dependem de sensores que o navegador não expõe
// (cadência, potência, oscilação vertical, tempo de contato com
// o solo) não aparecem como números inventados: a aba de dinâmica
// mostra as curvas de ritmo e cardio que de fato foram medidas.
// ============================================================

import React, { useMemo, useState } from 'react';
import { ImageViewerItem } from '../../types';
import { RunSummary, formatClock } from '../../hooks/useRunTracker';

interface WorkoutSummaryModalProps {
  isOpen: boolean;
  summary: RunSummary | null;
  /** Zonas de FC individualizadas devolvidas pelo agente de treino. */
  hrZones: Record<string, { name: string; minBpm: number; maxBpm: number }> | null;
  /** Recordes atuais por distância, para detectar novo RP. */
  personalRecords: Record<string, { duration_seconds: number; formatted: string } | null> | null;
  /** Peso do atleta, usado só para a ESTIMATIVA de gasto calórico. */
  weightKg: number | null;
  onClose: () => void;
  onOpenStoryExporter: () => void;
  onPublishToFeed: () => void;
  onViewImage: (item: ImageViewerItem) => void;
}

const ZONE_COLORS: Record<string, string> = {
  Z5: '#EF4444',
  Z4: '#FF5500',
  Z3: '#FACC15',
  Z2: '#22C55E',
  Z1: '#3B82F6',
};

/** Distâncias oficiais e a tolerância aceita para contar como tal. */
const OFFICIAL_DISTANCES: { key: string; label: string; km: number; maxKm: number }[] = [
  { key: '5k', label: '5 KM', km: 5, maxKm: 6.5 },
  { key: '10k', label: '10 KM', km: 10, maxKm: 12.5 },
  { key: '21k', label: 'MEIA MARATONA', km: 21.0975, maxKm: 24 },
  { key: '42k', label: 'MARATONA', km: 42.195, maxKm: 47 },
];

/** Projeta o traçado GNSS num viewBox SVG, preservando proporção. */
function buildRoutePath(track: RunSummary['track'], width: number, height: number): string | null {
  if (!track || track.length < 2) return null;

  const lats = track.map((p) => p.lat);
  const lons = track.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const spanLat = maxLat - minLat || 1e-6;
  const spanLon = maxLon - minLon || 1e-6;
  // Compensa a convergência dos meridianos na latitude média.
  const latRad = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const spanLonMeters = spanLon * Math.cos(latRad);

  const scale = Math.min(width / (spanLonMeters || 1e-6), height / spanLat) * 0.88;
  const offsetX = (width - spanLonMeters * scale) / 2;
  const offsetY = (height - spanLat * scale) / 2;

  return track
    .map((p, i) => {
      const x = offsetX + (p.lon - minLon) * Math.cos(latRad) * scale;
      // O eixo Y do SVG cresce para baixo; a latitude cresce para o norte.
      const y = height - offsetY - (p.lat - minLat) * scale;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

export const WorkoutSummaryModal: React.FC<WorkoutSummaryModalProps> = ({
  isOpen,
  summary,
  hrZones,
  personalRecords,
  weightKg,
  onClose,
  onOpenStoryExporter,
  onPublishToFeed,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'splits' | 'dynamics'>('overview');

  /* ---------- distância oficial e recorde pessoal ---------- */
  const officialMatch = useMemo(() => {
    if (!summary) return null;
    return (
      OFFICIAL_DISTANCES.find((d) => summary.distanceKm >= d.km && summary.distanceKm <= d.maxKm) || null
    );
  }, [summary]);

  const recordResult = useMemo(() => {
    if (!summary || !officialMatch || !personalRecords) return null;
    const previous = personalRecords[officialMatch.key];
    // Tempo normalizado para a distância oficial pelo pace médio.
    const normalized = Math.round((summary.durationSeconds / summary.distanceKm) * officialMatch.km);

    if (!previous) {
      return { isRecord: true, label: officialMatch.label, deltaSeconds: null, normalized };
    }
    if (normalized < previous.duration_seconds) {
      return {
        isRecord: true,
        label: officialMatch.label,
        deltaSeconds: previous.duration_seconds - normalized,
        normalized,
      };
    }
    return { isRecord: false, label: officialMatch.label, deltaSeconds: null, normalized };
  }, [summary, officialMatch, personalRecords]);

  /* ---------- distribuição por zona a partir das amostras reais ---------- */
  const zoneDistribution = useMemo(() => {
    if (!summary || !hrZones || summary.hrSamples.length < 2) return null;

    const order = ['Z5', 'Z4', 'Z3', 'Z2', 'Z1'];
    const secondsInZone: Record<string, number> = { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 };

    for (let i = 1; i < summary.hrSamples.length; i++) {
      const prev = summary.hrSamples[i - 1];
      const delta = Math.max(0, summary.hrSamples[i].t - prev.t);
      const zone = order.find((z) => {
        const bounds = hrZones[z];
        return bounds && prev.bpm >= bounds.minBpm && prev.bpm <= bounds.maxBpm;
      });
      if (zone) secondsInZone[zone] += delta;
    }

    const total = Object.values(secondsInZone).reduce((a, b) => a + b, 0);
    if (total <= 0) return null;

    return order
      .map((z) => ({
        zone: z,
        name: hrZones[z]?.name || z,
        range: hrZones[z] ? `${hrZones[z].minBpm}–${hrZones[z].maxBpm}` : '',
        seconds: secondsInZone[z],
        pct: Math.round((secondsInZone[z] / total) * 100),
        color: ZONE_COLORS[z],
      }))
      .filter((z) => z.seconds > 0);
  }, [summary, hrZones]);

  const dominantZone = useMemo(
    () => (zoneDistribution ? zoneDistribution.reduce((a, b) => (b.pct > a.pct ? b : a)) : null),
    [zoneDistribution],
  );

  /* ---------- estimativa de gasto calórico ---------- */
  // Regra prática amplamente usada para corrida: ~1,036 kcal por kg de massa
  // corporal por km percorrido. É uma APROXIMAÇÃO — não considera inclinação,
  // eficiência individual nem intensidade — e por isso vem rotulada como
  // estimada. Sem o peso cadastrado, nada é exibido.
  const estimatedKcal = useMemo(() => {
    if (!summary || !weightKg || summary.distanceKm <= 0) return null;
    return Math.round(weightKg * summary.distanceKm * 1.036);
  }, [summary, weightKg]);

  /* ---------- voltas ---------- */
  const fastestLapIndex = useMemo(() => {
    if (!summary || summary.laps.length === 0) return -1;
    let best = -1;
    let bestPace = Infinity;
    summary.laps.forEach((lap, i) => {
      if (lap.distanceKm <= 0) return;
      const pace = lap.durationSeconds / lap.distanceKm;
      if (pace < bestPace) {
        bestPace = pace;
        best = i;
      }
    });
    return best;
  }, [summary]);

  const routePath = useMemo(() => (summary ? buildRoutePath(summary.track, 400, 160) : null), [summary]);

  if (!isOpen || !summary) return null;

  const title = officialMatch
    ? `${officialMatch.label} • ${summary.distanceKm.toFixed(2)} KM`
    : `SESSÃO • ${summary.distanceKm.toFixed(2)} KM`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="summary-title"
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/92 backdrop-blur-md transition-opacity"
    >
      <div className="flex-1 w-full" onClick={onClose} />

      <div className="relative w-full max-w-xl mx-auto max-h-[95vh] flex flex-col bg-[#0D0D0D] rounded-t-3xl border-t border-[#22C55E]/60 shadow-[0_-12px_45px_rgba(0,0,0,0.95)] overflow-hidden">
        <div className="w-full flex items-center justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-[#353534]" />
        </div>

        <div className="px-5 py-3 flex items-center justify-between border-b border-[#262626]">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
              <span className="font-label-sm text-[10px] text-[#22C55E] tracking-widest uppercase font-bold">
                TREINO CONCLUÍDO COM SUCESSO
              </span>
            </div>
            <h2 id="summary-title" className="font-headline text-2xl text-[#F7F5F3] uppercase tracking-normal truncate">
              {title}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 shrink-0 rounded-full bg-[#1C1C1C] text-[#A1A1AA] hover:text-[#F7F5F3] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Fechar resumo do treino"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Recorde pessoal */}
          {recordResult?.isRecord && (
            <div className="bg-gradient-to-r from-[#22C55E]/20 via-[#FF5500]/20 to-transparent p-4 rounded-2xl border border-[#22C55E]/50 flex items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-[#22C55E]/25 border border-[#22C55E]/50 flex items-center justify-center text-[#22C55E] shrink-0">
                  <span className="material-symbols-outlined text-[26px]">emoji_events</span>
                </div>
                <div className="min-w-0">
                  <span className="font-headline text-lg text-[#F7F5F3] uppercase tracking-wide block">
                    Novo Recorde Pessoal (RP)!
                  </span>
                  <span className="text-xs text-[#e5e2e1]">
                    {recordResult.deltaSeconds
                      ? `-${formatClock(recordResult.deltaSeconds)} em relação à melhor marca anterior de ${recordResult.label}.`
                      : `Primeira marca registrada em ${recordResult.label}.`}
                  </span>
                </div>
              </div>
              <span className="font-telemetry text-xs font-black text-[#22C55E] bg-[#22C55E]/20 px-2 py-1 rounded shrink-0">
                {formatClock(recordResult.normalized)}
              </span>
            </div>
          )}

          {/* Telemetria principal */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-[#1C1C1C] p-3 rounded-xl border border-[#262626]">
              <span className="text-[10px] text-[#A1A1AA] uppercase block font-label-caps">DISTÂNCIA</span>
              <span className="font-headline text-2xl text-[#F7F5F3] block mt-0.5">
                {summary.distanceKm.toFixed(2)}
              </span>
              <span className="text-[10px] text-[#A1A1AA]">Quilômetros</span>
            </div>
            <div className="bg-[#1C1C1C] p-3 rounded-xl border border-[#262626]">
              <span className="text-[10px] text-[#A1A1AA] uppercase block font-label-caps">TEMPO</span>
              <span className="font-headline text-2xl text-[#FF5500] block mt-0.5">
                {formatClock(summary.durationSeconds)}
              </span>
              <span className="text-[10px] text-[#A1A1AA]">{summary.avgPace} /km médio</span>
            </div>
            <div className="bg-[#1C1C1C] p-3 rounded-xl border border-[#262626]">
              <span className="text-[10px] text-[#A1A1AA] uppercase block font-label-caps">CARDIO</span>
              <span className="font-headline text-2xl text-[#F7F5F3] block mt-0.5">
                {summary.avgHr ?? '—'}
              </span>
              <span className="text-[10px] text-[#A1A1AA]">
                {summary.avgHr ? `BPM médio • máx ${summary.maxHr}` : 'sem cinta conectada'}
              </span>
            </div>
          </div>

          {/* Abas */}
          <div className="flex items-center gap-1.5 bg-[#1C1C1C] p-1 rounded-xl border border-[#262626]">
            {[
              { id: 'overview', label: 'Traçado & Zonas' },
              { id: 'splits', label: 'Voltas' },
              { id: 'dynamics', label: 'Curvas' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 min-h-[44px] py-2 px-2 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                  activeTab === tab.id ? 'bg-[#FF5500] text-[#0D0D0D] shadow-md' : 'text-[#A1A1AA] hover:text-[#F7F5F3]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Aba 1 — traçado e zonas */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] overflow-hidden shadow-lg space-y-3">
                <div className="relative h-44 bg-[#101010] flex items-center justify-center overflow-hidden">
                  {routePath ? (
                    <svg className="absolute inset-0 w-full h-full p-4" viewBox="0 0 400 160" preserveAspectRatio="xMidYMid meet">
                      <path d={routePath} fill="none" stroke="#FF5500" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <div className="text-center px-6">
                      <span className="material-symbols-outlined text-[32px] text-[#404040]">map</span>
                      <p className="text-xs text-[#737373] mt-1">
                        Traçado indisponível: nenhum ponto de GPS válido foi registrado.
                      </p>
                    </div>
                  )}

                  {routePath && (
                    <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/20 text-xs font-telemetry flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
                      <span>{summary.track.length} PONTOS GNSS</span>
                    </div>
                  )}

                  {fastestLapIndex >= 0 && (
                    <div className="absolute bottom-3 right-3 bg-[#FF5500] text-[#0D0D0D] font-headline text-xs px-2.5 py-1 rounded shadow">
                      VOLTA MAIS RÁPIDA: {summary.laps[fastestLapIndex].avgPace}/km
                    </div>
                  )}
                </div>

                <div className="px-4 pb-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-[#101010] p-2.5 rounded-lg border border-[#262626]">
                    <span className="text-[#A1A1AA] uppercase text-[10px] block">VOLTAS</span>
                    <span className="font-telemetry text-sm text-[#F7F5F3] font-bold mt-0.5 block">
                      {summary.laps.length || '—'}
                    </span>
                  </div>
                  <div className="bg-[#101010] p-2.5 rounded-lg border border-[#262626]">
                    <span className="text-[#A1A1AA] uppercase text-[10px] block">GASTO EST.</span>
                    <span className="font-telemetry text-sm text-[#F7F5F3] font-bold mt-0.5 block">
                      {estimatedKcal ? `${estimatedKcal.toLocaleString('pt-BR')} kcal` : '—'}
                    </span>
                  </div>
                  <div className="bg-[#101010] p-2.5 rounded-lg border border-[#262626]">
                    <span className="text-[#A1A1AA] uppercase text-[10px] block">FC MÁX</span>
                    <span className="font-telemetry text-sm text-[#22C55E] font-bold mt-0.5 block">
                      {summary.maxHr ? `${summary.maxHr} bpm` : '—'}
                    </span>
                  </div>
                </div>

                {estimatedKcal && (
                  <p className="px-4 pb-3 -mt-1 text-[10px] text-[#737373] leading-relaxed">
                    Gasto calórico é uma estimativa a partir do seu peso e da distância percorrida, não uma medição.
                  </p>
                )}
              </div>

              {/* Zonas cardíacas */}
              <div className="bg-[#1C1C1C] p-4 rounded-2xl border border-[#262626] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-label-caps text-xs text-[#A1A1AA] uppercase tracking-wider">
                    Distribuição pelas Zonas Cardíacas
                  </span>
                  {dominantZone && (
                    <span className="font-telemetry text-xs text-[#FF5500] font-bold">
                      {dominantZone.pct}% EM {dominantZone.zone}
                    </span>
                  )}
                </div>

                {zoneDistribution ? (
                  <div className="space-y-2">
                    {zoneDistribution.map((z) => (
                      <div key={z.zone} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-telemetry">
                          <span
                            className={`font-bold ${z.zone === dominantZone?.zone ? 'text-[#FF5500]' : 'text-[#F7F5F3]'}`}
                          >
                            {z.zone} ({z.name} {z.range})
                          </span>
                          <span className="text-[#A1A1AA]">
                            {formatClock(z.seconds)} ({z.pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-[#101010] rounded-full overflow-hidden border border-[#262626]">
                          <div className="h-full rounded-full" style={{ width: `${z.pct}%`, backgroundColor: z.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#737373] leading-relaxed">
                    A distribuição por zona exige frequência cardíaca contínua. Conecte uma cinta BLE antes da
                    próxima sessão para liberar esta análise.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Aba 2 — voltas */}
          {activeTab === 'splits' && (
            <div className="bg-[#1C1C1C] p-4 rounded-2xl border border-[#262626] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-label-caps text-xs text-[#A1A1AA] uppercase tracking-wider">
                  Voltas marcadas na sessão
                </span>
                <span className="font-telemetry text-xs text-[#22C55E] font-bold">
                  {summary.laps.length} LAPS
                </span>
              </div>

              {summary.laps.length === 0 ? (
                <p className="text-xs text-[#737373] leading-relaxed">
                  Nenhuma volta foi marcada. Use o botão “Volta / Lap” durante a corrida para registrar parciais.
                </p>
              ) : (
                <div className="divide-y divide-[#262626]">
                  {summary.laps.map((lap, i) => (
                    <div
                      key={lap.index}
                      className={`py-2.5 flex items-center justify-between text-xs font-telemetry ${
                        i === fastestLapIndex ? 'bg-[#FF5500]/10 px-2 rounded-lg -mx-2' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#F7F5F3]">VOLTA {lap.index}</span>
                        {i === fastestLapIndex && (
                          <span className="bg-[#FF5500] text-[#0D0D0D] text-[9px] font-extrabold px-1.5 py-0.2 rounded uppercase">
                            MAIS RÁPIDA
                          </span>
                        )}
                      </div>
                      <span className="text-[#A1A1AA]">{lap.distanceKm.toFixed(2)} km</span>
                      <span className="text-[#F7F5F3] font-bold">{formatClock(lap.durationSeconds)}</span>
                      <span className="font-headline text-sm text-[#FF5500]">{lap.avgPace}/km</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Aba 3 — curvas medidas */}
          {activeTab === 'dynamics' && (
            <div className="space-y-3">
              <div className="bg-[#1C1C1C] p-4 rounded-2xl border border-[#262626] space-y-3">
                <span className="font-label-caps text-xs text-[#A1A1AA] uppercase tracking-wider block">
                  Frequência cardíaca ao longo da sessão
                </span>

                {summary.hrSamples.length > 1 ? (
                  <>
                    <svg viewBox="0 0 400 120" className="w-full h-28" preserveAspectRatio="none">
                      {(() => {
                        const bpms = summary.hrSamples.map((s) => s.bpm);
                        const min = Math.min(...bpms) - 5;
                        const max = Math.max(...bpms) + 5;
                        const range = max - min || 1;
                        const lastT = summary.hrSamples[summary.hrSamples.length - 1].t || 1;
                        const d = summary.hrSamples
                          .map((s, i) => {
                            const x = (s.t / lastT) * 400;
                            const y = 120 - ((s.bpm - min) / range) * 110 - 5;
                            return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
                          })
                          .join(' ');
                        return <path d={d} fill="none" stroke="#EF4444" strokeWidth="2" strokeLinejoin="round" />;
                      })()}
                    </svg>
                    <div className="flex items-center justify-between text-[10px] text-[#737373] font-telemetry">
                      <span>0:00</span>
                      <span>{formatClock(summary.durationSeconds)}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-[#737373] leading-relaxed">
                    Sem amostras de frequência cardíaca nesta sessão.
                  </p>
                )}
              </div>

              <div className="bg-[#1C1C1C] p-4 rounded-2xl border border-[#262626] space-y-3">
                <span className="font-label-caps text-xs text-[#A1A1AA] uppercase tracking-wider block">
                  Ritmo por volta
                </span>

                {summary.laps.length > 0 ? (
                  <div className="flex items-end gap-1.5 h-24">
                    {summary.laps.map((lap, i) => {
                      const paces = summary.laps
                        .filter((l) => l.distanceKm > 0)
                        .map((l) => l.durationSeconds / l.distanceKm);
                      const slowest = Math.max(...paces, 1);
                      const pace = lap.distanceKm > 0 ? lap.durationSeconds / lap.distanceKm : slowest;
                      // Barra mais alta = mais rápido.
                      const heightPct = Math.max(12, 100 - (pace / slowest) * 60);
                      return (
                        <div key={lap.index} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                          <div
                            className={`w-full rounded-t ${i === fastestLapIndex ? 'bg-[#FF5500]' : 'bg-[#3f3f3f]'}`}
                            style={{ height: `${heightPct}%` }}
                            title={`Volta ${lap.index}: ${lap.avgPace}/km`}
                          />
                          <span className="text-[9px] text-[#737373] font-telemetry">{lap.index}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-[#737373] leading-relaxed">
                    Marque voltas durante a corrida para comparar o ritmo entre parciais.
                  </p>
                )}
              </div>

              <p className="text-[10px] text-[#737373] leading-relaxed px-1">
                Cadência, potência, oscilação vertical e tempo de contato com o solo exigem sensores dedicados
                (footpod ou medidor de potência) que o navegador não consegue ler.
              </p>
            </div>
          )}

          {/* Ações */}
          <div className="space-y-2.5 pt-2">
            <button
              onClick={() => {
                onClose();
                onOpenStoryExporter();
              }}
              className="w-full min-h-[52px] py-3.5 px-4 bg-[#FF5500] hover:bg-[#FF6B00] active:scale-[0.98] text-[#0D0D0D] rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#FF5500]/25 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[22px]">auto_stories</span>
              <span className="font-headline text-base uppercase tracking-wider whitespace-nowrap">
                Compartilhar Sticker de Telemetria (9:16)
              </span>
            </button>

            <button
              onClick={() => {
                onClose();
                onPublishToFeed();
              }}
              className="w-full min-h-[48px] py-3 px-4 bg-[#262626] hover:bg-[#353534] active:scale-[0.98] text-[#F7F5F3] rounded-xl flex items-center justify-center gap-2 border border-[#353534] transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px] text-[#FF5500]">post_add</span>
              <span className="font-bold text-xs uppercase tracking-wider">Publicar no Feed da Comunidade</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
