// ============================================================
// RUSH RUNNING — Calibração inicial do atleta
// ------------------------------------------------------------
// Três passos: distância-alvo, nível e calibração (foco, peso,
// volume típico e lesões em curso). Ao concluir, grava objetivos
// e perfil e gera o plano periodizado inicial.
//
// O desenho previa "FC em repouso: 52 BPM — média matinal de 7
// dias" já nesta tela. No dia da entrada não existe medição
// nenhuma: em vez de um número inventado, a tela diz de onde esse
// valor vai vir.
// ============================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { training, users } from '../api';

interface OnboardingScreenProps {
  user: any;
  onUpdateUser: (partial: any) => void;
  onRefreshUser: () => Promise<any>;
}

type Step = 1 | 2 | 3;

const DISTANCES = [
  { km: 5, label: '5K', title: '5 KM', desc: 'Primeiros passos e base aeróbica' },
  { km: 10, label: '10K', title: '10 KM', desc: 'Construção de volume e ritmo' },
  { km: 21, label: '21K', title: '21 KM', desc: 'Meia-maratona e resistência' },
  { km: 42, label: '42K', title: '42 KM', desc: 'Maratona completa e endurance' },
];

const LEVELS = [
  {
    id: 'beginner',
    label: 'Iniciante',
    badge: 'FASE 1',
    desc: 'Começando agora ou retornando após pausa prolongada. Foco em consistência.',
  },
  {
    id: 'intermediate',
    label: 'Intermediário',
    badge: 'FASE 2',
    desc: 'Corre regularmente há mais de um ano. Busca evolução de pace e distância.',
  },
  {
    id: 'advanced',
    label: 'Avançado',
    badge: 'FASE 3',
    desc: 'Atleta experiente com foco em tempos competitivos e periodização fina por VFC.',
  },
];

/** Os quatro focos aceitos pelo backend. */
const FOCUSES = [
  { id: 'race', icon: 'timer', label: 'Prova alvo', desc: 'Chegar pronto numa data' },
  { id: 'pace', icon: 'speed', label: 'Melhorar pace', desc: 'Ganhar velocidade' },
  { id: 'injury_prevention', icon: 'healing', label: 'Prevenir lesão', desc: 'Carga estável' },
  { id: 'volume', icon: 'stacked_line_chart', label: 'Volume semanal', desc: 'Construir base' },
];

/** Lesões que o backend aceita registrar. */
const INJURIES = [
  { id: 'shin_splints', label: 'Canelite', desc: 'Estresse tibial medial' },
  { id: 'plantar_fasciitis', label: 'Fascite plantar', desc: 'Tensão na fáscia' },
  { id: 'it_band', label: 'Banda iliotibial', desc: 'Dor lateral no joelho' },
  { id: 'knee', label: 'Joelho', desc: 'Dor patelofemoral' },
  { id: 'achilles', label: 'Tendão de aquiles', desc: 'Tendinopatia' },
  { id: 'other', label: 'Outra', desc: 'Não listada acima' },
];

