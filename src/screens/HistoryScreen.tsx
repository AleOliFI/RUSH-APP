// ============================================================
// RUSH RUNNING — Histórico de treinos
// ------------------------------------------------------------
// Três visões sobre o que já foi corrido: calendário mensal,
// lista corrida e carga aguda:crônica.
//
// O desenho original previa potência (W), cadência (spm) e
// exportação para Strava/PDF. Nada disso existe: o navegador não
// mede potência nem cadência sem footpod, e não há integração com
// a Strava. Em vez de exibir número inventado, esses blocos não
// foram construídos — a exportação disponível é o CSV real.
// ============================================================

import React, { useMemo } from 'react';
import { formatDuration, paceFromActivity, timeAgo } from '../data/adapters';
import type { HistoryActivity, SessionIntensity } from '../hooks/useActivityHistory';
import type { ActivityHistoryData } from '../hooks/useActivityHistory';

type HistoryTab = 'calendario' | 'lista' | 'carga';

interface HistoryScreenProps {
  history: ActivityHistoryData;
  trainingLoad: {
    acwr: number | null;
    zone: string | null;
    has_enough_history: boolean;
    acute_load?: number;
    chronic_weekly_load?: number;
    sessions_28d?: number;
    sessions_without_rpe?: number;
  } | null;
  activeTab: HistoryTab;
  onTabChange: (tab: HistoryTab) => void;
  onViewRoute: (activity: { id: string; title?: string | null }) => void;
  /**
   * Abre o detalhe da atividade. Enquanto essa tela não existir, a ficha
   * apenas exibe — clicar não faz nada, em vez de levar a um lugar errado.
   */
  onOpenActivity?: (activityId: string) => void;
  onExportCsv: () => void;
}

const MESES = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];

const DIAS_SEMANA = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];

/** Cores por intensidade derivada. Cinza = intensidade desconhecida. */
const INTENSIDADE: Record<SessionIntensity, { cor: string; rotulo: string }> = {
  hiit: { cor: '#FF5500', rotulo: 'Intenso / Z4–Z5' },
  tempo: { cor: '#38BDF8', rotulo: 'Moderado / Z3' },
  regen: { cor: '#22C55E', rotulo: 'Leve / Z1–Z2' },
  indefinida: { cor: '#525252', rotulo: 'Sem FC nem RPE' },
};

const TIPO_ROTULO: Record<string, string> = {
  run: 'Corrida',
  trail_run: 'Trilha',
  treadmill: 'Esteira',
  walk: 'Caminhada',
  cycling: 'Pedal',
  swimming: 'Natação',
  strength: 'Força',
  other: 'Outro',
};

const ACWR_ZONA: Record<string, { texto: string; cor: string }> = {
  destreinamento: { texto: 'Carga abaixo da faixa', cor: '#38BDF8' },
  ideal: { texto: 'Dentro da faixa de equilíbrio', cor: '#22C55E' },
  atencao: { texto: 'Carga acima da faixa', cor: '#FACC15' },
  sobrecarga: { texto: 'Risco de sobrecarga', cor: '#EF4444' },
};

function formatarDataLonga(iso: string): string {
  const data = new Date(`${iso}T12:00:00`);
  const semana = ['DOMINGO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'];
  return `${semana[data.getDay()]}, ${data.getDate()} ${MESES[data.getMonth()].slice(0, 3)}`;
}

