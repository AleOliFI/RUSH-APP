// ============================================================
// RUSH RUNNING — Ciclo menstrual
// ------------------------------------------------------------
// Duas faces: cadastro do ciclo (uma vez) e check-in diário de
// sintomas. A FASE é sempre calculada pelo backend a partir da
// data da última menstruação — nunca deduzida aqui.
//
// Do desenho ficaram de fora, por não existirem:
// - temperatura basal (36,3 °C): o app não lê termômetro
// - "curva hormonal": o gráfico mostra a VFC medida, que é o que
//   temos; a curva de hormônio seria desenho, não dado
// - "tolerância a ácido lático excelente": não é medido
// - "dados criptografados de ponta a ponta": não são. Os dados
//   trafegam por HTTPS e ficam no banco do servidor — afirmar
//   criptografia ponta a ponta seria falso
// - sintomas sem campo no backend (DOMS, sensibilidade articular,
//   desejo por carboidratos): em vez de chips que não gravam,
//   a tela usa as quatro escalas que existem de verdade
// ============================================================

import React, { useEffect, useState } from 'react';
import type { CycleData, CyclePhase } from '../hooks/useCycle';

interface CycleScreenProps {
  cycle: CycleData;
  /** VFC do dia, quando já houve medição — o desenho mostra os dois juntos. */
  rmssdToday: number | null;
  readinessScore: number | null;
  /** Série de lnRMSSD para o gráfico de tendência. */
  hrvHistory: { date: string; lnrmssd?: number; rmssd_ms?: number }[];
  onOpenMeasurement?: () => void;
}

const FASES: Record<CyclePhase, { rotulo: string; dias: string; cor: string }> = {
  menstrual: { rotulo: 'Fase menstrual', dias: 'Dias 1–5', cor: '#FF4D4D' },
  follicular: { rotulo: 'Fase folicular', dias: 'Dias 6–13', cor: '#22C55E' },
  ovulatory: { rotulo: 'Fase ovulatória', dias: 'Dia 14 ±1', cor: '#38BDF8' },
  luteal: { rotulo: 'Fase lútea', dias: 'Dias 15–28', cor: '#FACC15' },
};

/** O backend aceita texto livre; estas são as opções que a tela oferece. */
const FLUXO = [
  { id: 'none', label: 'Nenhum', icon: 'block' },
  { id: 'light', label: 'Leve', icon: 'water_drop' },
  { id: 'moderate', label: 'Moderado', icon: 'opacity' },
  { id: 'heavy', label: 'Intenso', icon: 'waves' },
];

/** As quatro escalas que o backend realmente grava (0 a 5). */
const ESCALAS = [
  { campo: 'cramp_level' as const, label: 'Cólica', hint: '0 = nenhuma · 5 = intensa', invertida: true },
  { campo: 'bloating_level' as const, label: 'Inchaço / retenção', hint: '0 = nenhum · 5 = intenso', invertida: true },
  { campo: 'energy_level' as const, label: 'Disposição', hint: '0 = exausta · 5 = potência máxima', invertida: false },
  { campo: 'mood_level' as const, label: 'Humor / foco', hint: '0 = péssimo · 5 = ótimo', invertida: false },
];

const VIES_INTENSIDADE: Record<string, { texto: string; cor: string }> = {
  low: { texto: 'Intensidade baixa sugerida', cor: '#38BDF8' },
  moderate: { texto: 'Intensidade moderada sugerida', cor: '#FACC15' },
  high: { texto: 'Janela para alta intensidade', cor: '#22C55E' },
};

function hojeIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Dias decorridos desde a data informada. */
function diasDesde(iso: string): number | null {
  if (!iso) return null;
  const inicio = new Date(`${iso}T12:00:00`).getTime();
  if (isNaN(inicio)) return null;
  return Math.floor((Date.now() - inicio) / 86400000);
}