const STEP_LABEL: Record<Step, string> = {
  1: 'Nº 01 / OBJETIVO PRINCIPAL',
  2: 'Nº 02 / CALIBRAÇÃO DE NÍVEL',
  3: 'Nº 03 / PERFIL DE TREINO',
};

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ user, onUpdateUser, onRefreshUser }) => {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(1);
  const [distance, setDistance] = useState<number | null>(null);
  const [level, setLevel] = useState<string | null>(null);

  // Passo 3 — tudo opcional: ninguém é obrigado a calibrar para começar.
  const [focus, setFocus] = useState<string | null>(null);
  const [weightKg, setWeightKg] = useState<string>('');
  const [weeklyKm, setWeeklyKm] = useState<string>('');
  const [injuries, setInjuries] = useState<string[]>([]);
  const [noInjuries, setNoInjuries] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const displayName = user?.name?.split(' ')[0] || user?.username || 'Atleta';

  const toggleInjury = (id: string) => {
    setNoInjuries(false);
    setInjuries((current) =>
      current.includes(id) ? current.filter((i) => i !== id) : [...current, id],
    );
  };

  const handleFinish = async () => {
    if (!distance || !level) return;
    setLoading(true);
    setError('');

    try {
      const numWeight = weightKg.trim() ? Number(weightKg) : null;
      if (numWeight != null && (!isFinite(numWeight) || numWeight < 20 || numWeight > 500)) {
        setError('O peso precisa ser um número entre 20 e 500 kg.');
        setLoading(false);
        return;
      }

      const numWeekly = weeklyKm.trim() ? Number(weeklyKm) : null;
      if (numWeekly != null && (!isFinite(numWeekly) || numWeekly < 0 || numWeekly > 300)) {
        setError('O volume semanal precisa ser um número entre 0 e 300 km.');
        setLoading(false);
        return;
      }

      await users.objectives({
        distance_km: distance,
        level,
        focus: focus || undefined,
        typical_weekly_km: numWeekly ?? undefined,
        active_injuries: noInjuries ? [] : injuries,
      });

      if (numWeight != null) {
        // O peso vive no perfil, não nos objetivos.
        try {
          await users.updateProfile({ weight_kg: numWeight });
        } catch {
          /* o objetivo já foi salvo; o peso pode ser ajustado no perfil */
        }
      }

      // A geração do plano é um bônus: se falhar, o onboarding não trava.
      try {
        await training.generatePlan({ distance_km: distance, level });
      } catch {
        /* o atleta pode gerar o plano depois na aba de treinos */
      }

      onUpdateUser({
        has_onboarding: true,
        distance_km: distance,
        level,
        objectives: { distance_km: distance, level, focus, typical_weekly_km: numWeekly },
      });

      try {
        await onRefreshUser();
      } catch {
        /* o estado local já foi atualizado */
      }

      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar objetivos');
    } finally {
      setLoading(false);
    }
  };

  const canAdvance = step === 1 ? !!distance : step === 2 ? !!level : true;

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-[#e5e2e1] flex flex-col items-center justify-center px-5 py-10 selection:bg-[#FF5500] selection:text-[#0D0D0D]">
      <div className="w-full max-w-md space-y-6">
        {/* Progresso */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF5500] animate-pulse shrink-0" />
              <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest truncate">
                {STEP_LABEL[step]}
              </span>
            </div>
            <span className="font-telemetry text-[10px] text-[#FF5500] font-bold shrink-0">
              PASSO {step} DE 3
            </span>
          </div>

          <div className="w-full h-1.5 bg-[#1C1C1C] rounded-full overflow-hidden border border-[#262626]">
            <div
              className="h-full bg-[#FF5500] rounded-full transition-all duration-500"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Título */}
        <div className="space-y-1.5">
          <h1 className="font-headline text-4xl text-[#F7F5F3] uppercase tracking-tight leading-none">
            {step === 1
              ? `Bem-vindo, ${displayName}`
              : step === 2
                ? 'Qual é o seu nível?'
                : 'Calibre seu treino'}
          </h1>
          <p className="font-body text-sm text-[#737373] leading-relaxed">
            {step === 1
              ? 'Escolha a distância que vai guiar a periodização do seu plano.'
              : step === 2
                ? 'O nível define volume inicial, progressão de carga e onde entram os testes.'
                : 'Tudo aqui é opcional e editável depois. Nada trava o começo do plano.'}
          </p>
        </div>

        {/* Passo 1 — distância */}
        {step === 1 && (
          <div className="grid grid-cols-2 gap-2.5">
            {DISTANCES.map((option) => (
              <button
                key={option.km}
                type="button"
                onClick={() => setDistance(option.km)}
                aria-pressed={distance === option.km}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  distance === option.km
                    ? 'bg-[#FF5500]/12 border-[#FF5500] shadow-lg shadow-[#FF5500]/10'
                    : 'bg-[#1C1C1C] border-[#262626] hover:border-[#444]'
                }`}
              >
                <span
                  className={`font-headline text-3xl uppercase block leading-none ${
                    distance === option.km ? 'text-[#FF5500]' : 'text-[#F7F5F3]'
                  }`}
                >
                  {option.label}
                </span>
                <span className="font-telemetry text-[10px] text-[#A1A1AA] uppercase block mt-1">
                  {option.title}
                </span>
                <span className="text-[11px] text-[#737373] leading-snug block mt-1.5">{option.desc}</span>
              </button>
            ))}
          </div>
        )}

        {/* Passo 2 — nível */}
        {step === 2 && (
          <div className="space-y-2.5">
            {LEVELS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setLevel(option.id)}
                aria-pressed={level === option.id}
                className={`w-full p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  level === option.id
                    ? 'bg-[#FF5500]/12 border-[#FF5500] shadow-lg shadow-[#FF5500]/10'
                    : 'bg-[#1C1C1C] border-[#262626] hover:border-[#444]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`font-headline text-xl uppercase ${
                      level === option.id ? 'text-[#FF5500]' : 'text-[#F7F5F3]'
                    }`}
                  >
                    {option.label}
                  </span>
                  <span className="font-telemetry text-[9px] font-black px-1.5 py-0.5 rounded uppercase bg-[#101010] text-[#A1A1AA] border border-[#262626] shrink-0">
                    {option.badge}
                  </span>
                </div>
                <span className="text-xs text-[#737373] leading-relaxed block mt-1">{option.desc}</span>
              </button>
            ))}
          </div>
        )}

        {/* Passo 3 — calibração */}
        {step === 3 && (
          <div className="space-y-5">
            {/* Foco principal */}
            <div className="space-y-2">
              <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest block">
                Foco principal
              </span>
              <div className="grid grid-cols-2 gap-2">
                {FOCUSES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setFocus(focus === option.id ? null : option.id)}
                    aria-pressed={focus === option.id}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer min-h-[76px] ${
                      focus === option.id
                        ? 'bg-[#FF5500]/12 border-[#FF5500]'
                        : 'bg-[#1C1C1C] border-[#262626] hover:border-[#444]'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-[20px] ${
                        focus === option.id ? 'text-[#FF5500]' : 'text-[#737373]'
                      }`}
                    >
                      {option.icon}
                    </span>
                    <span
                      className={`font-headline text-sm uppercase block leading-tight mt-1 ${
                        focus === option.id ? 'text-[#FF5500]' : 'text-[#F7F5F3]'
                      }`}
                    >
                      {option.label}
                    </span>
                    <span className="text-[10px] text-[#737373] block leading-snug">{option.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Biometria */}
            <div className="space-y-2">
              <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest block">
                Parâmetros de base
              </span>

              <div className="bg-[#1C1C1C] border border-[#262626] rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="peso" className="min-w-0">
                    <span className="font-headline text-sm uppercase text-[#F7F5F3] block">Peso corporal</span>
                    <span className="text-[10px] text-[#737373] block">Usado no gasto energético</span>
                  </label>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      id="peso"
                      type="number"
                      inputMode="decimal"
                      min={20}
                      max={500}
                      step="0.1"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      placeholder="—"
                      className="w-20 h-11 bg-[#101010] border border-[#262626] rounded-lg px-2 text-right font-headline text-lg text-[#F7F5F3] focus:border-[#FF5500] focus:outline-none"
                    />
                    <span className="font-telemetry text-[10px] text-[#A1A1AA]">kg</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#262626]">
                  <label htmlFor="volume" className="min-w-0">
                    <span className="font-headline text-sm uppercase text-[#F7F5F3] block">Volume semanal</span>
                    <span className="text-[10px] text-[#737373] block">O que você já corre hoje</span>
                  </label>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      id="volume"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={300}
                      step="1"
                      value={weeklyKm}
                      onChange={(e) => setWeeklyKm(e.target.value)}
                      placeholder="—"
                      className="w-20 h-11 bg-[#101010] border border-[#262626] rounded-lg px-2 text-right font-headline text-lg text-[#F7F5F3] focus:border-[#FF5500] focus:outline-none"
                    />
                    <span className="font-telemetry text-[10px] text-[#A1A1AA]">km</span>
                  </div>
                </div>

                {/* FC de repouso: medida, não declarada. */}
                <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#262626]">
                  <div className="min-w-0">
                    <span className="font-headline text-sm uppercase text-[#F7F5F3] block">FC de repouso</span>
                    <span className="text-[10px] text-[#737373] block leading-snug">
                      Vem da sua primeira medição matinal de VFC, não de estimativa
                    </span>
                  </div>
                  <span className="font-telemetry text-[10px] text-[#A1A1AA] uppercase shrink-0">
                    A medir
                  </span>
                </div>
              </div>
            </div>

            {/* Lesões */}
            <div className="space-y-2">
              <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest block">
                Lesões em curso
              </span>

              <div className="grid grid-cols-2 gap-2">
                {INJURIES.map((option) => {
                  const selecionada = injuries.includes(option.id) && !noInjuries;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => toggleInjury(option.id)}
                      aria-pressed={selecionada}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer min-h-[62px] ${
                        selecionada
                          ? 'bg-[#EF4444]/12 border-[#EF4444]'
                          : 'bg-[#1C1C1C] border-[#262626] hover:border-[#444]'
                      }`}
                    >
                      <span
                        className={`font-headline text-xs uppercase block leading-tight ${
                          selecionada ? 'text-[#EF4444]' : 'text-[#F7F5F3]'
                        }`}
                      >
                        {option.label}
                      </span>
                      <span className="text-[10px] text-[#737373] block leading-snug">{option.desc}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => {
                  setNoInjuries(true);
                  setInjuries([]);
                }}
                aria-pressed={noInjuries}
                className={`w-full min-h-[48px] rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  noInjuries
                    ? 'bg-[#22C55E]/12 border-[#22C55E] text-[#22C55E]'
                    : 'bg-[#1C1C1C] border-[#262626] text-[#A1A1AA] hover:text-[#F7F5F3]'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                <span className="font-headline text-sm uppercase">Nenhuma lesão ativa</span>
              </button>

              <p className="text-[10px] text-[#737373] leading-relaxed">
                Este registro fica no seu perfil e acompanha seu histórico. O plano <strong>não</strong> é
                ajustado automaticamente por lesão: adaptar treino a uma lesão exige avaliação clínica, que o
                app não substitui.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="bg-[#EF4444]/12 border border-[#EF4444]/40 rounded-xl px-4 py-3 flex items-center gap-2.5"
          >
            <span className="material-symbols-outlined text-[#EF4444] text-[18px] shrink-0">error</span>
            <span className="text-xs text-[#e5e2e1]">{error}</span>
          </div>
        )}

        {/* Navegação */}
        <div className="flex gap-2.5">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((step - 1) as Step)}
              className="h-14 px-5 rounded-xl bg-[#1C1C1C] border border-[#262626] text-[#A1A1AA] hover:text-[#F7F5F3] text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              <span>Voltar</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => (step === 3 ? handleFinish() : setStep((step + 1) as Step))}
            disabled={!canAdvance || loading}
            className="flex-1 min-h-[56px] bg-[#FF5500] hover:bg-[#FF6B00] disabled:bg-[#262626] disabled:text-[#737373] disabled:shadow-none disabled:cursor-not-allowed active:scale-[0.99] text-[#0D0D0D] font-headline text-lg uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(255,85,0,0.35)] transition-all cursor-pointer"
          >
            <span>
              {step === 1
                ? distance
                  ? 'Continuar'
                  : 'Escolha uma distância'
                : step === 2
                  ? level
                    ? 'Continuar'
                    : 'Escolha um nível'
                  : loading
                    ? 'Montando seu plano…'
                    : 'Concluir calibração'}
            </span>
            <span className="material-symbols-outlined text-[22px]">
              {step === 3 ? 'bolt' : 'chevron_right'}
            </span>
          </button>
        </div>

        {step === 3 && !loading && (
          <button
            type="button"
            onClick={handleFinish}
            className="w-full text-[10px] text-[#737373] hover:text-[#A1A1AA] uppercase tracking-wider cursor-pointer"
          >
            Pular esta etapa — dá para preencher depois no perfil
          </button>
        )}

        <p className="text-[10px] text-[#737373] text-center leading-relaxed">
          Você pode mudar objetivo, nível e calibração depois, no seu perfil. O plano é reajustado todo dia
          pela sua variabilidade cardíaca.
        </p>
      </div>
    </div>
  );
};
