// ============================================================
// RUSH RUNNING — Calibração inicial do atleta
// ------------------------------------------------------------
// Redesenhado no design system novo, preservando o fluxo de dois
// passos: objetivo de distância e nível. Ao concluir, grava os
// objetivos e gera o plano periodizado inicial, como antes.
// ============================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { training, users } from '../api';

interface OnboardingScreenProps {
  user: any;
  onUpdateUser: (partial: any) => void;
  onRefreshUser: () => Promise<any>;
}

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

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ user, onUpdateUser, onRefreshUser }) => {
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2>(1);
  const [distance, setDistance] = useState<number | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const displayName = user?.name?.split(' ')[0] || user?.username || 'Atleta';

  const handleFinish = async () => {
    if (!distance || !level) return;
    setLoading(true);
    setError('');

    try {
      await users.objectives({ distance_km: distance, level });

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
        objectives: { distance_km: distance, level },
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

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-[#e5e2e1] flex flex-col items-center justify-center px-5 py-10 selection:bg-[#FF5500] selection:text-[#0D0D0D]">
      <div className="w-full max-w-md space-y-6">
        {/* Progresso */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF5500] animate-pulse shrink-0" />
              <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest truncate">
                {step === 1 ? 'Nº 01 / OBJETIVO PRINCIPAL' : 'Nº 02 / CALIBRAÇÃO DE NÍVEL'}
              </span>
            </div>
            <span className="font-telemetry text-[10px] text-[#FF5500] font-bold shrink-0">
              PASSO {step} DE 2
            </span>
          </div>

          <div className="w-full h-1.5 bg-[#1C1C1C] rounded-full overflow-hidden border border-[#262626]">
            <div
              className="h-full bg-[#FF5500] rounded-full transition-all duration-500"
              style={{ width: step === 1 ? '50%' : '100%' }}
            />
          </div>
        </div>

        {/* Título */}
        <div className="space-y-1.5">
          <h1 className="font-headline text-4xl text-[#F7F5F3] uppercase tracking-tight leading-none">
            {step === 1 ? `Bem-vindo, ${displayName}` : 'Qual é o seu nível?'}
          </h1>
          <p className="font-body text-sm text-[#737373] leading-relaxed">
            {step === 1
              ? 'Escolha a distância que vai guiar a periodização do seu plano.'
              : 'O nível define volume inicial, progressão de carga e onde entram os testes.'}
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
          {step === 2 && (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="h-14 px-5 rounded-xl bg-[#1C1C1C] border border-[#262626] text-[#A1A1AA] hover:text-[#F7F5F3] text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              <span>Voltar</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => (step === 1 ? setStep(2) : handleFinish())}
            disabled={step === 1 ? !distance : !level || loading}
            className="flex-1 min-h-[56px] bg-[#FF5500] hover:bg-[#FF6B00] disabled:bg-[#262626] disabled:text-[#737373] disabled:shadow-none disabled:cursor-not-allowed active:scale-[0.99] text-[#0D0D0D] font-headline text-lg uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(255,85,0,0.35)] transition-all cursor-pointer"
          >
            <span>
              {step === 1
                ? distance
                  ? 'Continuar'
                  : 'Escolha uma distância'
                : loading
                  ? 'Montando seu plano…'
                  : level
                    ? 'Concluir calibração'
                    : 'Escolha um nível'}
            </span>
            <span className="material-symbols-outlined text-[22px]">
              {step === 1 ? 'chevron_right' : 'bolt'}
            </span>
          </button>
        </div>

        <p className="text-[10px] text-[#737373] text-center leading-relaxed">
          Você pode mudar objetivo e nível depois, no seu perfil. O plano é reajustado todo dia pela sua
          variabilidade cardíaca.
        </p>
      </div>
    </div>
  );
};