export const CycleScreen: React.FC<CycleScreenProps> = ({
  cycle,
  rmssdToday,
  readinessScore,
  hrvHistory,
  onOpenMeasurement,
}) => {
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  // Cadastro
  const [lmpDate, setLmpDate] = useState('');
  const [duracao, setDuracao] = useState(28);
  const [hormonal, setHormonal] = useState(false);
  const [metodo, setMetodo] = useState<string | null>(null);

  // Check-in
  const [fluxo, setFluxo] = useState<string | null>(null);
  const [escalas, setEscalas] = useState<Record<string, number>>({
    cramp_level: 0,
    bloating_level: 0,
    energy_level: 3,
    mood_level: 3,
  });
  const [salvo, setSalvo] = useState(false);

  // Carrega o que já existe quando o perfil ou o registro do dia chegam.
  useEffect(() => {
    if (cycle.profile) {
      setLmpDate(cycle.profile.lmp_date || '');
      setDuracao(cycle.profile.cycle_length_days || 28);
      setHormonal(!!cycle.profile.uses_hormonal_contraceptive);
      setMetodo(cycle.profile.contraceptive_type || null);
    }
  }, [cycle.profile]);

  useEffect(() => {
    if (cycle.tracking) {
      setFluxo(cycle.tracking.bleeding_intensity || null);
      setEscalas({
        cramp_level: cycle.tracking.cramp_level ?? 0,
        bloating_level: cycle.tracking.bloating_level ?? 0,
        energy_level: cycle.tracking.energy_level ?? 3,
        mood_level: cycle.tracking.mood_level ?? 3,
      });
    }
  }, [cycle.tracking]);

  const salvarPerfil = async () => {
    if (!lmpDate) {
      setErro('Informe o primeiro dia da última menstruação.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      await cycle.saveProfile({
        lmp_date: lmpDate,
        cycle_length_days: duracao,
        uses_hormonal_contraceptive: hormonal,
        contraceptive_type: hormonal ? metodo : null,
      });
      setEditando(false);
    } catch (err: any) {
      setErro(err?.message || 'Não foi possível salvar o ciclo.');
    } finally {
      setSalvando(false);
    }
  };

  const salvarCheckin = async () => {
    setSalvando(true);
    setErro('');
    setSalvo(false);
    try {
      await cycle.saveTracking({ ...escalas, bleeding_intensity: fluxo });
      setSalvo(true);
      setTimeout(() => setSalvo(false), 4000);
    } catch (err: any) {
      setErro(err?.message || 'Não foi possível registrar o check-in.');
    } finally {
      setSalvando(false);
    }
  };

  const mostrarCadastro = !cycle.hasProfile || editando;
  const fase = cycle.phase ? FASES[cycle.phase] : null;
  const diaDoCiclo = cycle.profile?.lmp_date ? (diasDesde(cycle.profile.lmp_date) ?? 0) + 1 : null;

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto px-4 sm:px-5 space-y-4 pt-2 pb-8">
      {/* Cabeçalho */}
      <div className="border-b border-[#262626] pb-3">
        <span className="font-label-caps text-[10px] text-[#C084FC] uppercase tracking-widest font-extrabold block">
          Módulo fisiológico
        </span>
        <h1 className="font-headline-md text-[#F7F5F3] uppercase tracking-tight">
          {mostrarCadastro ? 'Calibração do ciclo' : 'Check-in do ciclo'}
        </h1>
        <p className="text-xs text-[#737373] leading-relaxed mt-1">
          {mostrarCadastro
            ? 'A fase do ciclo entra na leitura diária de prontidão. É opcional: nada no app depende disso.'
            : 'Registre como você está hoje. O histórico fica no seu perfil.'}
        </p>
      </div>

      {erro && (
        <div role="alert" className="bg-[#EF4444]/12 border border-[#EF4444]/40 rounded-xl px-4 py-3">
          <span className="text-xs text-[#e5e2e1]">{erro}</span>
        </div>
      )}

      {cycle.isLoading && !cycle.hasProfile && (
        <div className="bg-[#1C1C1C] p-6 rounded-2xl border border-[#262626] text-center">
          <span className="text-xs text-[#737373]">Carregando…</span>
        </div>
      )}

      {/* ---------------- CADASTRO ---------------- */}
      {mostrarCadastro && !cycle.isLoading && (
        <>
          {/* Duração do ciclo */}
          <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest block">
                  Parâmetro 01
                </span>
                <span className="font-headline text-base text-[#F7F5F3] uppercase">
                  Duração média do ciclo
                </span>
              </div>
              <span className="font-telemetry text-[9px] text-[#737373] uppercase shrink-0">
                {cycle.cycleLengthRange.min}–{cycle.cycleLengthRange.max} dias
              </span>
            </div>

            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setDuracao((d) => Math.max(cycle.cycleLengthRange.min, d - 1))}
                aria-label="Diminuir duração"
                className="w-12 h-12 rounded-xl bg-[#101010] border border-[#262626] text-[#F7F5F3] flex items-center justify-center cursor-pointer hover:border-[#444]"
              >
                <span className="material-symbols-outlined text-[22px]">remove</span>
              </button>

              <div className="text-center min-w-[110px]">
                <span className="font-headline text-5xl text-[#FF5500] leading-none">{duracao}</span>
                <span className="font-telemetry text-[10px] text-[#A1A1AA] uppercase block mt-1">dias</span>
              </div>

              <button
                type="button"
                onClick={() => setDuracao((d) => Math.min(cycle.cycleLengthRange.max, d + 1))}
                aria-label="Aumentar duração"
                className="w-12 h-12 rounded-xl bg-[#101010] border border-[#262626] text-[#F7F5F3] flex items-center justify-center cursor-pointer hover:border-[#444]"
              >
                <span className="material-symbols-outlined text-[22px]">add</span>
              </button>
            </div>
          </div>

          {/* Data da última menstruação */}
          <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 space-y-3">
            <div>
              <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest block">
                Parâmetro 02
              </span>
              <span className="font-headline text-base text-[#F7F5F3] uppercase">
                Primeiro dia da última menstruação
              </span>
            </div>

            <input
              id="lmp"
              type="date"
              value={lmpDate}
              max={hojeIso()}
              onChange={(e) => setLmpDate(e.target.value)}
              className="w-full h-14 bg-[#101010] border border-[#262626] rounded-xl px-4 font-telemetry text-base text-[#F7F5F3] focus:border-[#FF5500] focus:outline-none cursor-pointer"
            />

            {lmpDate && diasDesde(lmpDate) != null && (
              <span className="font-telemetry text-[10px] text-[#FF5500] uppercase block">
                Há {diasDesde(lmpDate)} dias
              </span>
            )}
          </div>

          {/* Contraceptivo */}
          <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 space-y-3">
            <div>
              <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest block">
                Parâmetro 03
              </span>
              <span className="font-headline text-base text-[#F7F5F3] uppercase">
                Contraceptivo hormonal
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { valor: false, label: 'Não uso' },
                { valor: true, label: 'Uso' },
              ].map((opcao) => (
                <button
                  key={String(opcao.valor)}
                  type="button"
                  onClick={() => {
                    setHormonal(opcao.valor);
                    if (!opcao.valor) setMetodo(null);
                  }}
                  aria-pressed={hormonal === opcao.valor}
                  className={`min-h-[48px] rounded-xl border font-headline text-sm uppercase transition-all cursor-pointer ${
                    hormonal === opcao.valor
                      ? 'bg-[#C084FC]/12 border-[#C084FC] text-[#C084FC]'
                      : 'bg-[#101010] border-[#262626] text-[#A1A1AA] hover:text-[#F7F5F3]'
                  }`}
                >
                  {opcao.label}
                </button>
              ))}
            </div>

            {hormonal && (
              <input
                id="metodo"
                type="text"
                value={metodo || ''}
                onChange={(e) => setMetodo(e.target.value)}
                placeholder="Qual? (pílula, DIU hormonal, implante…)"
                className="w-full h-12 bg-[#101010] border border-[#262626] rounded-xl px-4 text-sm text-[#F7F5F3] placeholder:text-[#525252] focus:border-[#C084FC] focus:outline-none"
              />
            )}

            <p className="text-[10px] text-[#737373] leading-relaxed">
              Contraceptivos hormonais atenuam a oscilação natural dos hormônios ao longo do ciclo, e com
              ela a variação esperada da VFC entre as fases.
            </p>
          </div>

          <div className="flex gap-2">
            {cycle.hasProfile && (
              <button
                type="button"
                onClick={() => setEditando(false)}
                className="h-14 px-5 rounded-xl bg-[#1C1C1C] border border-[#262626] text-[#A1A1AA] hover:text-[#F7F5F3] text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Cancelar
              </button>
            )}
            <button
              type="button"
              onClick={salvarPerfil}
              disabled={!lmpDate || salvando}
              className="flex-1 min-h-[56px] bg-[#FF5500] hover:bg-[#FF6B00] disabled:bg-[#262626] disabled:text-[#737373] disabled:cursor-not-allowed text-[#0D0D0D] font-headline text-lg uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <span>{salvando ? 'Salvando…' : 'Salvar ciclo'}</span>
              <span className="material-symbols-outlined text-[20px]">bolt</span>
            </button>
          </div>
        </>
      )}

      {/* ---------------- CHECK-IN ---------------- */}
      {!mostrarCadastro && (
        <>
          {/* Fase atual */}
          {fase && (
            <div
              className="rounded-2xl border p-4 space-y-3"
              style={{ borderColor: `${fase.cor}55`, backgroundColor: `${fase.cor}12` }}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span
                  className="font-label-sm text-[10px] uppercase tracking-widest font-extrabold"
                  style={{ color: fase.cor }}
                >
                  {fase.rotulo} · {fase.dias}
                </span>
                {diaDoCiclo != null && (
                  <span
                    className="font-telemetry text-[9px] font-black uppercase px-2 py-0.5 rounded"
                    style={{ backgroundColor: `${fase.cor}22`, color: fase.cor }}
                  >
                    Dia {diaDoCiclo} do ciclo
                  </span>
                )}
              </div>

              {cycle.recommendation?.modifier && (
                <span className="font-headline text-lg text-[#F7F5F3] uppercase block leading-tight">
                  {cycle.recommendation.modifier}
                </span>
              )}

              {cycle.recommendation?.note && (
                <p className="text-xs text-[#e5e2e1] leading-relaxed">{cycle.recommendation.note}</p>
              )}

              {cycle.recommendation?.intensityBias &&
                VIES_INTENSIDADE[cycle.recommendation.intensityBias] && (
                  <span
                    className="font-telemetry text-[10px] uppercase font-bold block"
                    style={{ color: VIES_INTENSIDADE[cycle.recommendation.intensityBias].cor }}
                  >
                    {VIES_INTENSIDADE[cycle.recommendation.intensityBias].texto}
                  </span>
                )}

              {cycle.usesHormonalContraceptive && (
                <p className="text-[10px] text-[#737373] leading-relaxed">
                  Você usa contraceptivo hormonal: a oscilação entre fases tende a ser menor do que a
                  descrição acima sugere.
                </p>
              )}
            </div>
          )}

          {/* Medição do dia — só o que foi medido */}
          <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 space-y-3">
            <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest block">
              Sua medição de hoje
            </span>

            {rmssdToday != null || readinessScore != null ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#101010] rounded-xl p-3 border border-[#262626]">
                  <span className="font-telemetry text-[9px] text-[#737373] uppercase block">
                    VFC (RMSSD)
                  </span>
                  <span className="font-headline text-2xl text-[#FF5500]">
                    {rmssdToday != null ? rmssdToday : '—'}
                    {rmssdToday != null && <span className="text-[10px] text-[#A1A1AA] ml-1">ms</span>}
                  </span>
                </div>
                <div className="bg-[#101010] rounded-xl p-3 border border-[#262626]">
                  <span className="font-telemetry text-[9px] text-[#737373] uppercase block">Prontidão</span>
                  <span className="font-headline text-2xl text-[#22C55E]">
                    {readinessScore != null ? readinessScore : '—'}
                    {readinessScore != null && <span className="text-[10px] text-[#A1A1AA] ml-1">%</span>}
                  </span>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenMeasurement}
                className="w-full min-h-[52px] bg-[#101010] hover:bg-[#262626] border border-[#262626] rounded-xl flex items-center justify-center gap-2 text-[#F7F5F3] cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[#FF5500] text-[18px]">ecg_heart</span>
                <span className="text-xs font-bold uppercase tracking-wider">
                  Fazer a medição de hoje
                </span>
              </button>
            )}

            {/* Tendência de VFC — a série medida, não uma curva hormonal */}
            {hrvHistory.length >= 3 && (
              <div className="space-y-1.5 pt-1">
                <span className="font-telemetry text-[9px] text-[#737373] uppercase block">
                  VFC nas últimas {Math.min(hrvHistory.length, 14)} medições
                </span>
                <div className="flex items-end gap-1 h-16">
                  {hrvHistory.slice(-14).map((ponto, indice) => {
                    const valores = hrvHistory
                      .slice(-14)
                      .map((p) => p.rmssd_ms ?? (p.lnrmssd ? Math.exp(p.lnrmssd) : 0));
                    const maximo = Math.max(...valores, 1);
                    const valor = ponto.rmssd_ms ?? (ponto.lnrmssd ? Math.exp(ponto.lnrmssd) : 0);
                    const altura = Math.max(6, (valor / maximo) * 100);
                    const ultimo = indice === hrvHistory.slice(-14).length - 1;
                    return (
                      <span
                        key={ponto.date || indice}
                        title={`${ponto.date}: ${Math.round(valor)} ms`}
                        className="flex-1 rounded-t"
                        style={{
                          height: `${altura}%`,
                          backgroundColor: ultimo ? '#FF5500' : '#404040',
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Fluxo */}
          <div className="space-y-2">
            <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest block">
              Fluxo menstrual
            </span>
            <div className="grid grid-cols-4 gap-2">
              {FLUXO.map((opcao) => (
                <button
                  key={opcao.id}
                  type="button"
                  onClick={() => setFluxo(fluxo === opcao.id ? null : opcao.id)}
                  aria-pressed={fluxo === opcao.id}
                  className={`min-h-[70px] rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    fluxo === opcao.id
                      ? 'bg-[#FF4D4D]/12 border-[#FF4D4D] text-[#FF4D4D]'
                      : 'bg-[#1C1C1C] border-[#262626] text-[#A1A1AA] hover:text-[#F7F5F3]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">{opcao.icon}</span>
                  <span className="font-telemetry text-[9px] uppercase font-bold">{opcao.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Escalas — os quatro campos que o backend grava */}
          <div className="space-y-3">
            <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest block">
              Como você está hoje
            </span>

            {ESCALAS.map((escala) => (
              <div key={escala.campo} className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-headline text-sm uppercase text-[#F7F5F3]">{escala.label}</span>
                  <span className="font-telemetry text-xs text-[#FF5500] font-bold">
                    {escalas[escala.campo]}/5
                  </span>
                </div>

                <div className="grid grid-cols-6 gap-1.5">
                  {[0, 1, 2, 3, 4, 5].map((valor) => {
                    const ativo = escalas[escala.campo] === valor;
                    const corAtiva = escala.invertida
                      ? valor >= 4
                        ? '#EF4444'
                        : valor >= 2
                          ? '#FACC15'
                          : '#22C55E'
                      : valor >= 4
                        ? '#22C55E'
                        : valor >= 2
                          ? '#FACC15'
                          : '#EF4444';
                    return (
                      <button
                        key={valor}
                        type="button"
                        onClick={() => setEscalas((atual) => ({ ...atual, [escala.campo]: valor }))}
                        aria-pressed={ativo}
                        aria-label={`${escala.label}: ${valor}`}
                        className="h-11 rounded-lg font-headline-sm text-sm transition-all cursor-pointer border"
                        style={
                          ativo
                            ? { backgroundColor: corAtiva, color: '#0D0D0D', borderColor: corAtiva, fontWeight: 800 }
                            : { backgroundColor: '#141414', color: '#737373', borderColor: '#262626' }
                        }
                      >
                        {valor}
                      </button>
                    );
                  })}
                </div>

                <span className="font-telemetry text-[9px] text-[#737373] uppercase block">
                  {escala.hint}
                </span>
              </div>
            ))}
          </div>

          {cycle.symptomScore != null && cycle.tracking && (
            <div className="bg-[#141414] rounded-2xl border border-[#262626] p-3.5">
              <span className="font-telemetry text-[10px] text-[#A1A1AA] uppercase block">
                Índice de sintomas de hoje:{' '}
                <strong className="text-[#F7F5F3]">{cycle.symptomScore}</strong>
              </span>
              <p className="text-[10px] text-[#737373] leading-relaxed mt-1">
                Sintomas intensos entram na leitura diária de prontidão junto com a VFC e o questionário de
                bem-estar.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={salvarCheckin}
            disabled={salvando}
            className="w-full min-h-[56px] bg-[#FF5500] hover:bg-[#FF6B00] disabled:bg-[#262626] disabled:text-[#737373] text-[#0D0D0D] font-headline text-lg uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">
              {salvo ? 'check_circle' : 'check'}
            </span>
            <span>
              {salvando
                ? 'Registrando…'
                : salvo
                  ? 'Check-in registrado'
                  : cycle.tracking
                    ? 'Atualizar check-in'
                    : 'Registrar check-in'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setEditando(true)}
            className="w-full min-h-[48px] bg-[#1C1C1C] hover:bg-[#262626] border border-[#262626] rounded-xl flex items-center justify-center gap-2 text-[#A1A1AA] hover:text-[#F7F5F3] cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">edit_calendar</span>
            <span className="text-xs font-bold uppercase tracking-wider">Editar dados do ciclo</span>
          </button>
        </>
      )}
    </div>
  );
};