/** Ficha de uma atividade, usada no dia selecionado e na lista do mês. */
const ActivityCard: React.FC<{
  activity: HistoryActivity;
  onViewRoute: HistoryScreenProps['onViewRoute'];
  onOpen?: (id: string) => void;
}> = ({ activity, onViewRoute, onOpen }) => {
  const intensidade = INTENSIDADE[activity.intensity];
  const Conteudo = onOpen ? 'button' : 'div';

  return (
    <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] overflow-hidden">
      <Conteudo
        {...(onOpen
          ? { type: 'button' as const, onClick: () => onOpen(activity.id) }
          : {})}
        className={`w-full text-left p-4 space-y-2.5 block ${
          onOpen ? 'hover:bg-[#202020] transition-colors cursor-pointer' : ''
        }`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="font-telemetry text-[9px] font-black uppercase px-2 py-0.5 rounded"
            style={{ backgroundColor: `${intensidade.cor}22`, color: intensidade.cor }}
          >
            {TIPO_ROTULO[activity.type] || activity.type} • {intensidade.rotulo}
          </span>
          <span className="font-telemetry text-[10px] text-[#737373] ml-auto">
            {timeAgo(activity.date)}
          </span>
        </div>

        <h3 className="font-headline text-lg text-[#F7F5F3] uppercase leading-tight truncate">
          {activity.title || 'Atividade'}
        </h3>

        <div className="grid grid-cols-4 gap-2">
          <div>
            <span className="font-telemetry text-[9px] text-[#737373] uppercase block">Distância</span>
            <span className="font-headline text-base text-[#F7F5F3]">
              {activity.distance_km.toFixed(2)}
              <span className="text-[10px] text-[#A1A1AA] ml-0.5">km</span>
            </span>
          </div>
          <div>
            <span className="font-telemetry text-[9px] text-[#737373] uppercase block">Duração</span>
            <span className="font-headline text-base text-[#F7F5F3]">
              {formatDuration(activity.duration_seconds)}
            </span>
          </div>
          <div>
            <span className="font-telemetry text-[9px] text-[#737373] uppercase block">Pace méd.</span>
            <span className="font-headline text-base text-[#FF5500]">
              {activity.avg_pace ||
                (activity.distance_km > 0
                  ? `${paceFromActivity(activity.distance_km, activity.duration_seconds)}/km`
                  : '—')}
            </span>
          </div>
          <div>
            <span className="font-telemetry text-[9px] text-[#737373] uppercase block">FC méd.</span>
            <span className="font-headline text-base text-[#EF4444]">
              {activity.avg_hr ? `${activity.avg_hr}` : '—'}
              {activity.avg_hr && <span className="text-[10px] text-[#A1A1AA] ml-0.5">bpm</span>}
            </span>
          </div>
        </div>

        {(activity.feeling_notes || activity.description) && (
          <p className="text-xs text-[#A1A1AA] leading-relaxed line-clamp-2">
            {activity.feeling_notes || activity.description}
          </p>
        )}

        {activity.rpe_score != null && (
          <span className="font-telemetry text-[10px] text-[#A1A1AA]">
            Esforço percebido: {activity.rpe_score}/10
          </span>
        )}
      </Conteudo>

      {activity.has_track && (
        <button
          type="button"
          onClick={() => onViewRoute({ id: activity.id, title: activity.title })}
          className="w-full min-h-[42px] bg-[#101010] hover:bg-[#262626] border-t border-[#262626] flex items-center justify-center gap-2 text-[#F7F5F3] cursor-pointer transition-colors"
        >
          <span className="material-symbols-outlined text-[#FF5500] text-[18px]">route</span>
          <span className="text-[11px] font-bold uppercase tracking-wider">Ver percurso</span>
        </button>
      )}
    </div>
  );
};

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  history,
  trainingLoad,
  activeTab,
  onTabChange,
  onViewRoute,
  onOpenActivity,
  onExportCsv,
}) => {
  const {
    month, goToPreviousMonth, goToNextMonth, isCurrentMonth,
    selectedDate, selectDate, days, selectedDayActivities, monthActivities,
    monthSummary, weekSummary, weekRange, typeFilter, setTypeFilter,
    availableTypes, isLoading, error,
  } = history;

  /** Grade do mês começando na segunda-feira, com os vazios do início. */
  const gradeDoMes = useMemo(() => {
    const primeiro = new Date(month.getFullYear(), month.getMonth(), 1);
    const totalDias = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const deslocamento = (primeiro.getDay() + 6) % 7;

    const celulas: (string | null)[] = Array(deslocamento).fill(null);
    for (let dia = 1; dia <= totalDias; dia++) {
      celulas.push(
        `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
      );
    }
    return celulas;
  }, [month]);

  const hojeIso = useMemo(() => {
    const agora = new Date();
    return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
  }, []);

  const zonaAcwr = trainingLoad?.zone ? ACWR_ZONA[trainingLoad.zone] : null;

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto px-4 sm:px-5 space-y-4 pt-2 pb-8">
      {/* Seletor de visão */}
      <div className="grid grid-cols-3 p-1 rounded-xl bg-[#1C1C1C] gap-1 border border-[#262626]">
        {([
          { id: 'calendario', label: 'Calendário' },
          { id: 'lista', label: 'Lista de treinos' },
          { id: 'carga', label: 'Carga ACWR' },
        ] as const).map((aba) => (
          <button
            key={aba.id}
            type="button"
            onClick={() => onTabChange(aba.id)}
            aria-pressed={activeTab === aba.id}
            className={`min-h-[44px] py-2 px-1 rounded-lg font-label-caps text-[10px] uppercase tracking-wider font-extrabold transition-all cursor-pointer ${
              activeTab === aba.id
                ? 'bg-[#FF5500] text-[#0D0D0D] shadow-[0_0_12px_rgba(255,85,0,0.35)]'
                : 'bg-[#141414] text-[#A1A1AA] hover:text-[#F7F5F3]'
            }`}
          >
            {aba.label}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="bg-[#EF4444]/12 border border-[#EF4444]/40 rounded-xl px-4 py-3">
          <span className="text-xs text-[#e5e2e1]">{error}</span>
        </div>
      )}

      {/* Navegação de mês — comum ao calendário e à lista */}
      {activeTab !== 'carga' && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline text-2xl text-[#F7F5F3] uppercase leading-none">
              {MESES[month.getMonth()]} {month.getFullYear()}
            </h2>
            <span className="font-telemetry text-[10px] text-[#A1A1AA] uppercase tracking-wider">
              {monthSummary.activityCount === 0
                ? 'Nenhum treino registrado'
                : `${monthSummary.activityCount} ${monthSummary.activityCount === 1 ? 'treino' : 'treinos'} • ${monthSummary.distanceKm.toFixed(1)} km`}
            </span>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={goToPreviousMonth}
              aria-label="Mês anterior"
              className="w-11 h-11 rounded-xl bg-[#1C1C1C] border border-[#262626] text-[#A1A1AA] hover:text-[#F7F5F3] flex items-center justify-center cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            <button
              type="button"
              onClick={goToNextMonth}
              disabled={isCurrentMonth}
              aria-label="Próximo mês"
              className="w-11 h-11 rounded-xl bg-[#1C1C1C] border border-[#262626] text-[#A1A1AA] hover:text-[#F7F5F3] disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
          </div>
        </div>
      )}

      {/* ---------------- CALENDÁRIO ---------------- */}
      {activeTab === 'calendario' && (
        <>
          <div className="bg-[#141414] rounded-2xl border border-[#262626] p-3 space-y-2">
            <div className="grid grid-cols-7 gap-1">
              {DIAS_SEMANA.map((dia) => (
                <span
                  key={dia}
                  className="font-telemetry text-[9px] text-[#737373] uppercase text-center py-1"
                >
                  {dia}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {gradeDoMes.map((iso, indice) => {
                if (!iso) return <span key={`vazio-${indice}`} />;

                const bucket = days[iso];
                const numero = Number(iso.split('-')[2]);
                const selecionado = iso === selectedDate;
                const eHoje = iso === hojeIso;
                const futuro = iso > hojeIso;

                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => selectDate(iso)}
                    aria-pressed={selecionado}
                    aria-label={`${numero} — ${bucket ? `${bucket.activities.length} treino(s)` : 'sem treino'}`}
                    className={`min-h-[46px] rounded-lg flex flex-col items-center justify-center gap-1 transition-all cursor-pointer border ${
                      selecionado
                        ? 'border-[#FF5500] bg-[#FF5500]/10'
                        : 'border-transparent hover:bg-[#1C1C1C]'
                    }`}
                  >
                    <span
                      className={`font-telemetry text-xs ${
                        futuro ? 'text-[#404040]' : eHoje ? 'text-[#FF5500] font-bold' : 'text-[#e5e2e1]'
                      }`}
                    >
                      {String(numero).padStart(2, '0')}
                    </span>
                    <span className="flex gap-0.5 h-1.5 items-center">
                      {(bucket?.intensities || []).slice(0, 3).map((intensidade) => (
                        <span
                          key={intensidade}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: INTENSIDADE[intensidade].cor }}
                        />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Legenda — explicita que a intensidade é derivada */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 border-t border-[#262626]">
              {(Object.keys(INTENSIDADE) as SessionIntensity[]).map((chave) => (
                <span key={chave} className="flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: INTENSIDADE[chave].cor }}
                  />
                  <span className="font-telemetry text-[9px] text-[#A1A1AA] uppercase">
                    {INTENSIDADE[chave].rotulo}
                  </span>
                </span>
              ))}
            </div>
            <p className="text-[10px] text-[#737373] leading-relaxed">
              A intensidade é deduzida da FC média contra as suas zonas; sem FC, do esforço percebido
              que você informou. Sessões sem nenhum dos dois ficam sem classificação.
            </p>
          </div>

          {/* Resumo da semana do dia selecionado */}
          <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-label-caps text-[10px] text-[#A1A1AA] uppercase tracking-widest font-extrabold">
                Semana de {weekRange.start.split('-').reverse().slice(0, 2).join('/')} a{' '}
                {weekRange.end.split('-').reverse().slice(0, 2).join('/')}
              </span>
              <span className="font-telemetry text-[10px] text-[#FF5500] font-bold">
                {weekSummary.activityCount} {weekSummary.activityCount === 1 ? 'SESSÃO' : 'SESSÕES'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#101010] rounded-xl p-3 border border-[#262626]">
                <span className="font-telemetry text-[9px] text-[#737373] uppercase block">Volume</span>
                <span className="font-headline text-xl text-[#F7F5F3]">
                  {weekSummary.distanceKm.toFixed(1)}
                  <span className="text-[10px] text-[#A1A1AA] ml-1">KM</span>
                </span>
              </div>
              <div className="bg-[#101010] rounded-xl p-3 border border-[#262626]">
                <span className="font-telemetry text-[9px] text-[#737373] uppercase block">Em movimento</span>
                <span className="font-headline text-xl text-[#F7F5F3]">
                  {formatDuration(weekSummary.movingSeconds)}
                </span>
              </div>
              <div className="bg-[#101010] rounded-xl p-3 border border-[#262626]">
                <span className="font-telemetry text-[9px] text-[#737373] uppercase block">Pace médio</span>
                <span className="font-headline text-xl text-[#FF5500]">
                  {weekSummary.avgPace || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Dia selecionado */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-headline text-lg text-[#F7F5F3] uppercase">
                {formatarDataLonga(selectedDate)}
              </h3>
              <span className="font-telemetry text-[10px] text-[#A1A1AA]">
                {selectedDayActivities.length === 0
                  ? 'Sem registro'
                  : `${selectedDayActivities.length} ${selectedDayActivities.length === 1 ? 'sessão' : 'sessões'}`}
              </span>
            </div>

            {isLoading && (
              <div className="bg-[#1C1C1C] p-6 rounded-2xl border border-[#262626] text-center">
                <span className="text-xs text-[#737373]">Carregando o mês…</span>
              </div>
            )}

            {!isLoading && selectedDayActivities.length === 0 && (
              <div className="bg-[#1C1C1C] p-6 rounded-2xl border border-dashed border-[#262626] text-center">
                <span className="material-symbols-outlined text-[30px] text-[#404040]">event_busy</span>
                <p className="text-xs text-[#737373] mt-2">
                  {selectedDate > hojeIso
                    ? 'Dia ainda por vir.'
                    : 'Nenhum treino registrado neste dia.'}
                </p>
              </div>
            )}

            {selectedDayActivities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                onViewRoute={onViewRoute}
                onOpen={onOpenActivity}
              />
            ))}
          </div>
        </>
      )}

      {/* ---------------- LISTA ---------------- */}
      {activeTab === 'lista' && (
        <>
          {availableTypes.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setTypeFilter(null)}
                className={`shrink-0 min-h-[36px] px-3.5 rounded-lg font-telemetry text-[10px] uppercase font-bold cursor-pointer transition-all ${
                  typeFilter === null
                    ? 'bg-[#FF5500] text-[#0D0D0D]'
                    : 'bg-[#1C1C1C] text-[#A1A1AA] border border-[#262626]'
                }`}
              >
                Todos
              </button>
              {availableTypes.map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => setTypeFilter(tipo)}
                  className={`shrink-0 min-h-[36px] px-3.5 rounded-lg font-telemetry text-[10px] uppercase font-bold cursor-pointer transition-all ${
                    typeFilter === tipo
                      ? 'bg-[#FF5500] text-[#0D0D0D]'
                      : 'bg-[#1C1C1C] text-[#A1A1AA] border border-[#262626]'
                  }`}
                >
                  {TIPO_ROTULO[tipo] || tipo}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2.5">
            {!isLoading && monthActivities.length === 0 && (
              <div className="bg-[#1C1C1C] p-6 rounded-2xl border border-dashed border-[#262626] text-center">
                <span className="material-symbols-outlined text-[30px] text-[#404040]">directions_run</span>
                <p className="text-xs text-[#737373] mt-2">
                  Nenhum treino neste mês{typeFilter ? ' para o filtro escolhido' : ''}.
                </p>
              </div>
            )}

            {monthActivities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                onViewRoute={onViewRoute}
                onOpen={onOpenActivity}
              />
            ))}
          </div>

          {monthActivities.length > 0 && (
            <button
              type="button"
              onClick={onExportCsv}
              className="w-full min-h-[52px] bg-[#1C1C1C] hover:bg-[#262626] border border-[#262626] rounded-xl flex items-center justify-center gap-2 text-[#F7F5F3] cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-[#FF5500] text-[20px]">download</span>
              <span className="font-headline text-sm uppercase tracking-wider">
                Exportar histórico em CSV
              </span>
            </button>
          )}
        </>
      )}

      {/* ---------------- CARGA ACWR ---------------- */}
      {activeTab === 'carga' && (
        <div className="space-y-3">
          <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-5 space-y-3">
            <span className="font-label-caps text-[10px] text-[#A1A1AA] uppercase tracking-widest font-extrabold block">
              Carga aguda : crônica (ACWR)
            </span>

            {trainingLoad?.has_enough_history && trainingLoad.acwr != null ? (
              <>
                <div className="flex items-end gap-3">
                  <span className="font-headline text-5xl text-[#F7F5F3] leading-none">
                    {trainingLoad.acwr.toFixed(2)}
                  </span>
                  {zonaAcwr && (
                    <span
                      className="font-telemetry text-[11px] font-bold uppercase pb-1.5"
                      style={{ color: zonaAcwr.cor }}
                    >
                      {zonaAcwr.texto}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-[#101010] rounded-xl p-3 border border-[#262626]">
                    <span className="font-telemetry text-[9px] text-[#737373] uppercase block">
                      Carga aguda (7 dias)
                    </span>
                    <span className="font-headline text-lg text-[#F7F5F3]">
                      {trainingLoad.acute_load ?? '—'}
                    </span>
                  </div>
                  <div className="bg-[#101010] rounded-xl p-3 border border-[#262626]">
                    <span className="font-telemetry text-[9px] text-[#737373] uppercase block">
                      Crônica (média semanal)
                    </span>
                    <span className="font-headline text-lg text-[#F7F5F3]">
                      {trainingLoad.chronic_weekly_load ?? '—'}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-[#A1A1AA] leading-relaxed">
                A razão carga aguda/crônica precisa de pelo menos quatro semanas de treinos
                registrados para significar alguma coisa. Continue registrando as sessões.
              </p>
            )}
          </div>

          <div className="bg-[#141414] rounded-2xl border border-[#262626] p-4 space-y-2">
            <span className="font-label-caps text-[10px] text-[#A1A1AA] uppercase tracking-widest font-extrabold block">
              Como este número é calculado
            </span>
            <p className="text-xs text-[#737373] leading-relaxed">
              A carga de cada sessão é a sRPE de Foster (1998): duração em minutos multiplicada pelo
              esforço percebido. A razão compara os últimos 7 dias com a média semanal das últimas 4
              semanas, conforme Gabbett (2016).
            </p>
            {trainingLoad?.sessions_without_rpe ? (
              <p className="text-xs text-[#FACC15] leading-relaxed">
                Atenção: {trainingLoad.sessions_without_rpe} de {trainingLoad.sessions_28d} sessões do
                período estão sem esforço percebido registrado. Elas entram apenas pela duração, então
                o número está subestimado.
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
